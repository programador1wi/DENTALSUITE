import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ReportRequestStatus } from "@prisma/client";
import { hasEffectivePermission } from "@dentalwarner/shared";
import { randomUUID } from "node:crypto";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateExcelReportRequestDto } from "./dto/reports.dto";
import { excelReportDefinitions } from "./reports-catalog";
import { ReportStorageService } from "./report-storage.service";
import { PriceListReportService } from "./price-list-report.service";

type BranchWindow = { branchId: string; timezone: string; startUtc?: string; endExclusiveUtc?: string };

@Injectable()
export class ReportRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ReportStorageService,
    private readonly priceListReport: PriceListReportService
  ) {}

  async create(actor: AuthUser, dto: CreateExcelReportRequestDto) {
    const definition = excelReportDefinitions.find((item) => item.code === dto.reportCode);
    if (!definition || !definition.surfaces?.includes(dto.surface ?? "REQUEST")) {
      throw new NotFoundException("Reporte no encontrado");
    }
    if (!definition.enabled || !definition.handler) {
      throw new BadRequestException({
        code: "REPORT_UNAVAILABLE",
        message: definition.unavailableReason ?? "El generador no está disponible."
      });
    }
    this.assertPermissions(actor, definition.requiredPermissions ?? [definition.permission, "reports.export"]);
    if ((dto.surface ?? "REQUEST") === "PERIOD" && dto.format && dto.format !== "xlsx") {
      throw new BadRequestException("Descargas por periodo admite exclusivamente XLSX");
    }

    let parameters = { ...(dto.parameters ?? {}) } as Record<string, unknown>;
    if (dto.dateFrom && !parameters.dateFrom) parameters.dateFrom = dto.dateFrom;
    if (dto.dateTo && !parameters.dateTo) parameters.dateTo = dto.dateTo;
    if (dto.branchId && !parameters.branchId) parameters.branchId = dto.branchId;
    this.assertRequiredParameters(definition, parameters);
    if (definition.code === "PRICE_LIST") {
      parameters = await this.priceListReport.prepareSelection(actor, parameters);
    }
    const branchIds = await this.resolveBranches(actor, parameters);
    const windows = await this.resolveWindows(branchIds, definition.temporalMode ?? "RANGE", parameters);
    const idempotencyKey = dto.idempotencyKey?.trim() || randomUUID();
    const row = await this.prisma.reportRequest.upsert({
      where: {
        organizationId_requestedById_idempotencyKey: {
          organizationId: actor.organizationId,
          requestedById: actor.id,
          idempotencyKey
        }
      },
      create: {
        organizationId: actor.organizationId,
        requestedById: actor.id,
        reportCode: definition.code,
        reportNameSnapshot: definition.name,
        categorySnapshot: definition.category,
        surface: dto.surface ?? "REQUEST",
        format: (dto.surface ?? "REQUEST") === "PERIOD" ? "xlsx" : dto.format ?? "xlsx",
        parametersJson: parameters as Prisma.InputJsonValue,
        resolvedBranchIds: branchIds,
        branchWindowsJson: windows as unknown as Prisma.InputJsonValue,
        idempotencyKey
      },
      update: {}
    });
    return this.serialize(row);
  }

  async list(actor: AuthUser, query: { status?: string; category?: string; search?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    if (query.status && !Object.values(ReportRequestStatus).includes(query.status as ReportRequestStatus)) {
      throw new BadRequestException("Estado de solicitud invalido");
    }
    const canManage = hasEffectivePermission(actor.permissions, "reports.management.read");
    const where: Prisma.ReportRequestWhereInput = {
      organizationId: actor.organizationId,
      ...(!canManage ? { requestedById: actor.id } : {}),
      ...(query.status ? { status: query.status as ReportRequestStatus } : {}),
      ...(query.category ? { categorySnapshot: query.category } : {}),
      ...(query.search
        ? { OR: [{ reportNameSnapshot: { contains: query.search, mode: "insensitive" } }, { reportCode: { contains: query.search, mode: "insensitive" } }] }
        : {})
    };
    const [rows, total] = await Promise.all([
      this.prisma.reportRequest.findMany({
        where,
        include: { requestedBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.reportRequest.count({ where })
    ]);
    return { rows: rows.map((row) => this.serialize(row)), total, page, pageSize };
  }

  async get(actor: AuthUser, id: string) {
    return this.serialize(await this.findAccessible(actor, id));
  }

  async download(actor: AuthUser, id: string) {
    const row = await this.findAccessible(actor, id);
    if (row.status !== "COMPLETED" || !row.storageKey || !row.fileName) {
      throw new BadRequestException("El reporte aun no esta disponible");
    }
    if (row.expiresAt && row.expiresAt <= new Date()) throw new BadRequestException("El reporte expiro");
    const definition = excelReportDefinitions.find((item) => item.code === row.reportCode);
    if (!definition) throw new NotFoundException("Definicion de reporte no encontrada");
    this.assertPermissions(actor, definition.requiredPermissions ?? [definition.permission, "reports.export"]);
    return {
      bytes: await this.storage.read(row.storageKey),
      fileName: row.fileName,
      mimeType: row.mimeType ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };
  }

  async latest(actor: AuthUser, reportCode: string) {
    const row = await this.prisma.reportRequest.findFirst({
      where: {
        organizationId: actor.organizationId,
        requestedById: actor.id,
        reportCode,
        status: "COMPLETED",
        expiresAt: { gt: new Date() }
      },
      orderBy: { completedAt: "desc" }
    });
    return row ? this.serialize(row) : null;
  }

  private async findAccessible(actor: AuthUser, id: string) {
    const canManage = hasEffectivePermission(actor.permissions, "reports.management.read");
    const row = await this.prisma.reportRequest.findFirst({
      where: { id, organizationId: actor.organizationId, ...(!canManage ? { requestedById: actor.id } : {}) },
      include: { requestedBy: { select: { id: true, firstName: true, lastName: true } } }
    });
    if (!row) throw new NotFoundException("Solicitud de reporte no encontrada");
    return row;
  }

  private assertPermissions(actor: AuthUser, permissions: string[]) {
    const missing = permissions.find((permission) => !hasEffectivePermission(actor.permissions, permission));
    if (missing) throw new ForbiddenException("No tienes permiso para generar este reporte");
  }

  private assertRequiredParameters(
    definition: (typeof excelReportDefinitions)[number],
    parameters: Record<string, unknown>
  ) {
    const missing = definition.parameters.some((parameter) => {
      if (!parameter.required) return false;
      const value = parameters[parameter.key] ?? parameter.defaultValue;
      return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    });
    if (missing) throw new BadRequestException("Selecciona los campos obligatorios.");
  }

  private async resolveBranches(actor: AuthUser, parameters: Record<string, unknown>) {
    const requested = Array.isArray(parameters.branchIds)
      ? parameters.branchIds.map(String)
      : parameters.branchId
        ? [String(parameters.branchId)]
        : actor.branchIds;
    const unique = [...new Set(requested)];
    if (!unique.length || unique.some((id) => !actor.branchIds.includes(id))) {
      throw new ForbiddenException("Sucursal fuera del alcance autorizado");
    }
    const rows = await this.prisma.branch.findMany({
      where: { id: { in: unique }, organizationId: actor.organizationId, status: "ACTIVE", isActive: true, deletedAt: null },
      select: { id: true }
    });
    if (rows.length !== unique.length) throw new ForbiddenException("Sucursal no disponible");
    return unique;
  }

  private async resolveWindows(branchIds: string[], mode: string, parameters: Record<string, unknown>) {
    const branches = await this.prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, timezone: true } });
    if (mode === "CURRENT") return branches.map((branch) => ({ branchId: branch.id, timezone: branch.timezone ?? "America/Mexico_City" }));
    const dateFrom = String(parameters.dateFrom ?? "");
    const dateTo = String(parameters.dateTo ?? parameters.dateFrom ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo) || dateFrom > dateTo) {
      throw new BadRequestException("Selecciona un rango de fechas valido");
    }
    const next = new Date(`${dateTo}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const nextDate = next.toISOString().slice(0, 10);
    return branches.map((branch): BranchWindow => {
      const timezone = branch.timezone ?? "America/Mexico_City";
      return {
        branchId: branch.id,
        timezone,
        startUtc: this.zonedLocalToUtc(dateFrom, timezone).toISOString(),
        endExclusiveUtc: this.zonedLocalToUtc(nextDate, timezone).toISOString()
      };
    });
  }

  private zonedLocalToUtc(date: string, timezone: string) {
    const guess = new Date(`${date}T00:00:00.000Z`);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(guess);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const represented = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return new Date(guess.getTime() - (represented - guess.getTime()));
  }

  private serialize(row: Record<string, unknown>) {
    const safe = { ...row };
    delete safe.storageKey;
    delete safe.checksum;
    const requestedBy = row.requestedBy as
      | { firstName: string; lastName: string }
      | null
      | undefined;
    return {
      ...safe,
      reportName: row.reportNameSnapshot,
      category: row.categorySnapshot,
      parameters: row.parametersJson,
      requestedAt: row.createdAt,
      requestedBy: requestedBy
        ? `${requestedBy.firstName} ${requestedBy.lastName}`.trim()
        : row.requestedById,
      file: null
    };
  }
}
