import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FamilyPolicyPaymentStatus,
  FamilyPolicyStatus,
  FamilyPolicyUsage,
  FamilyPolicyUsageStatus,
  LedgerEntryStatus,
  LedgerEntryType,
  LedgerSourceType,
  PaymentStatus,
  PolicyModality,
  Prisma,
} from "@prisma/client";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import {
  CancelFamilyPolicyDto,
  CreateFamilyPolicyDto,
  CreatePolicyProductCoverageDto,
  ApplyFamilyPolicyCoverageDto,
  AddFamilyPolicyMemberDto,
  ListPatientPoliciesQueryDto,
  RegisterFamilyPolicyPaymentDto,
  ReverseFamilyPolicyUsageDto,
  RemoveFamilyPolicyMemberDto,
  SimulateFamilyPolicyCoverageDto,
  ReplaceFamilyPolicyMembersDto,
} from "./dto/family-policy.dto";

const POLICY_LIST_INCLUDE = {
  policyProduct: true,
  familyGroup: {
    select: {
      id: true,
      familyCode: true,
      name: true,
      status: true,
      holderPatientId: true,
    },
  },
  holderPatient: { select: { firstName: true, lastName: true } },
  brand: { select: { name: true } },
  branch: { select: { name: true, brand: { select: { name: true } } } },
  members: {
    include: {
      patient: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { addedAt: "asc" as const },
  },
  payments: { orderBy: { paidAt: "desc" as const } },
  coverages: { where: { isActive: true }, select: { id: true } },
  usages: {
    where: { status: FamilyPolicyUsageStatus.APPLIED },
    select: { patientId: true, coveredAmount: true, copayAmount: true },
  },
} satisfies Prisma.FamilyPolicyInclude;

const POLICY_DETAIL_INCLUDE = {
  policyProduct: true,
  familyGroup: {
    select: { familyCode: true, name: true, status: true },
  },
  holderPatient: {
    select: {
      firstName: true,
      lastName: true,
      documentType: true,
      documentNumber: true,
      phone: true,
      email: true,
      status: true,
    },
  },
  brand: { select: { name: true } },
  branch: { select: { name: true, brand: { select: { name: true } } } },
  members: {
    include: {
      patient: {
        select: {
          firstName: true,
          lastName: true,
          birthDate: true,
          status: true,
        },
      },
    },
    orderBy: { addedAt: "asc" as const },
  },
  payments: {
    include: {
      payment: {
        select: {
          paymentNumber: true,
          status: true,
          reference: true,
          paidAt: true,
        },
      },
    },
    orderBy: { paidAt: "desc" as const },
  },
  coverages: {
    include: {
      procedure: { select: { code: true, name: true } },
      procedureCategory: { select: { name: true } },
      usages: {
        select: {
          patientId: true,
          status: true,
          coveredAmount: true,
          copayAmount: true,
          quantity: true,
        },
      },
    },
    orderBy: { name: "asc" as const },
  },
  usages: {
    include: {
      patient: { select: { firstName: true, lastName: true } },
      procedure: { select: { code: true, name: true } },
      treatmentPlan: { select: { name: true, status: true } },
      appliedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { appliedAt: "desc" as const },
  },
  documents: {
    include: {
      fileAttachment: {
        select: { originalName: true, url: true, mimeType: true },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.FamilyPolicyInclude;

type PolicyListRecord = Prisma.FamilyPolicyGetPayload<{
  include: typeof POLICY_LIST_INCLUDE;
}>;
type PolicyDetailRecord = Prisma.FamilyPolicyGetPayload<{
  include: typeof POLICY_DETAIL_INCLUDE;
}>;

@Injectable()
export class FamilyPoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async listProducts(actor: AuthUser) {
    await this.ensureProducts(actor.organizationId);
    return this.prisma.policyProduct.findMany({
      where: { organizationId: actor.organizationId, status: "ACTIVE" },
      orderBy: { maximumMembers: "asc" },
    });
  }

  async createProductCoverage(
    actor: AuthUser,
    productId: string,
    dto: CreatePolicyProductCoverageDto,
  ) {
    if (Boolean(dto.procedureId) === Boolean(dto.procedureCategoryId)) {
      throw new BadRequestException(
        "Selecciona un procedimiento o una categoría, no ambos",
      );
    }
    if (dto.coverageType === "PERCENTAGE" && dto.coverageValue > 100) {
      throw new BadRequestException(
        "La cobertura porcentual no puede superar 100 %",
      );
    }
    const product = await this.prisma.policyProduct.findFirst({
      where: {
        id: productId,
        organizationId: actor.organizationId,
        status: "ACTIVE",
      },
    });
    if (!product)
      throw new NotFoundException("Producto de póliza no encontrado");
    if (dto.procedureId) {
      const procedure = await this.prisma.procedure.findFirst({
        where: {
          id: dto.procedureId,
          organizationId: actor.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!procedure)
        throw new NotFoundException("Procedimiento no encontrado");
    }
    if (dto.procedureCategoryId) {
      const category = await this.prisma.procedureCategory.findFirst({
        where: {
          id: dto.procedureCategoryId,
          organizationId: actor.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!category) throw new NotFoundException("Categoría no encontrada");
    }
    const coverage = await this.prisma.policyProductCoverage.create({
      data: {
        organizationId: actor.organizationId,
        policyProductId: product.id,
        procedureId: dto.procedureId,
        procedureCategoryId: dto.procedureCategoryId,
        name: dto.name.trim(),
        coverageType: dto.coverageType,
        coverageValue: dto.coverageType === "FULL" ? 100 : dto.coverageValue,
        copayAmount: dto.copayAmount,
        annualAmountLimit: dto.annualAmountLimit,
        annualUseLimit: dto.annualUseLimit,
        waitingPeriodDays: dto.waitingPeriodDays ?? 0,
        requiresAuthorization: dto.requiresAuthorization ?? false,
        exclusions: dto.exclusions?.trim(),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "PolicyProduct",
        entityId: product.id,
        action: "create_coverage_rule",
        after: {
          coverageId: coverage.id,
          name: coverage.name,
          coverageType: coverage.coverageType,
          coverageValue: coverage.coverageValue,
        },
      },
    });
    return {
      name: coverage.name,
      coverageType: coverage.coverageType,
      coverageValue: coverage.coverageValue,
      annualAmountLimit: coverage.annualAmountLimit,
      annualUseLimit: coverage.annualUseLimit,
      waitingPeriodDays: coverage.waitingPeriodDays,
      requiresAuthorization: coverage.requiresAuthorization,
    };
  }

  async listForPatient(
    actor: AuthUser,
    patientId: string,
    query: ListPatientPoliciesQueryDto = {},
  ) {
    await this.ensurePatient(actor, patientId);
    await this.refreshTemporalStatuses(actor.organizationId);
    const historyStatuses: FamilyPolicyStatus[] = [
      FamilyPolicyStatus.EXPIRED,
      FamilyPolicyStatus.CANCELLED,
      FamilyPolicyStatus.REPLACED,
    ];
    const policies = await this.prisma.familyPolicy.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        ...(query.status
          ? { status: query.status }
          : query.includeHistory
            ? {}
            : { status: { notIn: historyStatuses } }),
        ...(query.type ? { policyProduct: { modality: query.type } } : {}),
        OR: [
          { holderPatientId: patientId },
          { members: { some: { patientId } } },
        ],
      },
      include: POLICY_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return {
      items: policies.map((policy) =>
        this.toPatientPolicySummary(policy, patientId),
      ),
      summary: {
        active: policies.filter(
          (policy) => policy.status === FamilyPolicyStatus.ACTIVE,
        ).length,
        pending: policies.filter((policy) =>
          (
            [
              FamilyPolicyStatus.DRAFT,
              FamilyPolicyStatus.PENDING_PAYMENT,
              FamilyPolicyStatus.PAID_PENDING_ACTIVATION,
              FamilyPolicyStatus.WAITING_PERIOD,
            ] as FamilyPolicyStatus[]
          ).includes(policy.status),
        ).length,
        history: policies.filter((policy) =>
          historyStatuses.includes(policy.status),
        ).length,
      },
    };
  }

  async listForFamily(actor: AuthUser, familyGroupId: string) {
    await this.ensureFamily(actor, familyGroupId);
    await this.refreshTemporalStatuses(actor.organizationId);
    return this.prisma.familyPolicy.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        familyGroupId,
      },
      include: POLICY_DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async getPolicyByNumber(actor: AuthUser, policyNumber: string) {
    const policy = await this.getPolicyRecordByNumber(actor, policyNumber);
    return {
      ...this.toPolicyDetail(policy),
      history: await this.getPolicyHistory(actor, policy.id),
    };
  }

  async getPatientPolicy(
    actor: AuthUser,
    patientId: string,
    policyNumber: string,
  ) {
    await this.ensurePatient(actor, patientId);
    const policy = await this.getPolicyRecordByNumber(actor, policyNumber);
    const membership = policy.members.find(
      (member) => member.patientId === patientId,
    );
    if (!membership)
      throw new NotFoundException("Póliza no encontrada para este paciente");
    return {
      ...this.toPolicyDetail(policy, patientId),
      history: await this.getPolicyHistory(actor, policy.id),
    };
  }

  private async getPolicyRecordByNumber(actor: AuthUser, policyNumber: string) {
    const policy = await this.prisma.familyPolicy.findFirst({
      where: {
        policyNumber,
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
      },
      include: POLICY_DETAIL_INCLUDE,
    });
    if (!policy) throw new NotFoundException("Póliza no encontrada");
    return policy;
  }

  private async getPolicyRecordById(actor: AuthUser, policyId: string) {
    const policy = await this.prisma.familyPolicy.findFirst({
      where: {
        id: policyId,
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
      },
      include: POLICY_DETAIL_INCLUDE,
    });
    if (!policy) throw new NotFoundException("Póliza no encontrada");
    return policy;
  }

  async createDraft(actor: AuthUser, dto: CreateFamilyPolicyDto) {
    await this.ensureProducts(actor.organizationId);
    const product = await this.prisma.policyProduct.findFirst({
      where: {
        id: dto.policyProductId,
        organizationId: actor.organizationId,
        status: "ACTIVE",
      },
      include: { coverages: { where: { isActive: true } } },
    });
    if (!product)
      throw new NotFoundException("Producto de póliza no disponible");

    const holder = await this.ensurePatient(actor, dto.holderPatientId);
    const family = dto.familyGroupId
      ? await this.ensureFamily(actor, dto.familyGroupId)
      : null;
    if (product.maximumMembers > 1 && !family) {
      throw new BadRequestException(
        "Las pólizas duales y familiares requieren grupo familiar",
      );
    }
    if (family && family.branchId && family.branchId !== holder.branchId) {
      throw new BadRequestException(
        "Titular y grupo familiar deben pertenecer a la misma sucursal",
      );
    }

    const patientIds = this.normalizeMemberIds(
      dto.holderPatientId,
      dto.memberPatientIds,
    );
    this.assertMaximum(product.maximumMembers, patientIds.length);
    const familyMembers = await this.resolveFamilyMembers(
      actor,
      family?.id,
      patientIds,
    );
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveUntil = this.addMonths(
      effectiveFrom,
      product.durationMonths,
    );

    const policy = await this.prisma.$transaction(async (tx) => {
      const created = await tx.familyPolicy.create({
        data: {
          organizationId: actor.organizationId,
          policyProductId: product.id,
          familyGroupId: family?.id,
          holderPatientId: holder.id,
          effectiveFrom,
          effectiveUntil,
          contractedPrice: dto.contractedPrice,
          currency: dto.currency ?? product.currency,
          branchId: holder.branchId,
          brandId: product.brandId ?? holder.branch.brandId,
          soldByUserId: actor.id,
          coverageAvailableAt: this.addDays(
            effectiveFrom,
            product.waitingPeriodDays,
          ),
          members: {
            create: patientIds.map((patientId) => {
              const familyMember = familyMembers.get(patientId);
              return {
                organizationId: actor.organizationId,
                patientId,
                familyGroupMemberId: familyMember?.id,
                memberRole: patientId === holder.id ? "HOLDER" : "BENEFICIARY",
                relationshipSnapshot:
                  patientId === holder.id
                    ? "Titular"
                    : (familyMember?.relationship ?? "Integrante"),
                coverageStatus: "PENDING",
              };
            }),
          },
          coverages: {
            create: product.coverages.map((coverage) => ({
              organizationId: actor.organizationId,
              sourceProductCoverageId: coverage.id,
              procedureId: coverage.procedureId,
              procedureCategoryId: coverage.procedureCategoryId,
              name: coverage.name,
              coverageType: coverage.coverageType,
              coverageValue: coverage.coverageValue,
              copayAmount: coverage.copayAmount,
              annualAmountLimit: coverage.annualAmountLimit,
              annualUseLimit: coverage.annualUseLimit,
              waitingPeriodDays: coverage.waitingPeriodDays,
              requiresAuthorization: coverage.requiresAuthorization,
              exclusions: coverage.exclusions,
              conditions: coverage.conditions ?? Prisma.JsonNull,
            })),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          branchId: holder.branchId,
          actorUserId: actor.id,
          entity: "FamilyPolicy",
          entityId: created.id,
          action: "create_draft",
          after: {
            policyNumber: created.policyNumber,
            productCode: product.productCode,
            familyGroupId: family?.id,
            holderPatientId: holder.id,
            memberPatientIds: patientIds,
            maximumMembers: product.maximumMembers,
          },
        },
      });
      return created;
    });
    return this.toPolicyDetail(
      await this.getPolicyRecordById(actor, policy.id),
    );
  }

  async replaceMembers(
    actor: AuthUser,
    policyNumber: string,
    dto: ReplaceFamilyPolicyMembersDto,
  ) {
    const policy = await this.getPolicyRecordByNumber(actor, policyNumber);
    const policyId = policy.id;
    if (
      policy.status !== FamilyPolicyStatus.DRAFT &&
      policy.status !== FamilyPolicyStatus.PENDING_PAYMENT
    ) {
      throw new ConflictException(
        "Los beneficiarios de una póliza activa solo pueden cambiarse mediante movimiento",
      );
    }
    const patientIds = this.normalizeMemberIds(
      policy.holderPatientId,
      dto.memberPatientIds,
    );
    this.assertMaximum(policy.policyProduct.maximumMembers, patientIds.length);
    const familyMembers = await this.resolveFamilyMembers(
      actor,
      policy.familyGroupId,
      patientIds,
    );

    await this.prisma.$transaction(async (tx) => {
      const removedIds = policy.members
        .filter(
          (member) =>
            !patientIds.includes(member.patientId) && !member.removedAt,
        )
        .map((member) => member.id);
      if (removedIds.length) {
        await tx.familyPolicyMember.updateMany({
          where: { id: { in: removedIds } },
          data: {
            coverageStatus: "REMOVED",
            removedAt: new Date(),
            removalReason: "Ajuste de integrantes durante borrador",
          },
        });
      }
      await Promise.all(
        patientIds.map((patientId) => {
          const familyMember = familyMembers.get(patientId);
          const memberData = {
            familyGroupMemberId: familyMember?.id,
            memberRole:
              patientId === policy.holderPatientId ? "HOLDER" : "BENEFICIARY",
            relationshipSnapshot:
              patientId === policy.holderPatientId
                ? "Titular"
                : (familyMember?.relationship ?? "Integrante"),
            coverageStatus: "PENDING",
            removedAt: null,
            removalReason: null,
          };
          return tx.familyPolicyMember.upsert({
            where: { policyId_patientId: { policyId, patientId } },
            create: {
              organizationId: actor.organizationId,
              policyId,
              patientId,
              ...memberData,
            },
            update: memberData,
          });
        }),
      );
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          branchId: policy.branchId,
          actorUserId: actor.id,
          entity: "FamilyPolicy",
          entityId: policyId,
          action: "replace_draft_members",
          before: {
            memberPatientIds: policy.members.map((member) => member.patientId),
          },
          after: { memberPatientIds: patientIds },
        },
      });
    });
    return this.toPolicyDetail(await this.getPolicyRecordById(actor, policyId));
  }

  async addMember(
    actor: AuthUser,
    policyNumber: string,
    dto: AddFamilyPolicyMemberDto,
  ) {
    const policy = await this.getPolicyRecordByNumber(actor, policyNumber);
    if (
      !(
        [
          FamilyPolicyStatus.DRAFT,
          FamilyPolicyStatus.PENDING_PAYMENT,
          FamilyPolicyStatus.PAID_PENDING_ACTIVATION,
          FamilyPolicyStatus.WAITING_PERIOD,
          FamilyPolicyStatus.ACTIVE,
        ] as FamilyPolicyStatus[]
      ).includes(policy.status)
    ) {
      throw new ConflictException(
        "La póliza no admite nuevos integrantes en su estado actual",
      );
    }
    if (policy.policyProduct.modality === PolicyModality.INDIVIDUAL) {
      throw new ConflictException(
        "Una póliza individual no admite beneficiarios",
      );
    }
    if (!policy.familyGroupId)
      throw new ConflictException(
        "La póliza no tiene grupo familiar vinculado",
      );
    await this.ensurePatient(actor, dto.patientId);
    const familyMembers = await this.resolveFamilyMembers(
      actor,
      policy.familyGroupId,
      [dto.patientId],
    );
    const familyMember = familyMembers.get(dto.patientId);
    const existing = policy.members.find(
      (member) => member.patientId === dto.patientId,
    );
    if (existing)
      throw new ConflictException(
        "El paciente ya pertenece o perteneció a esta póliza",
      );

    await this.prisma.$transaction(
      async (tx) => {
        const currentCount = await tx.familyPolicyMember.count({
          where: { policyId: policy.id, removedAt: null },
        });
        this.assertMaximum(
          policy.policyProduct.maximumMembers,
          currentCount + 1,
        );
        const availableAt = policy.coverageAvailableAt ?? policy.effectiveFrom;
        const active =
          policy.status === FamilyPolicyStatus.ACTIVE &&
          availableAt <= new Date();
        const created = await tx.familyPolicyMember.create({
          data: {
            organizationId: actor.organizationId,
            policyId: policy.id,
            patientId: dto.patientId,
            familyGroupMemberId: familyMember?.id,
            memberRole: "BENEFICIARY",
            relationshipSnapshot:
              dto.relationship?.trim() ||
              familyMember?.relationship ||
              "Integrante",
            coverageStatus: active ? "ACTIVE" : "WAITING_PERIOD",
            coverageStart: active ? new Date() : availableAt,
            coverageEnd: policy.effectiveUntil,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            branchId: policy.branchId,
            actorUserId: actor.id,
            entity: "FamilyPolicy",
            entityId: policy.id,
            action: "add_member",
            after: {
              memberId: created.id,
              patientId: dto.patientId,
              role: "BENEFICIARY",
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.toPolicyDetail(
      await this.getPolicyRecordById(actor, policy.id),
    );
  }

  async removeMember(
    actor: AuthUser,
    policyNumber: string,
    memberId: string,
    dto: RemoveFamilyPolicyMemberDto,
  ) {
    const policy = await this.getPolicyRecordByNumber(actor, policyNumber);
    if (
      (
        [
          FamilyPolicyStatus.EXPIRED,
          FamilyPolicyStatus.CANCELLED,
          FamilyPolicyStatus.REPLACED,
        ] as FamilyPolicyStatus[]
      ).includes(policy.status)
    ) {
      throw new ConflictException(
        "No pueden modificarse integrantes de una póliza histórica",
      );
    }
    const member = policy.members.find(
      (candidate) => candidate.id === memberId && !candidate.removedAt,
    );
    if (!member) throw new NotFoundException("Integrante activo no encontrado");
    if (member.memberRole === "HOLDER")
      throw new ConflictException(
        "El titular no puede retirarse como beneficiario",
      );
    const remainingCount =
      policy.members.filter((candidate) => !candidate.removedAt).length - 1;
    const shouldSuspend =
      policy.status === FamilyPolicyStatus.ACTIVE &&
      remainingCount < policy.policyProduct.minimumMembers;
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.familyPolicyMember.update({
        where: { id: member.id },
        data: {
          coverageStatus: "REMOVED",
          coverageEnd: now,
          removedAt: now,
          removalReason: dto.reason.trim(),
        },
      });
      if (shouldSuspend) {
        await tx.familyPolicy.update({
          where: { id: policy.id },
          data: {
            status: FamilyPolicyStatus.SUSPENDED,
            suspendedAt: now,
            suspensionReason:
              "Cantidad de integrantes inferior al mínimo del producto",
          },
        });
        await tx.familyPolicyMember.updateMany({
          where: { policyId: policy.id, removedAt: null },
          data: { coverageStatus: "SUSPENDED" },
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          branchId: policy.branchId,
          actorUserId: actor.id,
          entity: "FamilyPolicy",
          entityId: policy.id,
          action: "remove_member",
          before: {
            memberId: member.id,
            patientId: member.patientId,
            status: member.coverageStatus,
          },
          after: {
            removedAt: now,
            reason: dto.reason.trim(),
            policySuspended: shouldSuspend,
          },
        },
      });
    });
    return this.toPolicyDetail(
      await this.getPolicyRecordById(actor, policy.id),
    );
  }

  async registerPayment(
    actor: AuthUser,
    policyNumber: string,
    dto: RegisterFamilyPolicyPaymentDto,
  ) {
    const policy = await this.getPolicyRecordByNumber(actor, policyNumber);
    const policyId = policy.id;
    if (
      policy.status !== FamilyPolicyStatus.DRAFT &&
      policy.status !== FamilyPolicyStatus.PENDING_PAYMENT
    ) {
      throw new ConflictException(
        "La póliza no admite pagos en su estado actual",
      );
    }
    this.assertActivationMemberCount(
      policy.policyProduct.minimumMembers,
      policy.policyProduct.maximumMembers,
      policy.members.filter((member) => !member.removedAt).length,
    );
    if (policy.policyProduct.status !== "ACTIVE") {
      throw new ConflictException("El producto de póliza ya no está activo");
    }
    if (policy.familyGroup && policy.familyGroup.status !== "ACTIVE") {
      throw new ConflictException("El grupo familiar ya no está activo");
    }
    if (
      [
        policy.holderPatient,
        ...policy.members
          .filter((member) => !member.removedAt)
          .map((member) => member.patient),
      ].some((patient) => ["INACTIVE", "MERGED"].includes(patient.status))
    ) {
      throw new ConflictException(
        "Todos los pacientes cubiertos deben permanecer activos",
      );
    }
    if (policy.effectiveUntil <= policy.effectiveFrom) {
      throw new BadRequestException("La vigencia de la póliza es inválida");
    }
    if (policy.effectiveUntil <= new Date()) {
      throw new BadRequestException(
        "No puede pagarse una póliza cuya vigencia ya terminó",
      );
    }

    const ledgerCharge = await this.ensurePolicyCharge(actor, policy);
    try {
      const payment = await this.paymentsService.createPayment(actor, {
        branchId: policy.branchId,
        patientId: policy.holderPatientId,
        amount: dto.amount,
        currency: policy.currency,
        paymentMethodId: dto.paymentMethodId,
        financialInstitutionId: dto.financialInstitutionId,
        reference: dto.reference,
        notes: `Pago de póliza ${policy.policyNumber}`,
        paidAt: dto.paidAt,
        idempotencyKey: dto.idempotencyKey,
      });
      if (
        payment.status === PaymentStatus.VOIDED ||
        payment.status === PaymentStatus.REFUNDED
      ) {
        throw new ConflictException(
          "El pago no es válido para activar la póliza",
        );
      }

      await this.prisma.$transaction(async (tx) => {
        const cashMovement = await tx.cashMovement.findFirst({
          where: { paymentId: payment.id },
          select: { cashRegisterId: true },
        });
        await tx.familyPolicyPayment.upsert({
          where: { paymentId: payment.id },
          create: {
            organizationId: actor.organizationId,
            policyId,
            paymentId: payment.id,
            branchId: policy.branchId,
            cashRegisterId: cashMovement?.cashRegisterId,
            amount: payment.amount,
            paymentStatus: payment.status,
            paidAt: payment.paidAt,
            receivedById: actor.id,
          },
          update: { paymentStatus: payment.status },
        });
        const totals = await tx.familyPolicyPayment.aggregate({
          where: { policyId, paymentStatus: { notIn: ["VOIDED", "REFUNDED"] } },
          _sum: { amount: true },
        });
        const paidAmount = Number(totals._sum.amount ?? 0);
        const isPaid = paidAmount >= Number(policy.contractedPrice);
        const now = new Date();
        const coverageAvailableAt =
          policy.coverageAvailableAt ?? policy.effectiveFrom;
        const activeStatus =
          policy.effectiveFrom > now
            ? FamilyPolicyStatus.PAID_PENDING_ACTIVATION
            : coverageAvailableAt > now
              ? FamilyPolicyStatus.WAITING_PERIOD
              : FamilyPolicyStatus.ACTIVE;
        await tx.familyPolicy.update({
          where: { id: policyId },
          data: {
            paymentStatus: isPaid
              ? FamilyPolicyPaymentStatus.PAID
              : FamilyPolicyPaymentStatus.PARTIAL,
            status: isPaid ? activeStatus : FamilyPolicyStatus.PENDING_PAYMENT,
            paidAt: isPaid ? now : null,
            activatedAt:
              isPaid && activeStatus === FamilyPolicyStatus.ACTIVE ? now : null,
          },
        });
        if (isPaid) {
          await tx.familyPolicyMember.updateMany({
            where: { policyId },
            data: {
              coverageStatus:
                activeStatus === FamilyPolicyStatus.ACTIVE
                  ? "ACTIVE"
                  : "WAITING_PERIOD",
              coverageStart: coverageAvailableAt,
              coverageEnd: policy.effectiveUntil,
            },
          });
        }
        await tx.patientLedgerEntry.update({
          where: { id: ledgerCharge.id },
          data: { status: LedgerEntryStatus.APPLIED },
        });
        await tx.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            branchId: policy.branchId,
            actorUserId: actor.id,
            entity: "FamilyPolicy",
            entityId: policyId,
            action: isPaid ? "pay_and_activate" : "register_partial_payment",
            after: {
              paymentId: payment.id,
              paidAmount,
              contractedPrice: policy.contractedPrice,
            },
          },
        });
      });
      return this.toPolicyDetail(
        await this.getPolicyRecordById(actor, policyId),
      );
    } catch (error) {
      await this.prisma.patientLedgerEntry.deleteMany({
        where: { id: ledgerCharge.id, status: LedgerEntryStatus.PENDING },
      });
      throw error;
    }
  }

  async simulateCoverage(
    actor: AuthUser,
    policyNumber: string,
    dto: SimulateFamilyPolicyCoverageDto,
  ) {
    const policy = await this.getPolicyRecordByNumber(actor, policyNumber);
    const { coverageReference: _coverageReference, ...simulation } =
      await this.calculateCoverageSimulation(actor, policy, dto);
    void _coverageReference;
    return simulation;
  }

  async applyCoverage(
    actor: AuthUser,
    policyNumber: string,
    dto: ApplyFamilyPolicyCoverageDto,
  ) {
    const policy = await this.getPolicyRecordByNumber(actor, policyNumber);
    const existingUsage = await this.prisma.familyPolicyUsage.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: actor.organizationId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });
    if (existingUsage) {
      if (
        existingUsage.policyId !== policy.id ||
        existingUsage.treatmentPlanItemId !== dto.treatmentPlanItemId ||
        existingUsage.patientId !== dto.patientId
      ) {
        throw new ConflictException(
          "La clave de idempotencia ya fue utilizada en otra operación",
        );
      }
      return this.toUsageResult(existingUsage, policy.currency);
    }
    const simulation = await this.calculateCoverageSimulation(
      actor,
      policy,
      dto,
    );
    if (!simulation.canApply) {
      throw new ConflictException(
        simulation.blockingReasons.join(". ") ||
          "La cobertura no puede aplicarse",
      );
    }
    if (simulation.requiresAuthorization && !dto.authorizationCode?.trim()) {
      throw new ConflictException(
        "La cobertura requiere código de autorización",
      );
    }

    const item = await this.prisma.treatmentPlanItem.findFirst({
      where: {
        id: dto.treatmentPlanItemId,
        treatmentPlan: {
          organizationId: actor.organizationId,
          patientId: dto.patientId,
          branchId: policy.branchId,
        },
      },
      select: { treatmentPlanId: true, procedureId: true, quantity: true },
    });
    if (!item)
      throw new NotFoundException("Prestación de tratamiento no encontrada");
    const member = policy.members.find(
      (candidate) =>
        candidate.patientId === dto.patientId && !candidate.removedAt,
    );
    if (!member)
      throw new ConflictException(
        "El paciente no es integrante activo de la póliza",
      );

    try {
      const usage = await this.prisma.$transaction(async (tx) => {
        const created = await tx.familyPolicyUsage.create({
          data: {
            organizationId: actor.organizationId,
            policyId: policy.id,
            coverageId: simulation.coverageReference,
            memberId: member.id,
            patientId: dto.patientId,
            branchId: policy.branchId,
            treatmentPlanId: item.treatmentPlanId,
            treatmentPlanItemId: dto.treatmentPlanItemId,
            procedureId: item.procedureId,
            normalAmount: simulation.normalAmount,
            coveredAmount: simulation.coveredAmount,
            copayAmount: simulation.copayAmount,
            quantity: item.quantity,
            status: FamilyPolicyUsageStatus.APPLIED,
            authorizationCode: dto.authorizationCode?.trim(),
            idempotencyKey: dto.idempotencyKey,
            appliedById: actor.id,
          },
        });
        await tx.treatmentPlanItem.update({
          where: { id: dto.treatmentPlanItemId },
          data: {
            policyCoverageAmount: simulation.coveredAmount,
            policyCopayAmount: simulation.copayAmount,
            policyCoverageAppliedAt: created.appliedAt,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            branchId: policy.branchId,
            actorUserId: actor.id,
            entity: "FamilyPolicy",
            entityId: policy.id,
            action: "apply_coverage",
            after: {
              policyNumber,
              patientId: dto.patientId,
              treatmentPlanItemId: dto.treatmentPlanItemId,
              coveredAmount: simulation.coveredAmount,
              copayAmount: simulation.copayAmount,
            },
          },
        });
        return created;
      });
      return this.toUsageResult(usage, policy.currency);
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      const concurrent = await this.prisma.familyPolicyUsage.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: actor.organizationId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });
      if (
        concurrent &&
        concurrent.policyId === policy.id &&
        concurrent.treatmentPlanItemId === dto.treatmentPlanItemId
      ) {
        return this.toUsageResult(concurrent, policy.currency);
      }
      throw new ConflictException(
        "La cobertura ya fue aplicada a esta prestación",
      );
    }
  }

  async reverseUsage(
    actor: AuthUser,
    policyNumber: string,
    usageId: string,
    dto: ReverseFamilyPolicyUsageDto,
  ) {
    const policy = await this.getPolicyRecordByNumber(actor, policyNumber);
    const usage = await this.prisma.familyPolicyUsage.findFirst({
      where: {
        id: usageId,
        policyId: policy.id,
        organizationId: actor.organizationId,
        status: FamilyPolicyUsageStatus.APPLIED,
      },
    });
    if (!usage) throw new NotFoundException("Consumo aplicado no encontrado");
    const reversed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.familyPolicyUsage.update({
        where: { id: usage.id },
        data: {
          status: FamilyPolicyUsageStatus.REVERSED,
          reversedAt: new Date(),
          reversedById: actor.id,
          reversalReason: dto.reason.trim(),
        },
      });
      if (usage.treatmentPlanItemId) {
        await tx.treatmentPlanItem.update({
          where: { id: usage.treatmentPlanItemId },
          data: {
            policyCoverageAmount: 0,
            policyCopayAmount: 0,
            policyCoverageAppliedAt: null,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          branchId: policy.branchId,
          actorUserId: actor.id,
          entity: "FamilyPolicy",
          entityId: policy.id,
          action: "reverse_coverage",
          before: { usageId: usage.id, status: usage.status },
          after: {
            status: FamilyPolicyUsageStatus.REVERSED,
            reason: dto.reason.trim(),
          },
        },
      });
      return updated;
    });
    return { status: reversed.status, reversedAt: reversed.reversedAt };
  }

  async cancel(
    actor: AuthUser,
    policyNumber: string,
    dto: CancelFamilyPolicyDto,
  ) {
    const policy = await this.getPolicyRecordByNumber(actor, policyNumber);
    const policyId = policy.id;
    if (
      policy.status === FamilyPolicyStatus.CANCELLED ||
      policy.status === FamilyPolicyStatus.EXPIRED
    ) {
      throw new ConflictException("La póliza ya no puede cancelarse");
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.familyPolicy.update({
        where: { id: policyId },
        data: {
          status: FamilyPolicyStatus.CANCELLED,
          cancelledAt: now,
          cancellationReason: dto.reason.trim(),
        },
      });
      await tx.familyPolicyMember.updateMany({
        where: { policyId, coverageStatus: { in: ["PENDING", "ACTIVE"] } },
        data: { coverageStatus: "CANCELLED", coverageEnd: now },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          branchId: policy.branchId,
          actorUserId: actor.id,
          entity: "FamilyPolicy",
          entityId: policyId,
          action: "cancel",
          before: { status: policy.status },
          after: {
            status: FamilyPolicyStatus.CANCELLED,
            reason: dto.reason.trim(),
          },
        },
      });
    });
    return this.toPolicyDetail(await this.getPolicyRecordById(actor, policyId));
  }

  private async calculateCoverageSimulation(
    actor: AuthUser,
    policy: PolicyDetailRecord,
    dto: SimulateFamilyPolicyCoverageDto,
  ) {
    const now = new Date();
    const member = policy.members.find(
      (candidate) =>
        candidate.patientId === dto.patientId && !candidate.removedAt,
    );
    const item = await this.prisma.treatmentPlanItem.findFirst({
      where: {
        id: dto.treatmentPlanItemId,
        treatmentPlan: {
          organizationId: actor.organizationId,
          patientId: dto.patientId,
          branchId: { in: actor.branchIds },
        },
      },
      include: {
        treatmentPlan: { select: { branchId: true, name: true } },
        procedure: {
          select: { id: true, categoryId: true, code: true, name: true },
        },
      },
    });
    if (!item)
      throw new NotFoundException("Prestación de tratamiento no encontrada");

    const coverage = policy.coverages.find(
      (candidate) =>
        candidate.isActive &&
        (candidate.procedureId === item.procedureId ||
          (!candidate.procedureId &&
            candidate.procedureCategoryId === item.procedure.categoryId)),
    );
    const blockingReasons: string[] = [];
    if (!member)
      blockingReasons.push("Paciente no pertenece activamente a la póliza");
    if (policy.status !== FamilyPolicyStatus.ACTIVE)
      blockingReasons.push("Póliza no activa");
    if (policy.paymentStatus !== FamilyPolicyPaymentStatus.PAID)
      blockingReasons.push("Póliza sin pago total validado");
    if (policy.effectiveFrom > now || policy.effectiveUntil <= now)
      blockingReasons.push("Póliza fuera de vigencia");
    if (item.treatmentPlan.branchId !== policy.branchId) {
      blockingReasons.push(
        "La póliza solo es válida en su sucursal de adquisición",
      );
    }
    if (!coverage) blockingReasons.push("Prestación sin regla de cobertura");

    const normalAmount = new Prisma.Decimal(
      Number(item.finalPrice) > 0 ? item.finalPrice : item.total,
    );
    if (!coverage) {
      return {
        coverageReference: "",
        canApply: false,
        blockingReasons,
        procedure: { code: item.procedure.code, name: item.procedure.name },
        normalAmount,
        coveredAmount: new Prisma.Decimal(0),
        copayAmount: normalAmount,
        configuredCopayAmount: null,
        requiresAuthorization: false,
        remainingUses: null,
        remainingAmount: null,
        currency: policy.currency,
      };
    }

    const availableAt = this.latestDate(
      policy.coverageAvailableAt ?? policy.effectiveFrom,
      this.addDays(policy.effectiveFrom, coverage.waitingPeriodDays),
    );
    if (availableAt > now)
      blockingReasons.push("Periodo de espera no cumplido");

    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const yearEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
    const totals = await this.prisma.familyPolicyUsage.aggregate({
      where: {
        coverageId: coverage.id,
        patientId: dto.patientId,
        status: FamilyPolicyUsageStatus.APPLIED,
        appliedAt: { gte: yearStart, lt: yearEnd },
      },
      _count: { _all: true },
      _sum: { coveredAmount: true },
    });
    const usedCount = totals._count._all;
    const usedAmount = totals._sum.coveredAmount ?? new Prisma.Decimal(0);
    const remainingUses =
      coverage.annualUseLimit == null
        ? null
        : Math.max(coverage.annualUseLimit - usedCount, 0);
    const remainingAmount =
      coverage.annualAmountLimit == null
        ? null
        : Prisma.Decimal.max(
            new Prisma.Decimal(coverage.annualAmountLimit).minus(usedAmount),
            0,
          );
    if (remainingUses === 0)
      blockingReasons.push("Límite anual de usos agotado");
    if (remainingAmount?.lessThanOrEqualTo(0))
      blockingReasons.push("Límite monetario anual agotado");

    let coveredAmount: Prisma.Decimal;
    if (coverage.coverageType === "FULL") {
      coveredAmount = normalAmount;
    } else if (coverage.coverageType === "PERCENTAGE") {
      coveredAmount = normalAmount.mul(coverage.coverageValue).div(100);
    } else {
      coveredAmount = new Prisma.Decimal(coverage.coverageValue);
    }
    coveredAmount = Prisma.Decimal.min(coveredAmount, normalAmount);
    if (remainingAmount)
      coveredAmount = Prisma.Decimal.min(coveredAmount, remainingAmount);
    coveredAmount = coveredAmount.toDecimalPlaces(2);
    const copayAmount = normalAmount.minus(coveredAmount).toDecimalPlaces(2);

    return {
      coverageReference: coverage.id,
      canApply: blockingReasons.length === 0,
      blockingReasons,
      procedure: { code: item.procedure.code, name: item.procedure.name },
      treatmentPlanName: item.treatmentPlan.name,
      coverage: {
        name: coverage.name,
        type: coverage.coverageType,
        value: coverage.coverageValue,
        availableAt,
      },
      normalAmount,
      coveredAmount,
      copayAmount,
      configuredCopayAmount: coverage.copayAmount,
      requiresAuthorization: coverage.requiresAuthorization,
      remainingUses,
      remainingAmount,
      currency: policy.currency,
    };
  }

  private toUsageResult(usage: FamilyPolicyUsage, currency: string) {
    return {
      appliedAt: usage.appliedAt,
      status: usage.status,
      coveredAmount: usage.coveredAmount,
      copayAmount: usage.copayAmount,
      currency,
    };
  }

  private toPatientPolicySummary(policy: PolicyListRecord, patientId: string) {
    const member = policy.members.find(
      (candidate) => candidate.patientId === patientId,
    );
    const activeMembers = policy.members.filter(
      (candidate) => !candidate.removedAt,
    );
    const paidAmount = policy.payments
      .filter(
        (payment) => !["VOIDED", "REFUNDED"].includes(payment.paymentStatus),
      )
      .reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );
    const balance = Prisma.Decimal.max(
      new Prisma.Decimal(policy.contractedPrice).minus(paidAmount),
      0,
    );
    const patientUsages = policy.usages.filter(
      (usage) => usage.patientId === patientId,
    );
    return {
      policyNumber: policy.policyNumber,
      familyNumber: policy.familyGroup?.familyCode ?? null,
      product: {
        code: policy.policyProduct.productCode,
        name: policy.policyProduct.name,
        type: policy.policyProduct.modality,
        maximumMembers: policy.policyProduct.maximumMembers,
      },
      status: policy.status,
      patientParticipation: {
        role:
          member?.memberRole ??
          (policy.holderPatientId === patientId ? "HOLDER" : "BENEFICIARY"),
        relationship: member?.relationshipSnapshot ?? null,
        memberStatus: member?.coverageStatus ?? "UNKNOWN",
      },
      holder: {
        name: `${policy.holderPatient.firstName} ${policy.holderPatient.lastName}`.trim(),
      },
      period: {
        purchasedAt: policy.purchasedAt,
        startsAt: policy.effectiveFrom,
        expiresAt: policy.effectiveUntil,
        coverageAvailableAt: policy.coverageAvailableAt,
      },
      origin: {
        brandName: policy.brand?.name ?? policy.branch.brand?.name ?? null,
        branchName: policy.branch.name,
      },
      members: {
        current: activeMembers.length,
        maximum: policy.policyProduct.maximumMembers,
        availableSlots: Math.max(
          policy.policyProduct.maximumMembers - activeMembers.length,
          0,
        ),
      },
      financial: {
        status: policy.paymentStatus,
        paidAmount,
        balance,
        currency: policy.currency,
      },
      coverageSummary: {
        available:
          policy.status === FamilyPolicyStatus.ACTIVE &&
          policy.coverages.length > 0,
        waitingPeriod: policy.status === FamilyPolicyStatus.WAITING_PERIOD,
        activeRules: policy.coverages.length,
        coveredAmountUsed: patientUsages.reduce(
          (sum, usage) => sum.plus(usage.coveredAmount),
          new Prisma.Decimal(0),
        ),
        copayAmount: patientUsages.reduce(
          (sum, usage) => sum.plus(usage.copayAmount),
          new Prisma.Decimal(0),
        ),
      },
    };
  }

  private toPolicyDetail(policy: PolicyDetailRecord, patientId?: string) {
    const member = patientId
      ? policy.members.find((candidate) => candidate.patientId === patientId)
      : undefined;
    const usedForPatient = (
      coverage: PolicyDetailRecord["coverages"][number],
    ) =>
      coverage.usages.filter(
        (usage) =>
          usage.status === FamilyPolicyUsageStatus.APPLIED &&
          (!patientId || usage.patientId === patientId),
      );
    const paidAmount = policy.payments
      .filter(
        (payment) => !["VOIDED", "REFUNDED"].includes(payment.paymentStatus),
      )
      .reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );
    return {
      policyNumber: policy.policyNumber,
      familyNumber: policy.familyGroup?.familyCode ?? null,
      product: {
        code: policy.policyProduct.productCode,
        name: policy.policyProduct.name,
        description: policy.policyProduct.description,
        type: policy.policyProduct.modality,
        maximumMembers: policy.policyProduct.maximumMembers,
        renewable: policy.policyProduct.renewable,
        terms: policy.policyProduct.terms,
      },
      status: policy.status,
      patientParticipation: member
        ? {
            role: member.memberRole,
            relationship: member.relationshipSnapshot,
            memberStatus: member.coverageStatus,
          }
        : null,
      period: {
        purchasedAt: policy.purchasedAt,
        paidAt: policy.paidAt,
        startsAt: policy.effectiveFrom,
        expiresAt: policy.effectiveUntil,
        coverageAvailableAt: policy.coverageAvailableAt,
        activatedAt: policy.activatedAt,
        cancelledAt: policy.cancelledAt,
      },
      origin: {
        branchName: policy.branch.name,
        brandName: policy.brand?.name ?? policy.branch.brand?.name ?? null,
      },
      holder: {
        name: `${policy.holderPatient.firstName} ${policy.holderPatient.lastName}`.trim(),
        documentType: policy.holderPatient.documentType,
        documentNumber: policy.holderPatient.documentNumber,
        phone: policy.holderPatient.phone,
        email: policy.holderPatient.email,
      },
      members: policy.members.map((candidate) => ({
        name: `${candidate.patient.firstName} ${candidate.patient.lastName}`.trim(),
        role: candidate.memberRole,
        relationship: candidate.relationshipSnapshot,
        status: candidate.coverageStatus,
        addedAt: candidate.addedAt,
        removedAt: candidate.removedAt,
        removalReason: candidate.removalReason,
      })),
      financial: {
        status: policy.paymentStatus,
        contractedPrice: policy.contractedPrice,
        paidAmount,
        balance: Prisma.Decimal.max(
          new Prisma.Decimal(policy.contractedPrice).minus(paidAmount),
          0,
        ),
        currency: policy.currency,
        payments: policy.payments.map((payment) => ({
          paymentNumber: payment.payment.paymentNumber,
          status: payment.payment.status,
          amount: payment.amount,
          paidAt: payment.paidAt,
          reference: payment.payment.reference,
        })),
      },
      coverages: policy.coverages.map((coverage) => {
        const usages = usedForPatient(coverage);
        const usedAmount = usages.reduce(
          (sum, usage) => sum.plus(usage.coveredAmount),
          new Prisma.Decimal(0),
        );
        const usedCount = usages.length;
        return {
          name: coverage.name,
          procedure: coverage.procedure
            ? { code: coverage.procedure.code, name: coverage.procedure.name }
            : null,
          category: coverage.procedureCategory?.name ?? null,
          type: coverage.coverageType,
          value: coverage.coverageValue,
          copayAmount: coverage.copayAmount,
          annualAmountLimit: coverage.annualAmountLimit,
          annualUseLimit: coverage.annualUseLimit,
          usedAmount,
          usedCount,
          remainingAmount:
            coverage.annualAmountLimit == null
              ? null
              : Prisma.Decimal.max(
                  new Prisma.Decimal(coverage.annualAmountLimit).minus(
                    usedAmount,
                  ),
                  0,
                ),
          remainingUses:
            coverage.annualUseLimit == null
              ? null
              : Math.max(coverage.annualUseLimit - usedCount, 0),
          waitingPeriodDays: coverage.waitingPeriodDays,
          requiresAuthorization: coverage.requiresAuthorization,
          exclusions: coverage.exclusions,
          conditions: coverage.conditions,
        };
      }),
      usages: policy.usages
        .filter((usage) => !patientId || usage.patientId === patientId)
        .map((usage) => ({
          patientName:
            `${usage.patient.firstName} ${usage.patient.lastName}`.trim(),
          procedure: usage.procedure.name,
          treatmentPlan: usage.treatmentPlan?.name ?? null,
          normalAmount: usage.normalAmount,
          coveredAmount: usage.coveredAmount,
          copayAmount: usage.copayAmount,
          status: usage.status,
          appliedAt: usage.appliedAt,
          appliedBy:
            `${usage.appliedBy.firstName} ${usage.appliedBy.lastName}`.trim(),
          reversedAt: usage.reversedAt,
          reversalReason: usage.reversalReason,
        })),
      documents: policy.documents.map((document) => ({
        type: document.type,
        name: document.fileAttachment.originalName,
        url: document.fileAttachment.url,
        mimeType: document.fileAttachment.mimeType,
        createdAt: document.createdAt,
      })),
      cancellationReason: policy.cancellationReason,
      suspensionReason: policy.suspensionReason,
    };
  }

  private async getPolicyHistory(actor: AuthUser, policyId: string) {
    const events = await this.prisma.auditLog.findMany({
      where: {
        organizationId: actor.organizationId,
        entity: "FamilyPolicy",
        entityId: policyId,
      },
      select: {
        action: true,
        reason: true,
        before: true,
        after: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return events.map((event) => ({
      action: event.action,
      reason: event.reason,
      before: event.before,
      after: event.after,
      createdAt: event.createdAt,
    }));
  }

  private async ensureProducts(organizationId: string) {
    await this.prisma.policyProduct.createMany({
      data: [
        {
          organizationId,
          productCode: "POL-IND",
          name: "Individual",
          modality: PolicyModality.INDIVIDUAL,
          minimumMembers: 1,
          maximumMembers: 1,
          durationMonths: 12,
          basePrice: 0,
          currency: "MXN",
        },
        {
          organizationId,
          productCode: "POL-DUAL",
          name: "Dual",
          modality: PolicyModality.DUAL,
          minimumMembers: 2,
          maximumMembers: 2,
          durationMonths: 12,
          basePrice: 0,
          currency: "MXN",
        },
        {
          organizationId,
          productCode: "POL-FAM4",
          name: "Familiar",
          modality: PolicyModality.FAMILY,
          minimumMembers: 1,
          maximumMembers: 4,
          durationMonths: 12,
          basePrice: 0,
          currency: "MXN",
        },
      ],
      skipDuplicates: true,
    });
  }

  private async ensurePatient(actor: AuthUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        deletedAt: null,
        status: { notIn: ["INACTIVE", "MERGED"] },
      },
      include: { branch: { select: { brandId: true } } },
    });
    if (!patient) throw new NotFoundException("Paciente activo no encontrado");
    return patient;
  }

  private async ensureFamily(actor: AuthUser, familyGroupId: string) {
    const family = await this.prisma.familyGroup.findFirst({
      where: {
        id: familyGroupId,
        organizationId: actor.organizationId,
        status: "ACTIVE",
        deletedAt: null,
        OR: [{ branchId: null }, { branchId: { in: actor.branchIds } }],
      },
    });
    if (!family)
      throw new NotFoundException("Grupo familiar activo no encontrado");
    return family;
  }

  private async resolveFamilyMembers(
    actor: AuthUser,
    familyGroupId: string | null | undefined,
    patientIds: string[],
  ) {
    if (!familyGroupId) {
      if (patientIds.length > 1) {
        throw new BadRequestException(
          "Los beneficiarios adicionales requieren grupo familiar",
        );
      }
      await this.ensurePatient(actor, patientIds[0]);
      return new Map<string, { id: string; relationship: string | null }>();
    }
    const members = await this.prisma.familyGroupMember.findMany({
      where: {
        organizationId: actor.organizationId,
        familyGroupId,
        patientId: { in: patientIds },
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
        patient: {
          deletedAt: null,
          status: { notIn: ["INACTIVE", "MERGED"] },
          branchId: { in: actor.branchIds },
        },
      },
      select: { id: true, patientId: true, relationship: true },
    });
    if (members.length !== patientIds.length) {
      throw new BadRequestException(
        "Titular y beneficiarios deben ser pacientes activos del grupo familiar",
      );
    }
    return new Map(members.map((member) => [member.patientId, member]));
  }

  private normalizeMemberIds(
    holderPatientId: string,
    memberPatientIds: string[],
  ) {
    return [...new Set([holderPatientId, ...memberPatientIds.filter(Boolean)])];
  }

  private assertMaximum(maximumMembers: number, count: number) {
    if (count > maximumMembers) {
      throw new BadRequestException(
        `La modalidad permite máximo ${maximumMembers} integrante${maximumMembers === 1 ? "" : "s"}, incluyendo titular`,
      );
    }
  }

  private assertActivationMemberCount(
    minimumMembers: number,
    maximumMembers: number,
    count: number,
  ) {
    this.assertMaximum(maximumMembers, count);
    if (count < minimumMembers) {
      throw new BadRequestException(
        `La modalidad requiere mínimo ${minimumMembers} integrantes, incluyendo titular`,
      );
    }
  }

  private addMonths(value: Date, months: number) {
    const result = new Date(value);
    result.setUTCMonth(result.getUTCMonth() + months);
    return result;
  }

  private addDays(value: Date, days: number) {
    const result = new Date(value);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private latestDate(left: Date, right: Date) {
    return left > right ? left : right;
  }

  private async ensurePolicyCharge(
    actor: AuthUser,
    policy: Awaited<ReturnType<typeof this.getPolicyRecordByNumber>>,
  ) {
    const existing = await this.prisma.patientLedgerEntry.findFirst({
      where: {
        organizationId: actor.organizationId,
        patientId: policy.holderPatientId,
        entryType: LedgerEntryType.CHARGE,
        sourceType: LedgerSourceType.MANUAL,
        sourceId: policy.id,
      },
    });
    if (existing) return existing;
    return this.prisma.patientLedgerEntry.create({
      data: {
        organizationId: actor.organizationId,
        branchId: policy.branchId,
        patientId: policy.holderPatientId,
        occurredAt: new Date(),
        entryType: LedgerEntryType.CHARGE,
        sourceType: LedgerSourceType.MANUAL,
        sourceId: policy.id,
        debitAmount: policy.contractedPrice,
        currency: policy.currency,
        descriptionSnapshot: `Contratación de póliza ${policy.policyNumber}`,
        status: LedgerEntryStatus.PENDING,
      },
    });
  }

  private async refreshTemporalStatuses(organizationId: string) {
    const now = new Date();
    const expired = await this.prisma.familyPolicy.findMany({
      where: {
        organizationId,
        status: {
          notIn: [
            FamilyPolicyStatus.EXPIRED,
            FamilyPolicyStatus.CANCELLED,
            FamilyPolicyStatus.REPLACED,
          ],
        },
        effectiveUntil: { lt: now },
      },
      select: { id: true },
    });
    if (expired.length) {
      const ids = expired.map((policy) => policy.id);
      await this.prisma.$transaction([
        this.prisma.familyPolicy.updateMany({
          where: { id: { in: ids } },
          data: { status: FamilyPolicyStatus.EXPIRED },
        }),
        this.prisma.familyPolicyMember.updateMany({
          where: { policyId: { in: ids }, coverageStatus: "ACTIVE" },
          data: { coverageStatus: "EXPIRED", coverageEnd: now },
        }),
      ]);
    }

    const waiting = await this.prisma.familyPolicy.findMany({
      where: {
        organizationId,
        paymentStatus: FamilyPolicyPaymentStatus.PAID,
        status: FamilyPolicyStatus.PAID_PENDING_ACTIVATION,
        effectiveFrom: { lte: now },
        coverageAvailableAt: { gt: now },
        effectiveUntil: { gt: now },
      },
      select: { id: true },
    });
    if (waiting.length) {
      const waitingIds = waiting.map((policy) => policy.id);
      await this.prisma.$transaction([
        this.prisma.familyPolicy.updateMany({
          where: { id: { in: waitingIds } },
          data: { status: FamilyPolicyStatus.WAITING_PERIOD },
        }),
        this.prisma.familyPolicyMember.updateMany({
          where: { policyId: { in: waitingIds }, removedAt: null },
          data: { coverageStatus: "WAITING_PERIOD" },
        }),
      ]);
    }

    const activatable = await this.prisma.familyPolicy.findMany({
      where: {
        organizationId,
        paymentStatus: FamilyPolicyPaymentStatus.PAID,
        status: {
          in: [
            FamilyPolicyStatus.PAID_PENDING_ACTIVATION,
            FamilyPolicyStatus.WAITING_PERIOD,
          ],
        },
        effectiveFrom: { lte: now },
        OR: [
          { coverageAvailableAt: null },
          { coverageAvailableAt: { lte: now } },
        ],
        effectiveUntil: { gt: now },
      },
      select: { id: true },
    });
    if (!activatable.length) return;
    const activatableIds = activatable.map((policy) => policy.id);
    await this.prisma.$transaction([
      this.prisma.familyPolicy.updateMany({
        where: { id: { in: activatableIds } },
        data: { status: FamilyPolicyStatus.ACTIVE, activatedAt: now },
      }),
      this.prisma.familyPolicyMember.updateMany({
        where: { policyId: { in: activatableIds }, removedAt: null },
        data: { coverageStatus: "ACTIVE", coverageStart: now },
      }),
    ]);
  }
}
