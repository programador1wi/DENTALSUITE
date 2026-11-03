import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import {
  CashDiscountApplicationStatus,
  CashDiscountStatus,
  PaymentStatus,
  Prisma,
  TreatmentPlanItemStatus
} from "@prisma/client";
import { randomUUID } from "crypto";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { DiscountAuthorizationService } from "../discount-policies/discount-authorization.service";
import {
  CashDiscountPreviewDto,
  CashDiscountReportQueryDto,
  DisableCashDiscountDto,
  ListCashDiscountsQueryDto,
  ReactivateCashDiscountDto,
  UpsertCashDiscountDto
} from "./dto/cash-discount.dto";

type DbClient = PrismaService | Prisma.TransactionClient;

export type CashDiscountPreviewResult = {
  rule: {
    id: string;
    publicCode: string;
    name: string;
    campaign: string | null;
    version: number;
    discountPercent: Prisma.Decimal;
    appliesToClinicalActions: boolean;
    appliesToLaboratoryActions: boolean;
  };
  treatmentPlanId: string;
  originalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  finalAmount: Prisma.Decimal;
  items: Array<{
    treatmentPlanItemId: string;
    expectedVersion: number;
    procedureCode: string;
    procedureName: string;
    itemType: string;
    originalBalance: Prisma.Decimal;
    discountPercent: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    finalAmount: Prisma.Decimal;
    userMaximum: Prisma.Decimal;
    procedureMaximum: Prisma.Decimal;
    effectiveMaximum: Prisma.Decimal;
    eligibilityResult: "ELIGIBLE";
  }>;
};

@Injectable()
export class CashDiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discountAuthorization: DiscountAuthorizationService
  ) {}

  async listRules(actor: AuthUser, query: ListCashDiscountsQueryDto) {
    const now = new Date();
    const search = query.search?.trim();
    const validityWhere =
      query.validity === "CURRENT"
        ? {
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
            ]
          }
        : query.validity === "UPCOMING"
          ? { startsAt: { gt: now } }
          : query.validity === "EXPIRED"
            ? { endsAt: { lt: now } }
            : {};
    return this.prisma.cashDiscountRule.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.branchId
          ? { OR: [{ availableToAllBranches: true }, { branches: { some: { branchId: query.branchId } } }] }
          : {}),
        ...(query.type === "CLINICAL" ? { appliesToClinicalActions: true } : {}),
        ...(query.type === "LABORATORY" ? { appliesToLaboratoryActions: true } : {}),
        ...(query.type === "BOTH"
          ? { appliesToClinicalActions: true, appliesToLaboratoryActions: true }
          : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { publicCode: { contains: search, mode: "insensitive" as const } },
                { campaign: { contains: search, mode: "insensitive" as const } }
              ]
            }
          : {}),
        ...validityWhere
      },
      include: {
        users: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } }
          }
        },
        branches: { include: { branch: { select: { id: true, name: true, status: true } } } },
        _count: { select: { applications: true } }
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });
  }

  async getRule(actor: AuthUser, id: string) {
    const rule = await this.prisma.cashDiscountRule.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        users: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        branches: { include: { branch: { select: { id: true, name: true } } } },
        _count: { select: { applications: true } }
      }
    });
    if (!rule)
      throw new NotFoundException({
        code: "CASH_DISCOUNT_NOT_FOUND",
        message: "Descuento por caja no encontrado."
      });
    return rule;
  }

  async configurationOptions(actor: AuthUser) {
    const [branches, users] = await Promise.all([
      this.prisma.branch.findMany({
        where: { organizationId: actor.organizationId, isActive: true, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      }),
      this.prisma.user.findMany({
        where: { organizationId: actor.organizationId, isActive: true, deletedAt: null },
        include: {
          discountPolicy: true,
          permissions: { include: { permission: true } },
          role: { include: { permissions: { include: { permission: true } } } },
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
      })
    ]);
    const eligibleUsers = users
      .filter((user) => {
        const keys = [
          ...user.permissions.map((entry) => entry.permission.key),
          ...(user.role?.permissions.map((entry) => entry.permission.key) ?? []),
          ...user.roles.flatMap((entry) =>
            entry.role.permissions.map((permission) => permission.permission.key)
          )
        ];
        return (
          (keys.includes("organization.manage_all") ||
            (keys.includes("payments.cash_discounts.apply") && keys.includes("treatment_discount.apply"))) &&
          user.discountPolicy?.active &&
          user.discountPolicy.maximumDiscountPercent.gt(0)
        );
      })
      .map((user) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        maximumDiscountPercent: user.discountPolicy!.maximumDiscountPercent
      }));
    return { branches, users: eligibleUsers };
  }

  async createRule(actor: AuthUser, dto: UpsertCashDiscountDto) {
    await this.validateRuleConfiguration(actor, dto);
    const id = await this.prisma.$transaction(async (tx) => {
      await this.assertNoDuplicate(tx, actor.organizationId, dto);
      const rule = await tx.cashDiscountRule.create({
        data: {
          organizationId: actor.organizationId,
          publicCode: `DC-${randomUUID().slice(0, 8).toUpperCase()}`,
          ...this.ruleValues(dto),
          createdById: actor.id,
          updatedById: actor.id,
          users: dto.availableToAllUsers
            ? undefined
            : { create: [...new Set(dto.userIds ?? [])].map((userId) => ({ userId })) },
          branches: dto.availableToAllBranches
            ? undefined
            : { create: [...new Set(dto.branchIds ?? [])].map((branchId) => ({ branchId })) }
        }
      });
      await this.audit(tx, actor, "cash_discount.created", rule.id, undefined, this.snapshot(rule));
      return rule.id;
    });
    return this.getRule(actor, id);
  }

  async updateRule(actor: AuthUser, id: string, dto: UpsertCashDiscountDto) {
    await this.validateRuleConfiguration(actor, dto);
    const current = await this.getRule(actor, id);
    if (dto.expectedVersion !== undefined && current.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: "CASH_DISCOUNT_VERSION_CONFLICT",
        message: "El descuento cambió. Actualiza la pantalla antes de guardar."
      });
    }
    await this.assertNoDuplicate(this.prisma, actor.organizationId, dto, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.cashDiscountRule.updateMany({
        where: { id, organizationId: actor.organizationId, version: current.version },
        data: { ...this.ruleValues(dto), updatedById: actor.id, version: { increment: 1 } }
      });
      if (!result.count)
        throw new ConflictException({
          code: "CASH_DISCOUNT_VERSION_CONFLICT",
          message: "El descuento cambió. Actualiza la pantalla."
        });
      await tx.cashDiscountRuleUser.deleteMany({ where: { cashDiscountRuleId: id } });
      await tx.cashDiscountRuleBranch.deleteMany({ where: { cashDiscountRuleId: id } });
      if (!dto.availableToAllUsers) {
        await tx.cashDiscountRuleUser.createMany({
          data: [...new Set(dto.userIds ?? [])].map((userId) => ({ cashDiscountRuleId: id, userId }))
        });
      }
      if (!dto.availableToAllBranches) {
        await tx.cashDiscountRuleBranch.createMany({
          data: [...new Set(dto.branchIds ?? [])].map((branchId) => ({ cashDiscountRuleId: id, branchId }))
        });
      }
      const after = await tx.cashDiscountRule.findUniqueOrThrow({ where: { id } });
      await this.audit(tx, actor, "cash_discount.updated", id, this.snapshot(current), this.snapshot(after));
      return after;
    });
    return this.getRule(actor, updated.id);
  }

  async duplicateRule(actor: AuthUser, id: string) {
    const source = await this.getRule(actor, id);
    return this.createRule(actor, {
      name: `${source.name} (copia)`,
      description: source.description ?? undefined,
      campaign: source.campaign ?? undefined,
      discountPercent: Number(source.discountPercent),
      appliesToClinicalActions: source.appliesToClinicalActions,
      appliesToLaboratoryActions: source.appliesToLaboratoryActions,
      availableToAllUsers: source.availableToAllUsers,
      userIds: source.users.map((entry) => entry.userId),
      availableToAllBranches: source.availableToAllBranches,
      branchIds: source.branches.map((entry) => entry.branchId),
      stackableWithAgreements: source.stackableWithAgreements,
      stackableWithOtherDiscounts: source.stackableWithOtherDiscounts,
      startsAt: source.startsAt?.toISOString(),
      endsAt: source.endsAt?.toISOString(),
      status: CashDiscountStatus.DRAFT
    });
  }

  async disableRule(actor: AuthUser, id: string, dto: DisableCashDiscountDto) {
    const current = await this.getRule(actor, id);
    if (current.version !== dto.expectedVersion)
      throw new ConflictException({
        code: "CASH_DISCOUNT_VERSION_CONFLICT",
        message: "El descuento cambió. Actualiza la pantalla."
      });
    const updated = await this.prisma.cashDiscountRule.update({
      where: { id },
      data: {
        status: CashDiscountStatus.DISABLED,
        disabledAt: new Date(),
        disabledById: actor.id,
        disableReason: dto.reason?.trim() || null,
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    await this.audit(
      this.prisma,
      actor,
      "cash_discount.disabled",
      id,
      this.snapshot(current),
      this.snapshot(updated),
      dto.reason
    );
    return this.getRule(actor, id);
  }

  async reactivateRule(actor: AuthUser, id: string, dto: ReactivateCashDiscountDto) {
    const current = await this.getRule(actor, id);
    if (current.version !== dto.expectedVersion)
      throw new ConflictException({
        code: "CASH_DISCOUNT_VERSION_CONFLICT",
        message: "El descuento cambió. Actualiza la pantalla."
      });
    if (current.endsAt && current.endsAt < new Date())
      throw new UnprocessableEntityException({
        code: "CASH_DISCOUNT_EXPIRED",
        message: "No puedes reactivar un descuento vencido. Duplica la regla y define una nueva vigencia."
      });
    const updated = await this.prisma.cashDiscountRule.update({
      where: { id },
      data: {
        status: CashDiscountStatus.ENABLED,
        disabledAt: null,
        disabledById: null,
        disableReason: null,
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    await this.audit(
      this.prisma,
      actor,
      "cash_discount.reactivated",
      id,
      this.snapshot(current),
      this.snapshot(updated)
    );
    return this.getRule(actor, id);
  }

  async getAudit(actor: AuthUser, id: string) {
    await this.getRule(actor, id);
    const applications = await this.prisma.cashDiscountApplication.findMany({
      where: { organizationId: actor.organizationId, cashDiscountRuleId: id },
      select: { id: true }
    });
    const applicationIds = applications.map((application) => application.id);
    return this.prisma.auditLog.findMany({
      where: {
        organizationId: actor.organizationId,
        entity: { in: ["CashDiscountRule", "CashDiscountApplication"] },
        OR: [
          { entityId: id },
          ...(applicationIds.length ? [{ entityId: { in: applicationIds } }] : []),
          { after: { path: ["cashDiscountRuleId"], equals: id } }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  async listAvailableRules(actor: AuthUser, patientId: string, branchId: string) {
    const capability = await this.discountAuthorization.getUserCapability(actor);
    this.assertApplyPermissions(capability.permissionKeys);
    if (capability.effectiveMaximumPercent.lte(0)) return [];
    const now = new Date();
    return this.prisma.cashDiscountRule.findMany({
      where: {
        organizationId: actor.organizationId,
        status: CashDiscountStatus.ENABLED,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          { OR: [{ availableToAllBranches: true }, { branches: { some: { branchId } } }] },
          { OR: [{ availableToAllUsers: true }, { users: { some: { userId: actor.id } } }] }
        ]
      },
      select: {
        id: true,
        publicCode: true,
        name: true,
        description: true,
        campaign: true,
        discountPercent: true,
        appliesToClinicalActions: true,
        appliesToLaboratoryActions: true,
        stackableWithAgreements: true,
        stackableWithOtherDiscounts: true,
        startsAt: true,
        endsAt: true,
        version: true
      },
      orderBy: [{ discountPercent: "asc" }, { name: "asc" }]
    });
  }

  async preview(
    actor: AuthUser,
    patientId: string,
    dto: CashDiscountPreviewDto,
    tx?: Prisma.TransactionClient
  ) {
    try {
      const result = await this.calculatePreview(tx ?? this.prisma, actor, patientId, dto, tx);
      if (!tx)
        await this.audit(
          this.prisma,
          actor,
          "cash_discount.previewed",
          result.rule.id,
          undefined,
          this.previewSnapshot(result)
        );
      return result;
    } catch (error) {
      if (!tx) {
        await this.audit(
          this.prisma,
          actor,
          "cash_discount.preview_rejected",
          dto.cashDiscountRuleId,
          undefined,
          {
            patientId,
            branchId: dto.branchId,
            treatmentPlanId: dto.treatmentPlanId,
            itemIds: dto.items.map((item) => item.treatmentPlanItemId),
            ...this.errorSnapshot(error)
          }
        ).catch(() => undefined);
      }
      throw error;
    }
  }

  async createApplication(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    paymentId: string,
    preview: CashDiscountPreviewResult,
    allocationIds: Map<string, string>
  ) {
    const missingAllocation = preview.items.find(
      (item) => !allocationIds.has(item.treatmentPlanItemId)
    );
    if (missingAllocation) {
      throw new ConflictException({
        code: "CASH_DISCOUNT_ALLOCATION_MISSING",
        message: "No se pudo vincular el descuento con todas las aplicaciones del pago."
      });
    }
    const application = await tx.cashDiscountApplication.create({
      data: {
        organizationId: actor.organizationId,
        branchId: (
          await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { branchId: true } })
        ).branchId,
        cashDiscountRuleId: preview.rule.id,
        cashDiscountRuleVersion: preview.rule.version,
        paymentId,
        treatmentPlanId: preview.treatmentPlanId,
        appliedById: actor.id,
        ruleCodeSnapshot: preview.rule.publicCode,
        ruleNameSnapshot: preview.rule.name,
        campaignSnapshot: preview.rule.campaign,
        discountPercentSnapshot: preview.rule.discountPercent,
        appliesToClinicalSnapshot: preview.rule.appliesToClinicalActions,
        appliesToLaboratorySnapshot: preview.rule.appliesToLaboratoryActions,
        originalAmount: preview.originalAmount,
        discountAmount: preview.discountAmount,
        finalAmount: preview.finalAmount,
        items: {
          create: preview.items.map((item) => ({
            treatmentPlanItemId: item.treatmentPlanItemId,
            paymentAllocationId: allocationIds.get(item.treatmentPlanItemId),
            procedureCodeSnapshot: item.procedureCode,
            procedureNameSnapshot: item.procedureName,
            itemTypeSnapshot: item.itemType,
            originalBalance: item.originalBalance,
            discountPercent: item.discountPercent,
            discountAmount: item.discountAmount,
            finalAmount: item.finalAmount,
            userMaximumSnapshot: item.userMaximum,
            procedureMaximumSnapshot: item.procedureMaximum,
            effectiveMaximumSnapshot: item.effectiveMaximum,
            eligibilityResult: item.eligibilityResult
          }))
        }
      }
    });
    await this.audit(tx, actor, "cash_discount.applied", application.id, undefined, {
      ...this.previewSnapshot(preview),
      paymentId
    });
    return application;
  }

  async markPaymentVoided(tx: Prisma.TransactionClient, actor: AuthUser, paymentId: string) {
    const application = await tx.cashDiscountApplication.findUnique({ where: { paymentId } });
    if (!application) return;
    await tx.cashDiscountApplication.update({
      where: { id: application.id },
      data: { status: CashDiscountApplicationStatus.VOIDED, voidedAt: new Date() }
    });
    await this.audit(
      tx,
      actor,
      "cash_discount.voided",
      application.id,
      { status: application.status },
      { status: CashDiscountApplicationStatus.VOIDED, paymentId }
    );
  }

  async syncRefundStatus(tx: Prisma.TransactionClient, actor: AuthUser, paymentId: string) {
    const application = await tx.cashDiscountApplication.findUnique({ where: { paymentId } });
    if (!application) return;
    const refunds = await tx.refund.aggregate({
      _sum: { amount: true },
      where: { paymentId, status: "PROCESSED" }
    });
    const refunded = new Prisma.Decimal(refunds._sum.amount ?? 0);
    const status = refunded.gte(application.finalAmount)
      ? CashDiscountApplicationStatus.REFUNDED
      : CashDiscountApplicationStatus.PARTIALLY_REFUNDED;
    await tx.cashDiscountApplication.update({
      where: { id: application.id },
      data: { refundedAmount: refunded, status }
    });
    await this.audit(tx, actor, "cash_discount.refund_recorded", application.id, undefined, {
      paymentId,
      refundedAmount: refunded.toFixed(2),
      status
    });
  }

  async report(actor: AuthUser, query: CashDiscountReportQueryDto) {
    const rows = await this.prisma.cashDiscountApplication.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.userId ? { appliedById: query.userId } : {}),
        ...(query.cashDiscountRuleId ? { cashDiscountRuleId: query.cashDiscountRuleId } : {}),
        ...(query.dateFrom || query.dateTo
          ? {
              createdAt: {
                ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
              }
            }
          : {})
      },
      include: {
        branch: { select: { id: true, name: true } },
        payment: {
          select: { paymentNumber: true, patient: { select: { id: true, firstName: true, lastName: true } } }
        },
        items: true
      },
      orderBy: { createdAt: "desc" }
    });
    const nonVoidedRows = rows.filter((row) => row.status !== CashDiscountApplicationStatus.VOIDED);
    const refundedAmount = nonVoidedRows.reduce(
      (sum, row) => sum.add(row.refundedAmount),
      new Prisma.Decimal(0)
    );
    const collectedAmount = nonVoidedRows.reduce(
      (sum, row) => sum.add(row.finalAmount),
      new Prisma.Decimal(0)
    );
    return {
      totals: {
        applications: rows.length,
        activeApplications: nonVoidedRows.length,
        voidedApplications: rows.length - nonVoidedRows.length,
        originalAmount: nonVoidedRows.reduce(
          (sum, row) => sum.add(row.originalAmount),
          new Prisma.Decimal(0)
        ),
        discountAmount: nonVoidedRows.reduce(
          (sum, row) => sum.add(row.discountAmount),
          new Prisma.Decimal(0)
        ),
        collectedAmount,
        refundedAmount,
        netCollectedAmount: collectedAmount.sub(refundedAmount)
      },
      rows
    };
  }

  private async calculatePreview(
    db: DbClient,
    actor: AuthUser,
    patientId: string,
    dto: CashDiscountPreviewDto,
    tx?: Prisma.TransactionClient
  ): Promise<CashDiscountPreviewResult> {
    const capability = await this.discountAuthorization.getUserCapability(actor, tx);
    this.assertApplyPermissions(capability.permissionKeys);
    const rule = await db.cashDiscountRule.findFirst({
      where: { id: dto.cashDiscountRuleId, organizationId: actor.organizationId },
      include: { users: true, branches: true }
    });
    if (!rule) this.fail("CASH_DISCOUNT_NOT_FOUND", "Descuento por caja no encontrado.");
    const now = new Date();
    if (rule.status !== CashDiscountStatus.ENABLED)
      this.fail("CASH_DISCOUNT_DISABLED", "El descuento seleccionado está deshabilitado.");
    if (rule.startsAt && rule.startsAt > now)
      this.fail("CASH_DISCOUNT_NOT_YET_ACTIVE", "El descuento todavía no inicia su vigencia.");
    if (rule.endsAt && rule.endsAt < now)
      this.fail("CASH_DISCOUNT_EXPIRED", "El descuento seleccionado está vencido.");
    if (!rule.availableToAllUsers && !rule.users.some((entry) => entry.userId === actor.id))
      this.fail("CASH_DISCOUNT_USER_NOT_ALLOWED", "Este descuento no está autorizado para tu usuario.");
    if (!rule.availableToAllBranches && !rule.branches.some((entry) => entry.branchId === dto.branchId))
      this.fail(
        "CASH_DISCOUNT_BRANCH_NOT_ALLOWED",
        "Este descuento no está autorizado en la sucursal seleccionada."
      );

    const ids = [...new Set(dto.items.map((item) => item.treatmentPlanItemId))];
    const items = await db.treatmentPlanItem.findMany({
      where: {
        id: { in: ids },
        treatmentPlanId: dto.treatmentPlanId,
        treatmentPlan: {
          organizationId: actor.organizationId,
          patientId,
          branchId: dto.branchId,
          isAlternative: false
        }
      },
      include: {
        procedure: true,
        paymentAllocations: {
          where: {
            payment: {
              status: {
                in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED]
              }
            }
          }
        }
      }
    });
    if (items.length !== ids.length)
      this.fail(
        "CASH_DISCOUNT_NOT_APPLICABLE_TO_ITEM",
        "Una o más prestaciones no pertenecen al plan, paciente o sucursal seleccionados."
      );
    const requestById = new Map(dto.items.map((item) => [item.treatmentPlanItemId, item]));
    const calculated: CashDiscountPreviewResult["items"] = [];
    for (const item of items) {
      if (item.status === TreatmentPlanItemStatus.CANCELLED)
        this.fail(
          "CASH_DISCOUNT_NOT_APPLICABLE_TO_ITEM",
          `La prestación ${item.procedure.name} está cancelada.`
        );
      const request = requestById.get(item.id)!;
      if (request.expectedVersion !== undefined && request.expectedVersion !== item.version)
        throw new ConflictException({
          code: "CASH_DISCOUNT_VERSION_CONFLICT",
          message: "El saldo cambió mientras preparabas el cobro. Actualiza la información."
        });
      const settled = item.paymentAllocations.reduce(
        (sum, allocation) => sum.add(allocation.amount).add(allocation.settlementDiscountAmount),
        new Prisma.Decimal(0)
      );
      const outstanding = item.total.sub(settled).toDecimalPlaces(2);
      if (
        outstanding.lte(0) ||
        !outstanding.equals(new Prisma.Decimal(request.outstandingAmount).toDecimalPlaces(2))
      )
        throw new ConflictException({
          code: "CASH_DISCOUNT_VERSION_CONFLICT",
          message: `El saldo de ${item.procedure.name} cambió. Actualiza antes de continuar.`
        });
      if (!rule.stackableWithOtherDiscounts && (item.discount.gt(0) || item.discountAmount.gt(0)))
        this.fail(
          "CASH_DISCOUNT_NOT_STACKABLE",
          `La prestación ${item.procedure.name} ya tiene un descuento comercial y la promoción no es acumulable.`
        );
      if (!rule.stackableWithAgreements && (item.agreementId || item.agreementDiscountAmount?.gt(0)))
        this.fail(
          "CASH_DISCOUNT_NOT_STACKABLE",
          `La prestación ${item.procedure.name} tiene convenio y la promoción no es compatible.`
        );
      const laboratory = item.procedure.requiresLab || item.laboratoryCostSnapshot.gt(0);
      if (laboratory && !rule.appliesToLaboratoryActions)
        this.fail(
          "CASH_DISCOUNT_NOT_APPLICABLE_TO_ITEM",
          `La promoción no aplica al componente de laboratorio de ${item.procedure.name}.`
        );
      if (!laboratory && !rule.appliesToClinicalActions)
        this.fail(
          "CASH_DISCOUNT_NOT_APPLICABLE_TO_ITEM",
          `La promoción no aplica a la prestación clínica ${item.procedure.name}.`
        );
      const authorization = await this.discountAuthorization.validateRequestedDiscount({
        actor,
        requestedPercent: rule.discountPercent,
        procedureAllowsDiscount: item.allowsDiscountSnapshot,
        procedureMaximumPercent: item.maximumDiscountPercentSnapshot,
        tx
      });
      const discountAmount = outstanding.mul(rule.discountPercent).div(100).toDecimalPlaces(2);
      const finalAmount = outstanding.sub(discountAmount).toDecimalPlaces(2);
      if (finalAmount.lte(0))
        this.fail(
          "CASH_DISCOUNT_ZERO_PAYMENT_NOT_SUPPORTED",
          "Una promoción de 100 % no puede confirmarse como pago porque no existe importe a recaudar."
        );
      calculated.push({
        treatmentPlanItemId: item.id,
        expectedVersion: item.version,
        procedureCode: item.procedure.code,
        procedureName: item.procedure.name,
        itemType: laboratory ? "LABORATORY" : "CLINICAL",
        originalBalance: outstanding,
        discountPercent: rule.discountPercent,
        discountAmount,
        finalAmount,
        userMaximum: authorization.userMaximumPercent,
        procedureMaximum: authorization.procedureMaximumPercent,
        effectiveMaximum: authorization.effectiveMaximumPercent,
        eligibilityResult: "ELIGIBLE"
      });
    }
    const originalAmount = calculated.reduce(
      (sum, item) => sum.add(item.originalBalance),
      new Prisma.Decimal(0)
    );
    const discountAmount = calculated.reduce(
      (sum, item) => sum.add(item.discountAmount),
      new Prisma.Decimal(0)
    );
    const finalAmount = calculated.reduce((sum, item) => sum.add(item.finalAmount), new Prisma.Decimal(0));
    return {
      rule: {
        id: rule.id,
        publicCode: rule.publicCode,
        name: rule.name,
        campaign: rule.campaign,
        version: rule.version,
        discountPercent: rule.discountPercent,
        appliesToClinicalActions: rule.appliesToClinicalActions,
        appliesToLaboratoryActions: rule.appliesToLaboratoryActions
      },
      treatmentPlanId: dto.treatmentPlanId,
      originalAmount,
      discountAmount,
      finalAmount,
      items: calculated
    };
  }

  private async validateRuleConfiguration(actor: AuthUser, dto: UpsertCashDiscountDto) {
    if (!dto.name.trim()) throw new BadRequestException("El nombre es obligatorio.");
    if (!dto.appliesToClinicalActions && !dto.appliesToLaboratoryActions)
      throw new BadRequestException("Selecciona al menos un tipo de prestación.");
    if (!dto.availableToAllUsers && !dto.userIds?.length)
      throw new BadRequestException("Selecciona al menos un usuario autorizado.");
    if (!dto.availableToAllBranches && !dto.branchIds?.length)
      throw new BadRequestException("Selecciona al menos una sucursal.");
    if (dto.startsAt && dto.endsAt && new Date(dto.endsAt) <= new Date(dto.startsAt))
      throw new BadRequestException("La fecha final debe ser posterior a la inicial.");
    if (!dto.availableToAllUsers) {
      const userIds = [...new Set(dto.userIds ?? [])];
      const users = await this.prisma.user.count({
        where: { id: { in: userIds }, organizationId: actor.organizationId, isActive: true, deletedAt: null }
      });
      if (users !== userIds.length)
        throw new BadRequestException(
          "Uno o más usuarios no están activos o no pertenecen a la organización."
        );
    }
    if (!dto.availableToAllBranches) {
      const branchIds = [...new Set(dto.branchIds ?? [])];
      const branches = await this.prisma.branch.count({
        where: {
          id: { in: branchIds },
          organizationId: actor.organizationId,
          isActive: true,
          deletedAt: null
        }
      });
      if (branches !== branchIds.length)
        throw new BadRequestException(
          "Una o más sucursales no están activas o no pertenecen a la organización."
        );
    }
  }

  private async assertNoDuplicate(
    db: DbClient,
    organizationId: string,
    dto: UpsertCashDiscountDto,
    excludeId?: string
  ) {
    if (dto.status !== CashDiscountStatus.ENABLED) return;
    const duplicate = await db.cashDiscountRule.findFirst({
      where: {
        organizationId,
        id: excludeId ? { not: excludeId } : undefined,
        status: CashDiscountStatus.ENABLED,
        name: { equals: dto.name.trim(), mode: "insensitive" },
        discountPercent: new Prisma.Decimal(dto.discountPercent)
      },
      select: { id: true }
    });
    if (duplicate)
      throw new ConflictException({
        code: "CASH_DISCOUNT_DUPLICATE",
        message: "Ya existe un descuento habilitado con el mismo nombre y porcentaje."
      });
  }

  private ruleValues(dto: UpsertCashDiscountDto) {
    return {
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      campaign: dto.campaign?.trim() || null,
      discountPercent: new Prisma.Decimal(dto.discountPercent),
      appliesToClinicalActions: dto.appliesToClinicalActions,
      appliesToLaboratoryActions: dto.appliesToLaboratoryActions,
      availableToAllUsers: dto.availableToAllUsers,
      availableToAllBranches: dto.availableToAllBranches,
      stackableWithAgreements: dto.stackableWithAgreements ?? false,
      stackableWithOtherDiscounts: dto.stackableWithOtherDiscounts ?? false,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      status: dto.status
    };
  }

  private assertApplyPermissions(keys: string[]) {
    const permissions = new Set(keys);
    if (permissions.has("organization.manage_all")) return;
    if (!permissions.has("payments.cash_discounts.apply") || !permissions.has("treatment_discount.apply"))
      throw new ForbiddenException({
        code: "CASH_DISCOUNT_PERMISSION_REQUIRED",
        message: "Necesitas permisos para aplicar descuentos de caja y descuentos de tratamientos."
      });
  }

  private fail(code: string, message: string): never {
    throw new UnprocessableEntityException({ code, message });
  }

  private snapshot(rule: {
    publicCode?: string;
    name?: string;
    discountPercent?: Prisma.Decimal;
    status?: CashDiscountStatus;
    version?: number;
    updatedAt?: Date;
  }) {
    return {
      publicCode: rule.publicCode,
      name: rule.name,
      discountPercent: rule.discountPercent?.toString(),
      status: rule.status,
      version: rule.version,
      updatedAt: rule.updatedAt?.toISOString()
    };
  }

  private previewSnapshot(preview: CashDiscountPreviewResult) {
    return {
      cashDiscountRuleId: preview.rule.id,
      ruleVersion: preview.rule.version,
      treatmentPlanId: preview.treatmentPlanId,
      originalAmount: preview.originalAmount.toFixed(2),
      discountAmount: preview.discountAmount.toFixed(2),
      finalAmount: preview.finalAmount.toFixed(2),
      itemIds: preview.items.map((item) => item.treatmentPlanItemId)
    };
  }

  private async audit(
    db: DbClient,
    actor: AuthUser,
    action: string,
    entityId: string,
    before?: Prisma.InputJsonValue,
    after?: Prisma.InputJsonValue,
    reason?: string
  ) {
    await db.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        actorUserId: actor.id,
        entity:
          action.includes("applied") || action.includes("voided") || action.includes("refund")
            ? "CashDiscountApplication"
            : "CashDiscountRule",
        entityId,
        action,
        before,
        after,
        reason,
        correlationId: randomUUID()
      }
    });
  }

  private errorSnapshot(error: unknown): { code: string; message: string } {
    if (error && typeof error === "object") {
      const response =
        "getResponse" in error && typeof error.getResponse === "function" ? error.getResponse() : null;
      if (response && typeof response === "object") {
        const record = response as { code?: unknown; message?: unknown };
        return {
          code: typeof record.code === "string" ? record.code : "CASH_DISCOUNT_PREVIEW_REJECTED",
          message: typeof record.message === "string" ? record.message : "Cash discount preview rejected"
        };
      }
      if ("message" in error && typeof error.message === "string") {
        return { code: "CASH_DISCOUNT_PREVIEW_REJECTED", message: error.message };
      }
    }
    return { code: "CASH_DISCOUNT_PREVIEW_REJECTED", message: "Cash discount preview rejected" };
  }
}
