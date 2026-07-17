import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  FamilyPolicyPaymentStatus,
  FamilyPolicyStatus,
  LedgerEntryStatus,
  LedgerEntryType,
  LedgerSourceType,
  PaymentStatus,
  PolicyModality,
  Prisma
} from "@prisma/client";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import {
  CancelFamilyPolicyDto,
  CreateFamilyPolicyDto,
  RegisterFamilyPolicyPaymentDto,
  ReplaceFamilyPolicyMembersDto
} from "./dto/family-policy.dto";

const POLICY_INCLUDE = {
  policyProduct: true,
  familyGroup: {
    select: { id: true, familyCode: true, name: true, status: true, holderPatientId: true }
  },
  holderPatient: {
    select: { id: true, firstName: true, lastName: true, birthDate: true, status: true }
  },
  members: {
    include: {
      patient: {
        select: { id: true, firstName: true, lastName: true, birthDate: true, status: true }
      }
    },
    orderBy: { addedAt: "asc" as const }
  },
  payments: { orderBy: { paidAt: "desc" as const } }
} satisfies Prisma.FamilyPolicyInclude;

@Injectable()
export class FamilyPoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService
  ) {}

  async listProducts(actor: AuthUser) {
    await this.ensureProducts(actor.organizationId);
    return this.prisma.policyProduct.findMany({
      where: { organizationId: actor.organizationId, status: "ACTIVE" },
      orderBy: { maximumMembers: "asc" }
    });
  }

  async listForPatient(actor: AuthUser, patientId: string) {
    await this.ensurePatient(actor, patientId);
    await this.expirePolicies(actor.organizationId);
    return this.prisma.familyPolicy.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        OR: [{ holderPatientId: patientId }, { members: { some: { patientId } } }]
      },
      include: POLICY_INCLUDE,
      orderBy: { createdAt: "desc" }
    });
  }

  async listForFamily(actor: AuthUser, familyGroupId: string) {
    await this.ensureFamily(actor, familyGroupId);
    await this.expirePolicies(actor.organizationId);
    return this.prisma.familyPolicy.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        familyGroupId
      },
      include: POLICY_INCLUDE,
      orderBy: { createdAt: "desc" }
    });
  }

  async getPolicy(actor: AuthUser, policyId: string) {
    const policy = await this.prisma.familyPolicy.findFirst({
      where: {
        id: policyId,
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds }
      },
      include: POLICY_INCLUDE
    });
    if (!policy) throw new NotFoundException("Póliza no encontrada");
    return policy;
  }

  async createDraft(actor: AuthUser, dto: CreateFamilyPolicyDto) {
    await this.ensureProducts(actor.organizationId);
    const product = await this.prisma.policyProduct.findFirst({
      where: { id: dto.policyProductId, organizationId: actor.organizationId, status: "ACTIVE" }
    });
    if (!product) throw new NotFoundException("Producto de póliza no disponible");

    const holder = await this.ensurePatient(actor, dto.holderPatientId);
    const family = dto.familyGroupId ? await this.ensureFamily(actor, dto.familyGroupId) : null;
    if (product.maximumMembers > 1 && !family) {
      throw new BadRequestException("Las pólizas duales y familiares requieren grupo familiar");
    }
    if (family && family.branchId && family.branchId !== holder.branchId) {
      throw new BadRequestException("Titular y grupo familiar deben pertenecer a la misma sucursal");
    }

    const patientIds = this.normalizeMemberIds(dto.holderPatientId, dto.memberPatientIds);
    this.assertMaximum(product.maximumMembers, patientIds.length);
    const familyMembers = await this.resolveFamilyMembers(actor, family?.id, patientIds);
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveUntil = this.addMonths(effectiveFrom, product.durationMonths);

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
          soldByUserId: actor.id,
          members: {
            create: patientIds.map((patientId) => {
              const familyMember = familyMembers.get(patientId);
              return {
                organizationId: actor.organizationId,
                patientId,
                familyGroupMemberId: familyMember?.id,
                memberRole: patientId === holder.id ? "HOLDER" : "BENEFICIARY",
                relationshipSnapshot:
                  patientId === holder.id ? "Titular" : (familyMember?.relationship ?? "Integrante"),
                coverageStatus: "PENDING"
              };
            })
          }
        }
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
            maximumMembers: product.maximumMembers
          }
        }
      });
      return created;
    });
    return this.getPolicy(actor, policy.id);
  }

  async replaceMembers(actor: AuthUser, policyId: string, dto: ReplaceFamilyPolicyMembersDto) {
    const policy = await this.getPolicy(actor, policyId);
    if (policy.status !== FamilyPolicyStatus.DRAFT && policy.status !== FamilyPolicyStatus.PENDING_PAYMENT) {
      throw new ConflictException(
        "Los beneficiarios de una póliza activa solo pueden cambiarse mediante movimiento"
      );
    }
    const patientIds = this.normalizeMemberIds(policy.holderPatientId, dto.memberPatientIds);
    this.assertMaximum(policy.policyProduct.maximumMembers, patientIds.length);
    const familyMembers = await this.resolveFamilyMembers(actor, policy.familyGroupId, patientIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.familyPolicyMember.deleteMany({ where: { policyId } });
      await tx.familyPolicyMember.createMany({
        data: patientIds.map((patientId) => {
          const familyMember = familyMembers.get(patientId);
          return {
            organizationId: actor.organizationId,
            policyId,
            patientId,
            familyGroupMemberId: familyMember?.id,
            memberRole: patientId === policy.holderPatientId ? "HOLDER" : "BENEFICIARY",
            relationshipSnapshot:
              patientId === policy.holderPatientId ? "Titular" : (familyMember?.relationship ?? "Integrante"),
            coverageStatus: "PENDING"
          };
        })
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          branchId: policy.branchId,
          actorUserId: actor.id,
          entity: "FamilyPolicy",
          entityId: policyId,
          action: "replace_draft_members",
          before: { memberPatientIds: policy.members.map((member) => member.patientId) },
          after: { memberPatientIds: patientIds }
        }
      });
    });
    return this.getPolicy(actor, policyId);
  }

  async registerPayment(actor: AuthUser, policyId: string, dto: RegisterFamilyPolicyPaymentDto) {
    const policy = await this.getPolicy(actor, policyId);
    if (policy.status !== FamilyPolicyStatus.DRAFT && policy.status !== FamilyPolicyStatus.PENDING_PAYMENT) {
      throw new ConflictException("La póliza no admite pagos en su estado actual");
    }
    this.assertActivationMemberCount(
      policy.policyProduct.minimumMembers,
      policy.policyProduct.maximumMembers,
      policy.members.length
    );
    if (policy.policyProduct.status !== "ACTIVE") {
      throw new ConflictException("El producto de póliza ya no está activo");
    }
    if (policy.familyGroup && policy.familyGroup.status !== "ACTIVE") {
      throw new ConflictException("El grupo familiar ya no está activo");
    }
    if (
      [policy.holderPatient, ...policy.members.map((member) => member.patient)].some((patient) =>
        ["INACTIVE", "MERGED"].includes(patient.status)
      )
    ) {
      throw new ConflictException("Todos los pacientes cubiertos deben permanecer activos");
    }
    if (policy.effectiveUntil <= policy.effectiveFrom) {
      throw new BadRequestException("La vigencia de la póliza es inválida");
    }
    if (policy.effectiveUntil <= new Date()) {
      throw new BadRequestException("No puede pagarse una póliza cuya vigencia ya terminó");
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
        idempotencyKey: dto.idempotencyKey
      });
      if (payment.status === PaymentStatus.VOIDED || payment.status === PaymentStatus.REFUNDED) {
        throw new ConflictException("El pago no es válido para activar la póliza");
      }

      await this.prisma.$transaction(async (tx) => {
        const cashMovement = await tx.cashMovement.findFirst({
          where: { paymentId: payment.id },
          select: { cashRegisterId: true }
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
            receivedById: actor.id
          },
          update: { paymentStatus: payment.status }
        });
        const totals = await tx.familyPolicyPayment.aggregate({
          where: { policyId, paymentStatus: { notIn: ["VOIDED", "REFUNDED"] } },
          _sum: { amount: true }
        });
        const paidAmount = Number(totals._sum.amount ?? 0);
        const isPaid = paidAmount >= Number(policy.contractedPrice);
        const now = new Date();
        await tx.familyPolicy.update({
          where: { id: policyId },
          data: {
            paymentStatus: isPaid ? FamilyPolicyPaymentStatus.PAID : FamilyPolicyPaymentStatus.PARTIAL,
            status: isPaid ? FamilyPolicyStatus.ACTIVE : FamilyPolicyStatus.PENDING_PAYMENT,
            activatedAt: isPaid ? now : null
          }
        });
        if (isPaid) {
          await tx.familyPolicyMember.updateMany({
            where: { policyId },
            data: {
              coverageStatus: "ACTIVE",
              coverageStart: policy.effectiveFrom,
              coverageEnd: policy.effectiveUntil
            }
          });
        }
        await tx.patientLedgerEntry.update({
          where: { id: ledgerCharge.id },
          data: { status: LedgerEntryStatus.APPLIED }
        });
        await tx.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            branchId: policy.branchId,
            actorUserId: actor.id,
            entity: "FamilyPolicy",
            entityId: policyId,
            action: isPaid ? "pay_and_activate" : "register_partial_payment",
            after: { paymentId: payment.id, paidAmount, contractedPrice: policy.contractedPrice }
          }
        });
      });
      return this.getPolicy(actor, policyId);
    } catch (error) {
      await this.prisma.patientLedgerEntry.deleteMany({
        where: { id: ledgerCharge.id, status: LedgerEntryStatus.PENDING }
      });
      throw error;
    }
  }

  async cancel(actor: AuthUser, policyId: string, dto: CancelFamilyPolicyDto) {
    const policy = await this.getPolicy(actor, policyId);
    if (policy.status === FamilyPolicyStatus.CANCELLED || policy.status === FamilyPolicyStatus.EXPIRED) {
      throw new ConflictException("La póliza ya no puede cancelarse");
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.familyPolicy.update({
        where: { id: policyId },
        data: {
          status: FamilyPolicyStatus.CANCELLED,
          cancelledAt: now,
          cancellationReason: dto.reason.trim()
        }
      });
      await tx.familyPolicyMember.updateMany({
        where: { policyId, coverageStatus: { in: ["PENDING", "ACTIVE"] } },
        data: { coverageStatus: "CANCELLED", coverageEnd: now }
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
          after: { status: FamilyPolicyStatus.CANCELLED, reason: dto.reason.trim() }
        }
      });
    });
    return this.getPolicy(actor, policyId);
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
          currency: "MXN"
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
          currency: "MXN"
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
          currency: "MXN"
        }
      ],
      skipDuplicates: true
    });
  }

  private async ensurePatient(actor: AuthUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        deletedAt: null,
        status: { notIn: ["INACTIVE", "MERGED"] }
      }
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
        OR: [{ branchId: null }, { branchId: { in: actor.branchIds } }]
      }
    });
    if (!family) throw new NotFoundException("Grupo familiar activo no encontrado");
    return family;
  }

  private async resolveFamilyMembers(
    actor: AuthUser,
    familyGroupId: string | null | undefined,
    patientIds: string[]
  ) {
    if (!familyGroupId) {
      if (patientIds.length > 1) {
        throw new BadRequestException("Los beneficiarios adicionales requieren grupo familiar");
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
          branchId: { in: actor.branchIds }
        }
      },
      select: { id: true, patientId: true, relationship: true }
    });
    if (members.length !== patientIds.length) {
      throw new BadRequestException("Titular y beneficiarios deben ser pacientes activos del grupo familiar");
    }
    return new Map(members.map((member) => [member.patientId, member]));
  }

  private normalizeMemberIds(holderPatientId: string, memberPatientIds: string[]) {
    return [...new Set([holderPatientId, ...memberPatientIds.filter(Boolean)])];
  }

  private assertMaximum(maximumMembers: number, count: number) {
    if (count > maximumMembers) {
      throw new BadRequestException(
        `La modalidad permite máximo ${maximumMembers} integrante${maximumMembers === 1 ? "" : "s"}, incluyendo titular`
      );
    }
  }

  private assertActivationMemberCount(minimumMembers: number, maximumMembers: number, count: number) {
    this.assertMaximum(maximumMembers, count);
    if (count < minimumMembers) {
      throw new BadRequestException(
        `La modalidad requiere mínimo ${minimumMembers} integrantes, incluyendo titular`
      );
    }
  }

  private addMonths(value: Date, months: number) {
    const result = new Date(value);
    result.setUTCMonth(result.getUTCMonth() + months);
    return result;
  }

  private async ensurePolicyCharge(actor: AuthUser, policy: Awaited<ReturnType<typeof this.getPolicy>>) {
    const existing = await this.prisma.patientLedgerEntry.findFirst({
      where: {
        organizationId: actor.organizationId,
        patientId: policy.holderPatientId,
        entryType: LedgerEntryType.CHARGE,
        sourceType: LedgerSourceType.MANUAL,
        sourceId: policy.id
      }
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
        status: LedgerEntryStatus.PENDING
      }
    });
  }

  private async expirePolicies(organizationId: string) {
    const now = new Date();
    const expired = await this.prisma.familyPolicy.findMany({
      where: {
        organizationId,
        status: FamilyPolicyStatus.ACTIVE,
        effectiveUntil: { lt: now }
      },
      select: { id: true }
    });
    if (!expired.length) return;
    const ids = expired.map((policy) => policy.id);
    await this.prisma.$transaction([
      this.prisma.familyPolicy.updateMany({
        where: { id: { in: ids } },
        data: { status: FamilyPolicyStatus.EXPIRED }
      }),
      this.prisma.familyPolicyMember.updateMany({
        where: { policyId: { in: ids }, coverageStatus: "ACTIVE" },
        data: { coverageStatus: "EXPIRED", coverageEnd: now }
      })
    ]);
  }
}
