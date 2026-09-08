import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ReportRequestStatus } from "@prisma/client";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { AuthUser } from "../../common/types/auth-user";
import { ReportExportFormat } from "./dto/reports.dto";
import { ReportStorageService } from "./report-storage.service";
import { ReportsService } from "./reports.service";
import { excelReportDefinitions } from "./reports-catalog";
import { PeriodReportProviderService } from "./period-report-provider.service";
import { StreamingReportExportService } from "./streaming-report-export.service";
import { authUserInclude, isActiveAuthUser, serializeAuthUser } from "../auth/auth-user.resolver";

@Injectable()
export class ReportWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportWorkerService.name);
  private readonly ownerId = `${hostname()}:${process.pid}:${randomUUID()}`;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly storage: ReportStorageService,
    private readonly config: ConfigService,
    private readonly periodProvider: PeriodReportProviderService,
    private readonly streamingExport: StreamingReportExportService
  ) {}

  onModuleInit() {
    const interval = Math.max(2_000, Number(this.config.get<string>("REPORT_WORKER_INTERVAL_MS") || 5_000));
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.recoverLeases();
      await this.expireFiles();
      const id = await this.claim();
      if (id) await this.process(id);
    } catch (error) {
      this.logger.error("Report worker tick failed", error);
    } finally {
      this.running = false;
    }
  }

  private async claim() {
    const lease = new Date(Date.now() + this.leaseDurationMs());
    const owner = this.ownerId;
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "ReportRequest"
      SET "status" = 'PROCESSING'::"ReportRequestStatus",
          "startedAt" = COALESCE("startedAt", NOW()),
          "leaseExpiresAt" = ${lease},
          "leaseOwner" = ${owner},
          "heartbeatAt" = NOW(),
          "nextAttemptAt" = NULL,
          "errorCode" = NULL,
          "attempts" = "attempts" + 1,
          "updatedAt" = NOW()
      WHERE "id" = (
        SELECT "id" FROM "ReportRequest"
        WHERE "status" = 'PENDING'::"ReportRequestStatus"
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id"
    `;
    return rows[0]?.id;
  }

  private async process(id: string) {
    const request = await this.prisma.reportRequest.findFirst({
      where: { id, status: ReportRequestStatus.PROCESSING, leaseOwner: this.ownerId }
    });
    if (!request) return;
    const heartbeat = this.startHeartbeat(id);
    let storedKey: string | undefined;
    try {
      const actor = await this.loadActor(request.requestedById);
      if (actor.organizationId !== request.organizationId) throw new Error("Organizacion de solicitud invalida");
      if (request.resolvedBranchIds.some((branchId) => !actor.branchIds.includes(branchId))) {
        throw new Error("El solicitante ya no tiene acceso a una sucursal del reporte");
      }
      actor.branchIds = request.resolvedBranchIds;
      actor.branches = actor.branches?.filter((branch) => request.resolvedBranchIds.includes(branch.id));
      const format = request.surface === "PERIOD"
        ? ReportExportFormat.XLSX
        : request.format === ReportExportFormat.CSV
          ? ReportExportFormat.CSV
          : ReportExportFormat.XLSX;
      const parameters = {
        ...(request.parametersJson as Record<string, unknown>),
        branchIds: request.resolvedBranchIds,
        branchWindows: request.branchWindowsJson
      };
      const definition = excelReportDefinitions.find((item) => item.code === request.reportCode);
      let stored: { storageKey: string; checksum: string; fileSize: number };
      let rowCount: number | null;
      let fileName: string;
      let mimeType: string;
      if (definition?.handler === "period-generic") {
        const generated = await this.streamingExport.create({
          rows: this.periodProvider.iterateRows(definition, actor, parameters),
          format,
          baseFileName: definition.id,
          sheetName: definition.name,
          onProgress: (rows) => this.publishProgress(id, rows)
        });
        try {
          stored = await this.storage.storeFile(request.organizationId, request.id, generated.path);
          rowCount = generated.rowCount;
          fileName = generated.fileName;
          mimeType = generated.mimeType;
        } finally {
          await generated.cleanup();
        }
      } else {
        const result = await this.reports.createExcelRequest(actor, {
          reportCode: request.reportCode,
          format,
          parameters,
          surface: request.surface as "REQUEST" | "PERIOD"
        });
        if (!result.file?.base64) throw new Error(result.errorMessage || "El generador no produjo un archivo");
        const bytes = Buffer.from(result.file.base64, "base64");
        stored = await this.storage.store(request.organizationId, request.id, bytes);
        rowCount = result.rowCount;
        fileName = result.fileName ?? result.file.fileName;
        mimeType = result.mimeType ?? result.file.mimeType;
      }
      storedKey = stored.storageKey;
      const completed = await this.prisma.reportRequest.updateMany({
        where: { id, status: ReportRequestStatus.PROCESSING, leaseOwner: this.ownerId },
        data: {
          status: ReportRequestStatus.COMPLETED,
          completedAt: new Date(),
          leaseExpiresAt: null,
          leaseOwner: null,
          heartbeatAt: new Date(),
          nextAttemptAt: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
          rowCount,
          progressRows: rowCount ?? 0,
          progressPercent: 100,
          fileName,
          mimeType,
          fileSize: stored.fileSize,
          storageKey: stored.storageKey,
          checksum: stored.checksum,
          errorCode: null,
          errorMessage: null
        }
      });
      if (completed.count !== 1) {
        await this.storage.remove(stored.storageKey);
        storedKey = undefined;
        throw new LeaseLostError();
      }
    } catch (error) {
      if (error instanceof LeaseLostError) return;
      const message = error instanceof Error ? error.message : "No fue posible generar el reporte";
      const current = await this.prisma.reportRequest.findFirst({
        where: { id, status: ReportRequestStatus.PROCESSING, leaseOwner: this.ownerId },
        select: { attempts: true }
      });
      if (!current) {
        if (storedKey) await this.storage.remove(storedKey);
        return;
      }
      const errorCode = this.errorCode(error);
      const permanent = errorCode === "LIMIT_EXCEEDED";
      const shouldRetry = !permanent && current.attempts < 3;
      await this.prisma.reportRequest.updateMany({
        where: { id, status: ReportRequestStatus.PROCESSING, leaseOwner: this.ownerId },
        data: {
          status: shouldRetry ? ReportRequestStatus.PENDING : ReportRequestStatus.FAILED,
          leaseExpiresAt: null,
          leaseOwner: null,
          heartbeatAt: new Date(),
          nextAttemptAt: shouldRetry ? new Date(Date.now() + this.retryDelayMs(current.attempts)) : null,
          errorCode,
          errorMessage: message.slice(0, 1000),
          ...(!shouldRetry ? { completedAt: new Date() } : {})
        }
      });
    } finally {
      heartbeat.stop();
    }
  }

  private async recoverLeases() {
    const now = new Date();
    await this.prisma.reportRequest.updateMany({
      where: { status: ReportRequestStatus.PROCESSING, leaseExpiresAt: { lt: now }, attempts: { gte: 3 } },
      data: {
        status: ReportRequestStatus.FAILED,
        leaseExpiresAt: null,
        leaseOwner: null,
        heartbeatAt: now,
        nextAttemptAt: null,
        errorCode: "LEASE_EXPIRED",
        errorMessage: "El worker excedio el numero de intentos",
        completedAt: now
      }
    });
    await this.prisma.reportRequest.updateMany({
      where: { status: ReportRequestStatus.PROCESSING, leaseExpiresAt: { lt: now }, attempts: { lt: 3 } },
      data: {
        status: ReportRequestStatus.PENDING,
        leaseExpiresAt: null,
        leaseOwner: null,
        heartbeatAt: now,
        nextAttemptAt: new Date(now.getTime() + 5_000),
        errorCode: "LEASE_EXPIRED",
        errorMessage: "Reintentando despues de lease vencido"
      }
    });
  }

  private async expireFiles() {
    const rows = await this.prisma.reportRequest.findMany({
      where: { status: ReportRequestStatus.COMPLETED, expiresAt: { lte: new Date() } },
      select: { id: true, storageKey: true }
    });
    for (const row of rows) {
      await this.storage.remove(row.storageKey);
      await this.prisma.reportRequest.update({
        where: { id: row.id },
        data: { status: ReportRequestStatus.EXPIRED, storageKey: null }
      });
    }
  }

  private async loadActor(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: authUserInclude
    });
    if (!isActiveAuthUser(user)) throw new Error("Solicitante inactivo");
    return serializeAuthUser(user);
  }

  private startHeartbeat(id: string) {
    const intervalMs = Math.max(1_000, Math.min(this.leaseDurationMs() / 3, 30_000));
    const timer = setInterval(() => {
      void this.prisma.reportRequest.updateMany({
        where: { id, status: ReportRequestStatus.PROCESSING, leaseOwner: this.ownerId },
        data: { heartbeatAt: new Date(), leaseExpiresAt: new Date(Date.now() + this.leaseDurationMs()) }
      }).then(({ count }) => {
        if (count !== 1) clearInterval(timer);
      }).catch((error) => this.logger.error(`Report ${id} heartbeat failed`, error));
    }, intervalMs);
    timer.unref();
    return { stop: () => clearInterval(timer) };
  }

  private async publishProgress(id: string, rows: number) {
    const updated = await this.prisma.reportRequest.updateMany({
      where: { id, status: ReportRequestStatus.PROCESSING, leaseOwner: this.ownerId },
      data: {
        progressRows: rows,
        heartbeatAt: new Date(),
        leaseExpiresAt: new Date(Date.now() + this.leaseDurationMs())
      }
    });
    if (updated.count !== 1) throw new LeaseLostError();
  }

  private leaseDurationMs() {
    return Math.max(15_000, Number(this.config.get<string>("REPORT_WORKER_LEASE_MS") || 10 * 60_000));
  }

  private retryDelayMs(attempts: number) {
    return Math.min(60_000, 5_000 * 2 ** Math.max(0, attempts - 1));
  }

  private errorCode(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("LIMIT_EXCEEDED")) return "LIMIT_EXCEEDED";
    return "GENERATION_FAILED";
  }
}

class LeaseLostError extends Error {
  constructor() {
    super("El worker perdio el lease del reporte");
  }
}
