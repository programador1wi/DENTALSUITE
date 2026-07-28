import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PaymentMethodSource, PaymentMethodType, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreatePaymentMethodDto } from "./dto/create-payment-method.dto";
import { ChangePaymentMethodStatusDto, UpdatePaymentMethodDto } from "./dto/update-payment-method.dto";

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    actor: AuthUser,
    query: {
      search?: string;
      active?: string;
      type?: PaymentMethodType;
      allowsRefund?: string;
      acceptsMultipleSettlements?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.paymentMethod.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.active !== undefined ? { isActive: query.active === "true" } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.allowsRefund !== undefined ? { allowsRefund: query.allowsRefund === "true" } : {}),
        ...(query.acceptsMultipleSettlements !== undefined
          ? { acceptsMultipleSettlements: query.acceptsMultipleSettlements === "true" }
          : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search.trim(), mode: "insensitive" } },
                { publicCode: { contains: query.search.trim(), mode: "insensitive" } }
              ]
            }
          : {})
      },
      skip,
      take,
      orderBy: [{ source: "asc" }, { name: "asc" }]
    });
  }

  async findOne(actor: AuthUser, idOrCode: string) {
    const row = await this.prisma.paymentMethod.findFirst({
      where: {
        organizationId: actor.organizationId,
        OR: [{ id: idOrCode }, { publicCode: idOrCode }]
      }
    });
    if (!row) throw new NotFoundException("Payment method not found");
    return row;
  }

  async create(actor: AuthUser, dto: CreatePaymentMethodDto) {
    this.assertConfigurationPermissions(actor, dto);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("El nombre del medio de pago es obligatorio.");
    this.assertCashConfiguration(dto.type, dto.includeInPhysicalCashBalance);

    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const row = await tx.paymentMethod.create({
          data: {
            organizationId: actor.organizationId,
            publicCode: `PM-${randomUUID().slice(0, 10).toUpperCase()}`,
            source: PaymentMethodSource.CUSTOM,
            name,
            type: dto.type,
            isActive: dto.isActive ?? true,
            retentionPercent: new Prisma.Decimal(dto.retentionPercent ?? 0),
            allowsRefund: dto.allowsRefund ?? false,
            acceptsMultipleSettlements: dto.acceptsMultipleSettlements ?? false,
            requiresReference: dto.requiresReference ?? false,
            requiresFinancialInstitution: dto.requiresFinancialInstitution ?? false,
            fiscalCode: dto.fiscalCode?.trim() || null,
            includeInCollectionReports: dto.includeInCollectionReports ?? true,
            includeInPhysicalCashBalance:
              dto.includeInPhysicalCashBalance ?? dto.type === PaymentMethodType.CASH,
            includeInCashFlowReports: dto.includeInCashFlowReports ?? true,
            includeInClosingSummary: dto.includeInClosingSummary ?? true,
            includeInGraphicalReports: dto.includeInGraphicalReports ?? true,
            createdById: actor.id,
            updatedById: actor.id
          }
        });
        await this.audit(tx, actor, "payment_method.created", row.id, undefined, this.snapshot(row));
        return row.id;
      });
      return this.findOne(actor, id);
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdatePaymentMethodDto) {
    const current = await this.findOne(actor, id);
    this.assertConfigurationPermissions(actor, dto);
    if (current.source === PaymentMethodSource.SYSTEM && dto.type && dto.type !== current.type) {
      throw new BadRequestException("El tipo interno de un medio predeterminado no puede modificarse.");
    }
    this.assertCashConfiguration(dto.type ?? current.type, dto.includeInPhysicalCashBalance);
    const expectedVersion = dto.expectedVersion ?? current.version;
    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.paymentMethod.updateMany({
          where: { id: current.id, organizationId: actor.organizationId, version: expectedVersion },
          data: {
            name: dto.name?.trim(),
            type: dto.type,
            retentionPercent:
              dto.retentionPercent === undefined ? undefined : new Prisma.Decimal(dto.retentionPercent),
            allowsRefund: dto.allowsRefund,
            acceptsMultipleSettlements: dto.acceptsMultipleSettlements,
            requiresReference: dto.requiresReference,
            requiresFinancialInstitution: dto.requiresFinancialInstitution,
            fiscalCode: dto.fiscalCode === undefined ? undefined : dto.fiscalCode.trim() || null,
            includeInCollectionReports: dto.includeInCollectionReports,
            includeInPhysicalCashBalance: dto.includeInPhysicalCashBalance,
            includeInCashFlowReports: dto.includeInCashFlowReports,
            includeInClosingSummary: dto.includeInClosingSummary,
            includeInGraphicalReports: dto.includeInGraphicalReports,
            updatedById: actor.id,
            version: { increment: 1 }
          }
        });
        if (!updated.count) {
          throw new ConflictException({
            code: "PAYMENT_METHOD_VERSION_CONFLICT",
            message: "El medio de pago cambió. Actualiza la pantalla antes de guardar."
          });
        }
        const after = await tx.paymentMethod.findUniqueOrThrow({ where: { id: current.id } });
        await this.audit(
          tx,
          actor,
          "payment_method.updated",
          current.id,
          this.snapshot(current),
          this.snapshot(after)
        );
      });
      return this.findOne(actor, current.id);
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async deactivate(actor: AuthUser, id: string, dto: ChangePaymentMethodStatusDto) {
    const current = await this.findOne(actor, id);
    if (!current.isActive) return current;
    const activeCount = await this.prisma.paymentMethod.count({
      where: { organizationId: actor.organizationId, isActive: true }
    });
    if (activeCount <= 1)
      throw new BadRequestException("Debe permanecer al menos un medio de pago habilitado.");
    return this.changeStatus(actor, current, false, dto, "payment_method.disabled");
  }

  async reactivate(actor: AuthUser, id: string, dto: ChangePaymentMethodStatusDto) {
    const current = await this.findOne(actor, id);
    if (current.isActive) return current;
    return this.changeStatus(actor, current, true, dto, "payment_method.reactivated");
  }

  async auditHistory(actor: AuthUser, id: string) {
    const method = await this.findOne(actor, id);
    return this.prisma.auditLog.findMany({
      where: { organizationId: actor.organizationId, entity: "PaymentMethod", entityId: method.id },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  private async changeStatus(
    actor: AuthUser,
    current: Awaited<ReturnType<PaymentMethodsService["findOne"]>>,
    isActive: boolean,
    dto: ChangePaymentMethodStatusDto,
    action: string
  ) {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.paymentMethod.updateMany({
        where: { id: current.id, organizationId: actor.organizationId, version: dto.expectedVersion },
        data: {
          isActive,
          disabledAt: isActive ? null : new Date(),
          disabledById: isActive ? null : actor.id,
          disableReason: isActive ? null : dto.reason?.trim() || null,
          updatedById: actor.id,
          version: { increment: 1 }
        }
      });
      if (!result.count) {
        throw new ConflictException({
          code: "PAYMENT_METHOD_VERSION_CONFLICT",
          message: "El estado del medio cambió. Actualiza la pantalla."
        });
      }
      const after = await tx.paymentMethod.findUniqueOrThrow({ where: { id: current.id } });
      await this.audit(
        tx,
        actor,
        action,
        current.id,
        this.snapshot(current),
        this.snapshot(after),
        dto.reason
      );
    });
    return this.findOne(actor, current.id);
  }

  private assertConfigurationPermissions(
    actor: AuthUser,
    dto: CreatePaymentMethodDto | UpdatePaymentMethodDto
  ) {
    const needs = new Set<string>();
    if (dto.retentionPercent !== undefined) needs.add("payment_methods.configure_retention");
    if (dto.allowsRefund !== undefined) needs.add("payment_methods.configure_refunds");
    if (dto.acceptsMultipleSettlements !== undefined)
      needs.add("payment_methods.configure_multiple_settlements");
    if (
      dto.includeInCollectionReports !== undefined ||
      dto.includeInPhysicalCashBalance !== undefined ||
      dto.includeInCashFlowReports !== undefined ||
      dto.includeInClosingSummary !== undefined ||
      dto.includeInGraphicalReports !== undefined
    )
      needs.add("payment_methods.configure_cash_impact");
    for (const permission of needs) {
      if (!this.hasPermission(actor, permission)) {
        throw new ForbiddenException({
          code: "PAYMENT_METHOD_CONFIGURATION_PERMISSION_REQUIRED",
          message: `No tienes permiso para modificar ${permission}.`
        });
      }
    }
  }

  private assertCashConfiguration(type: PaymentMethodType, physicalCash?: boolean) {
    if (physicalCash && type !== PaymentMethodType.CASH) {
      throw new BadRequestException("Solo un medio de tipo Efectivo puede considerarse efectivo físico.");
    }
  }

  private hasPermission(actor: AuthUser, permission: string) {
    return actor.permissions.includes("system.manage_all") || actor.permissions.includes(permission);
  }

  private snapshot(row: Record<string, any>): Prisma.InputJsonObject {
    return {
      publicCode: row.publicCode,
      name: row.name,
      type: row.type,
      source: row.source,
      isActive: row.isActive,
      retentionPercent: row.retentionPercent?.toString(),
      allowsRefund: row.allowsRefund,
      acceptsMultipleSettlements: row.acceptsMultipleSettlements,
      requiresReference: row.requiresReference,
      requiresFinancialInstitution: row.requiresFinancialInstitution,
      fiscalCode: row.fiscalCode,
      includeInCollectionReports: row.includeInCollectionReports,
      includeInPhysicalCashBalance: row.includeInPhysicalCashBalance,
      includeInCashFlowReports: row.includeInCashFlowReports,
      includeInClosingSummary: row.includeInClosingSummary,
      includeInGraphicalReports: row.includeInGraphicalReports,
      version: row.version
    };
  }

  private audit(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    action: string,
    entityId: string,
    before?: Prisma.InputJsonValue,
    after?: Prisma.InputJsonValue,
    reason?: string
  ) {
    return tx.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        actorUserId: actor.id,
        entity: "PaymentMethod",
        entityId,
        action,
        before,
        after,
        reason: reason?.trim() || undefined,
        correlationId: randomUUID()
      }
    });
  }

  private rethrowUnique(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictException({
        code: "PAYMENT_METHOD_DUPLICATE",
        message: "Ya existe un medio de pago con ese nombre o código."
      });
    }
    throw error;
  }
}
