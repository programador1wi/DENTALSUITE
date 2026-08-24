import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ReportRequestStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuthUser } from "../../common/types/auth-user";
import { ReportExportFormat } from "./dto/reports.dto";
import { ReportStorageService } from "./report-storage.service";
import { ReportsService } from "./reports.service";

@Injectable()
export class ReportWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly storage: ReportStorageService,
    private readonly config: ConfigService
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
    const lease = new Date(Date.now() + 10 * 60_000);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "ReportRequest"
      SET "status" = 'PROCESSING'::"ReportRequestStatus",
          "startedAt" = COALESCE("startedAt", NOW()),
          "leaseExpiresAt" = ${lease},
          "attempts" = "attempts" + 1,
          "updatedAt" = NOW()
      WHERE "id" = (
        SELECT "id" FROM "ReportRequest"
        WHERE "status" = 'PENDING'::"ReportRequestStatus"
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id"
    `;
    return rows[0]?.id;
  }

  private async process(id: string) {
    const request = await this.prisma.reportRequest.findUnique({ where: { id } });
    if (!request) return;
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
      const result = await this.reports.createExcelRequest(actor, {
        reportCode: request.reportCode,
        format,
        parameters: {
          ...(request.parametersJson as Record<string, unknown>),
          branchIds: request.resolvedBranchIds,
          branchWindows: request.branchWindowsJson
        },
        surface: request.surface as "REQUEST" | "PERIOD"
      });
      if (!result.file?.base64) throw new Error(result.errorMessage || "El generador no produjo un archivo");
      const bytes = Buffer.from(result.file.base64, "base64");
      const stored = await this.storage.store(request.organizationId, request.id, bytes);
      await this.prisma.reportRequest.update({
        where: { id },
        data: {
          status: ReportRequestStatus.COMPLETED,
          completedAt: new Date(),
          leaseExpiresAt: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
          rowCount: result.rowCount,
          fileName: result.fileName ?? result.file.fileName,
          mimeType: result.mimeType ?? result.file.mimeType,
          fileSize: stored.fileSize,
          storageKey: stored.storageKey,
          checksum: stored.checksum,
          errorMessage: null
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible generar el reporte";
      const current = await this.prisma.reportRequest.findUnique({ where: { id }, select: { attempts: true } });
      await this.prisma.reportRequest.update({
        where: { id },
        data: {
          status: current && current.attempts < 3 ? ReportRequestStatus.PENDING : ReportRequestStatus.FAILED,
          leaseExpiresAt: null,
          errorMessage: message.slice(0, 1000),
          ...(current && current.attempts >= 3 ? { completedAt: new Date() } : {})
        }
      });
    }
  }

  private async recoverLeases() {
    const expired = await this.prisma.reportRequest.findMany({
      where: { status: ReportRequestStatus.PROCESSING, leaseExpiresAt: { lt: new Date() } },
      select: { id: true, attempts: true }
    });
    await Promise.all(expired.map((row) => this.prisma.reportRequest.update({
      where: { id: row.id },
      data: {
        status: row.attempts >= 3 ? ReportRequestStatus.FAILED : ReportRequestStatus.PENDING,
        leaseExpiresAt: null,
        errorMessage: row.attempts >= 3 ? "El worker excedio el numero de intentos" : "Reintentando despues de lease vencido"
      }
    })));
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
      include: {
        organization: true,
        role: { include: { permissions: { include: { permission: true } } } },
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        permissions: { include: { permission: true } },
        branches: { include: { branch: true } }
      }
    });
    if (!user || !user.isActive || user.status !== "ACTIVE" || user.deletedAt) throw new Error("Solicitante inactivo");
    const permissions = new Set<string>();
    for (const entry of [...user.permissions, ...(user.role?.permissions ?? []), ...user.roles.flatMap((item) => item.role.permissions)]) {
      if (entry.permission.isActive && !entry.permission.deletedAt) permissions.add(entry.permission.key ?? entry.permission.code ?? "");
    }
    const roleIds = [...new Set([...(user.role ? [user.role.id] : []), ...user.roles.map((item) => item.role.id)])];
    const roleNames = [...new Set([...(user.role ? [user.role.name] : []), ...user.roles.map((item) => item.role.name)])];
    return {
      id: user.id,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      organization: user.organization,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      roleIds,
      roleNames,
      permissions: [...permissions].filter(Boolean),
      branchIds: user.branches.map((item) => item.branchId),
      branches: user.branches.map((item) => ({ id: item.branch.id, name: item.branch.name, code: item.branch.code, isPrimary: item.isPrimary })),
      status: user.status
    };
  }
}
