import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomInt } from "crypto";
import {
  AgreementStatus,
  AgreementType,
  CashMovementDirection,
  CashMovementType,
  CashRegisterStatus,
  ExpenseStatus,
  PaymentStatus,
  Prisma,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus
} from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { assertBranchAccess, branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { UpsertBrandDto } from "./dto/upsert-brand.dto";
import { CreateFinancialInstitutionDto, UpdateFinancialInstitutionDto } from "./dto/financial-institution.dto";
import {
  AssignAgreementPatientsDto,
  AgreementCategoryRuleDto,
  AgreementProcedureRuleDto,
  CreateAgreementDto,
  CreateExpenseDto,
  FinalizePayrollDto,
  PreviewAgreementPriceDto,
  UpdateExpenseDto,
  VoidExpenseDto,
  UpdateAgreementDto
} from "./dto/admin-workflows.dto";
import { UpdateGeneralSettingsDto } from "./dto/update-general-settings.dto";
import { ExpensePolicy, type ExpensePolicySource } from "./domain/expense.policy";

const PAYROLL_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.RECEIVED,
  PaymentStatus.PARTIALLY_ALLOCATED,
  PaymentStatus.ALLOCATED
];

const expenseCashRegisterSelect = Prisma.validator<Prisma.CashRegisterSelect>()({
  id: true,
  publicNumber: true,
  status: true,
  closedAt: true,
  branch: { select: { id: true, name: true } },
  responsibleUser: { select: { id: true, firstName: true, lastName: true } }
});

const expenseMutationInclude = Prisma.validator<Prisma.ExpenseInclude>()({
  category: true,
  cashMovements: {
    include: { cashRegister: { select: expenseCashRegisterSelect } }
  }
});

const payrollTreatmentItemInclude = Prisma.validator<Prisma.TreatmentPlanItemInclude>()({
  procedure: { select: { id: true, categoryId: true, code: true, name: true } },
  treatmentPlan: {
    select: {
      id: true,
      branchId: true,
      patient: { select: { id: true, firstName: true, lastName: true } },
      professional: { select: { id: true, firstName: true, lastName: true, commissionRate: true } }
    }
  },
  paymentAllocations: {
    where: { payment: { status: { in: PAYROLL_PAYMENT_STATUSES } } },
    select: {
      amount: true,
      payment: {
        select: {
          id: true,
          paidAt: true,
          status: true,
          paymentMethod: { select: { name: true } },
          cashMovements: { select: { id: true } }
        }
      }
    }
  }
});

const payrollLiquidationItemInclude = Prisma.validator<Prisma.PayrollLiquidationItemInclude>()({
  treatmentPlanItem: { include: payrollTreatmentItemInclude }
});

const payrollContractInclude = Prisma.validator<Prisma.ProfessionalContractInclude>()({
  branches: { select: { branchId: true } },
  categoryRates: { select: { procedureCategoryId: true, rate: true } },
  fixedAmounts: { select: { procedureId: true, amount: true, priceListId: true, currency: true } }
});

const agreementOperationalVersionInclude = Prisma.validator<Prisma.AgreementVersionInclude>()({
  priceList: { select: { id: true, name: true } },
  branches: true,
  categoryRules: true,
  procedureRules: true
});

type PayrollTreatmentItemSource = Prisma.TreatmentPlanItemGetPayload<{
  include: typeof payrollTreatmentItemInclude;
}>;
type PayrollLiquidationItemSource = Prisma.PayrollLiquidationItemGetPayload<{
  include: typeof payrollLiquidationItemInclude;
}>;
type PayrollContractSource = Prisma.ProfessionalContractGetPayload<{
  include: typeof payrollContractInclude;
}>;
type AgreementOperationalVersion = Prisma.AgreementVersionGetPayload<{
  include: typeof agreementOperationalVersionInclude;
}>;
type PayrollRuleSource = "FIXED_AMOUNT" | "CATEGORY_RATE" | "CONTRACT_RATE" | "PROFESSIONAL_FALLBACK";

type PayrollRuleSnapshot = {
  source: PayrollRuleSource;
  commissionRate: number;
  contractId?: string | null;
  contractType?: string | null;
  commissionBase?: string | null;
  paymentDiscount?: string | null;
  paymentCondition?: string | null;
  priceListId?: string | null;
  priceListName?: string | null;
  procedureCategoryId?: string | null;
  fixedAmount?: number | null;
};
type PayrollItemView = {
  treatmentPlanItemId: string;
  treatmentNumber: string;
  patientId: string;
  patientName: string;
  action: string;
  procedureCode: string;
  priceSource: string;
  priceSnapshotName: string | null;
  priceSnapshotCode: string | null;
  priceSnapshotCategory: string | null;
  completedAt: Date | null;
  firstPaymentAt: Date | null;
  lastPaymentAt: Date | null;
  toothNumber: string | null;
  surface: string | null;
  treatmentAmount: number;
  collectedAmount: number;
  rawCollectedAmount: number;
  payableAmount: number;
  commissionRate: number;
  paymentMethods: string;
  paymentIds: string[];
  cashValidated: boolean;
  isReady: boolean;
  status: "VALID" | "PARTIAL_PAYMENT" | "FINALIZED";
  contractRule: PayrollRuleSnapshot;
  calculationExplanation: string;
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGeneral(actor: AuthUser) {
    const organization = await this.prisma.organization.findFirst({
      where: { id: actor.organizationId, deletedAt: null }
    });
    if (!organization) throw new NotFoundException("Organization not found");

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      legalName: organization.legalName,
      taxId: organization.taxId,
      phone: organization.phone,
      email: organization.email,
      address: organization.address,
      logoUrl: organization.logoUrl,
      organizationSlug: organization.slug,
      status: organization.status,
      updatedAt: organization.updatedAt
    };
  }

  async updateGeneral(actor: AuthUser, dto: UpdateGeneralSettingsDto) {
    const current = await this.prisma.organization.findFirst({
      where: { id: actor.organizationId, deletedAt: null }
    });
    if (!current) throw new NotFoundException("Organization not found");

    const organization = await this.prisma.organization.update({
      where: { id: actor.organizationId },
      data: {
        name: dto.organizationName?.trim(),
        legalName: dto.legalName?.trim(),
        taxId: dto.taxId?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.toLowerCase().trim(),
        address: dto.address?.trim(),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl.trim() || null } : {})
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "Organization",
        entityId: actor.organizationId,
        action: "update_settings",
        before: {
          name: current.name,
          legalName: current.legalName,
          taxId: current.taxId,
          phone: current.phone,
          email: current.email,
          address: current.address,
          logoUrl: current.logoUrl
        },
        after: {
          name: organization.name,
          legalName: organization.legalName,
          taxId: organization.taxId,
          phone: organization.phone,
          email: organization.email,
          address: organization.address,
          logoUrl: organization.logoUrl
        }
      }
    });

    return this.getGeneral(actor);
  }

  async listFinancialInstitutions(
    actor: AuthUser,
    search?: string,
    active?: string,
    page?: number,
    pageSize?: number
  ) {
    const { skip, take } = resolvePagination({ page, pageSize });
    return this.prisma.financialInstitution.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(active !== undefined ? { isActive: active === "true" } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {})
      },
      skip,
      take,
      orderBy: { name: "asc" }
    });
  }

  async createFinancialInstitution(actor: AuthUser, dto: CreateFinancialInstitutionDto) {
    const created = await this.prisma.financialInstitution.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim()
      }
    });
    await this.auditConfiguration(actor, "FinancialInstitution", created.id, "create", {
      name: created.name
    });
    return created;
  }

  async updateFinancialInstitution(actor: AuthUser, id: string, dto: UpdateFinancialInstitutionDto) {
    const current = await this.prisma.financialInstitution.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!current) throw new NotFoundException("Financial institution not found");

    const updated = await this.prisma.financialInstitution.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        isActive: dto.isActive
      }
    });

    await this.auditConfiguration(actor, "FinancialInstitution", id, "update", {
      before: { name: current.name, isActive: current.isActive },
      after: { name: updated.name, isActive: updated.isActive }
    });
    return updated;
  }

  async deactivateFinancialInstitution(actor: AuthUser, id: string) {
    return this.updateFinancialInstitution(actor, id, { isActive: false });
  }

  async deleteFinancialInstitution(actor: AuthUser, id: string) {
    return this.prisma.financialInstitution.delete({
      where: {
        id,
        organizationId: actor.organizationId
      }
    });
  }

  async listBrands(actor: AuthUser) {
    return this.prisma.branchBrand.findMany({
      where: { organizationId: actor.organizationId },
      include: {
        branches: {
          select: { id: true, name: true }
        }
      }
    });
  }

  async upsertBrand(actor: AuthUser, id: string | undefined, dto: UpsertBrandDto) {
    let brandId = id;
    if (!id) {
      const created = await this.prisma.branchBrand.create({
        data: {
          organizationId: actor.organizationId,
          name: dto.name,
          logoUrl: dto.logoUrl,
          code: dto.name.toUpperCase().replace(/\s+/g, "_"),
          slug: dto.name.toLowerCase().replace(/\s+/g, "-"),
        }
      });
      brandId = created.id;
    } else {
      await this.prisma.branchBrand.update({
        where: { id: brandId, organizationId: actor.organizationId },
        data: {
          name: dto.name,
          logoUrl: dto.logoUrl,
        }
      });
    }

    if (dto.branchIds) {
      // Unlink all branches for this brand first
      await this.prisma.branch.updateMany({
        where: { brandId: brandId, organizationId: actor.organizationId },
        data: { brandId: null }
      });
      // Link selected branches
      if (dto.branchIds.length > 0) {
        await this.prisma.branch.updateMany({
          where: { id: { in: dto.branchIds }, organizationId: actor.organizationId },
          data: { brandId: brandId }
        });
      }
    }

    return this.prisma.branchBrand.findUnique({
      where: { id: brandId },
      include: { branches: { select: { id: true, name: true } } }
    });
  }

  async deleteBrand(actor: AuthUser, id: string) {
    return this.prisma.branchBrand.delete({
      where: {
        id,
        organizationId: actor.organizationId
      }
    });
  }

  async listAgreements(actor: AuthUser, search?: string, active?: string, page?: number, pageSize?: number) {
    const { skip, take } = resolvePagination({ page, pageSize });
    return this.prisma.agreement.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(active !== undefined ? { isActive: active === "true" } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: {
        priceList: { select: { id: true, name: true, isDefault: true } },
        versions: {
          include: {
            branches: { include: { branch: { select: { id: true, name: true } } } },
            categoryRules: {
              include: { procedureCategory: { select: { id: true, name: true, type: true } } }
            },
            procedureRules: {
              include: {
                procedure: { select: { id: true, code: true, name: true, categoryId: true } }
              }
            }
          },
          orderBy: { version: "desc" },
          take: 1
        },
        _count: { select: { patients: true } }
      },
      skip,
      take,
      orderBy: { name: "asc" }
    });
  }

  async getAgreement(actor: AuthUser, id: string) {
    const agreement = await this.prisma.agreement.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        priceList: { select: { id: true, name: true, isDefault: true } },
        versions: {
          include: {
            priceList: { select: { id: true, name: true } },
            branches: { include: { branch: { select: { id: true, name: true } } } },
            categoryRules: {
              include: { procedureCategory: { select: { id: true, name: true, type: true } } }
            },
            procedureRules: {
              include: {
                procedure: { select: { id: true, code: true, name: true, categoryId: true } }
              }
            }
          },
          orderBy: { version: "desc" }
        },
        _count: { select: { patients: true, treatmentPlans: true, treatmentPlanItems: true } }
      }
    });
    if (!agreement) throw new NotFoundException("Agreement not found");
    return agreement;
  }

  async createAgreement(actor: AuthUser, dto: CreateAgreementDto) {
    this.ensureAgreementDates(dto.startsAt, dto.endsAt);
    await this.validateAgreementReferences(actor, dto);
    const company = await this.resolveAgreementCompany(actor, dto);
    const agreement = await this.prisma.agreement.create({
      data: {
        organizationId: actor.organizationId,
        companyId: company.id,
        name: dto.name.trim(),
        entityName: this.cleanAgreementText(dto.entityName),
        entityTaxId: this.cleanAgreementText(dto.entityTaxId),
        type: dto.type ?? AgreementType.CORPORATE,
        status: AgreementStatus.DRAFT,
        startsAt: this.dateOrNull(dto.startsAt),
        endsAt: this.dateOrNull(dto.endsAt),
        description: this.cleanAgreementText(dto.description),
        priceListId: dto.priceListId || null,
        discountPercent: this.toDecimal(dto.discountPercent ?? 0),
        coveragePercent: this.toDecimal(dto.coveragePercent ?? 0),
        copayAmount: this.toDecimal(dto.copayAmount ?? 0),
        coverageLimitAmount:
          dto.coverageLimitAmount === undefined ? null : this.toDecimal(dto.coverageLimitAmount),
        coverageRules: (dto.coverageRules ?? undefined) as Prisma.InputJsonValue | undefined,
        appliesToLabs: dto.appliesToLabs ?? false,
        appliesToOtherCategories: dto.appliesToOtherCategories ?? false,
        payrollDiscount: dto.payrollDiscount ?? false,
        isPublic: dto.isPublic ?? true,
        isActive: false,
        versions: { create: this.agreementVersionCreateData(actor, dto, 1) }
      }
    });
    await this.auditConfiguration(actor, "Agreement", agreement.id, "create", {
      name: agreement.name,
      version: 1,
      status: AgreementStatus.DRAFT
    });
    await this.emitAgreementEvent(actor, agreement.id, "draft_created", { version: 1 });
    return this.getAgreement(actor, agreement.id);
  }

  async updateAgreement(actor: AuthUser, id: string, dto: UpdateAgreementDto) {
    const current = await this.ensureAgreement(actor, id);
    if (current.status === AgreementStatus.CANCELLED) {
      throw new ConflictException("Cancelled agreements cannot be updated");
    }
    const version = await this.currentAgreementVersion(actor, current);
    if (!version) throw new ConflictException("Agreement operational state is unavailable");
    const merged = this.mergeAgreementDto({ ...current, ...version, name: current.name }, dto);
    this.ensureAgreementDates(merged.startsAt, merged.endsAt);
    await this.validateAgreementReferences(actor, merged);
    const company = await this.resolveAgreementCompany(actor, merged);
    if (current.status === AgreementStatus.ACTIVE || current.status === AgreementStatus.SCHEDULED) {
      if (!merged.branchIds?.length) {
        throw new BadRequestException("At least one branch is required for an active agreement");
      }
      await this.ensureNoAgreementOverlap(
        actor,
        {
          id: current.id,
          entityTaxId: this.cleanAgreementText(merged.entityTaxId),
          entityName: this.cleanAgreementText(merged.entityName)
        },
        {
          startsAt: this.dateOrNull(merged.startsAt),
          endsAt: this.dateOrNull(merged.endsAt),
          branches: [...new Set(merged.branchIds ?? [])].map((branchId) => ({ branchId }))
        }
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.agreement.update({
        where: { id },
        data: { ...this.agreementMainUpdateData(merged), companyId: company.id }
      });
      await tx.agreementVersion.update({
        where: { id: version.id },
        data: this.agreementVersionUpdateData(merged, actor)
      });
      await tx.agreementBranch.deleteMany({ where: { agreementVersionId: version.id } });
      await tx.agreementCategoryRule.deleteMany({ where: { agreementVersionId: version.id } });
      await tx.agreementProcedureRule.deleteMany({ where: { agreementVersionId: version.id } });
      if (merged.branchIds?.length) {
        await tx.agreementBranch.createMany({
          data: [...new Set(merged.branchIds)].map((branchId) => ({
            organizationId: actor.organizationId,
            agreementVersionId: version.id,
            branchId
          }))
        });
      }
      if (merged.categoryRules?.length) {
        await tx.agreementCategoryRule.createMany({
          data: this.categoryRuleData(
            actor,
            version.id,
            merged.categoryRules
          ) as Prisma.AgreementCategoryRuleCreateManyInput[]
        });
      }
      if (merged.procedureRules?.length) {
        await tx.agreementProcedureRule.createMany({
          data: this.procedureRuleData(
            actor,
            version.id,
            merged.procedureRules
          ) as Prisma.AgreementProcedureRuleCreateManyInput[]
        });
      }
    });
    await this.auditConfiguration(actor, "Agreement", id, "update", {
      version: current.version,
      status: current.status
    });
    return this.getAgreement(actor, id);
  }

  async deactivateAgreement(actor: AuthUser, id: string) {
    const agreement = await this.ensureAgreement(actor, id);
    if (agreement.status === AgreementStatus.CANCELLED)
      throw new ConflictException("Cancelled agreements cannot be deactivated");
    await this.prisma.agreement.update({
      where: { id },
      data: { status: AgreementStatus.INACTIVE, isActive: false }
    });
    await this.auditConfiguration(actor, "Agreement", id, "deactivate", { version: agreement.version });
    return this.getAgreement(actor, id);
  }

  async createAgreementVersion(actor: AuthUser, id: string, dto: CreateAgreementDto) {
    this.ensureAgreementFeatureEnabled();
    const current = await this.ensureAgreement(actor, id);
    if (current.status === AgreementStatus.CANCELLED)
      throw new ConflictException("Cancelled agreements cannot be versioned");
    const source = await this.currentAgreementVersion(actor, current);
    const merged = this.mergeAgreementDto(source ?? current, dto);
    this.ensureAgreementDates(merged.startsAt, merged.endsAt);
    await this.validateAgreementReferences(actor, merged);
    const nextVersion =
      Math.max(
        current.version,
        ...(
          await this.prisma.agreementVersion.findMany({
            where: { agreementId: id },
            select: { version: true }
          })
        ).map((row) => row.version)
      ) + 1;
    const created = await this.prisma.agreementVersion.create({
      data: { ...this.agreementVersionCreateData(actor, merged, nextVersion), agreementId: id }
    });
    await this.auditConfiguration(actor, "Agreement", id, "create_version", {
      sourceVersion: current.version,
      version: nextVersion
    });
    await this.emitAgreementEvent(actor, id, "version_created", { version: nextVersion });
    return created;
  }

  async publishAgreement(actor: AuthUser, id: string, requestedVersion?: number) {
    this.ensureAgreementFeatureEnabled();
    const current = await this.ensureAgreement(actor, id);
    if (current.status === AgreementStatus.CANCELLED)
      throw new ConflictException("Cancelled agreements cannot be published");
    const version = await this.prisma.agreementVersion.findFirst({
      where: { agreementId: id, ...(requestedVersion ? { version: requestedVersion } : {}) },
      include: { branches: true, categoryRules: true, procedureRules: true },
      orderBy: { version: "desc" }
    });
    if (!version) throw new NotFoundException("Agreement version not found");
    this.ensureAgreementDates(version.startsAt?.toISOString(), version.endsAt?.toISOString());
    if (!version.branches.length)
      throw new BadRequestException("At least one branch is required before publishing an agreement");
    await this.ensureNoAgreementOverlap(actor, current, version);
    const now = new Date();
    const status =
      version.startsAt && version.startsAt > now ? AgreementStatus.SCHEDULED : AgreementStatus.ACTIVE;
    await this.prisma.agreement.update({
      where: { id },
      data: {
        ...this.agreementMainFromVersion(version),
        version: version.version,
        status,
        isActive: status === AgreementStatus.ACTIVE,
        publishedAt: now,
        cancelledAt: null
      }
    });
    await this.auditConfiguration(actor, "Agreement", id, "publish", { version: version.version, status });
    await this.emitAgreementEvent(actor, id, "published", { version: version.version, status });
    return this.getAgreement(actor, id);
  }

  async cancelAgreement(actor: AuthUser, id: string) {
    this.ensureAgreementFeatureEnabled();
    const agreement = await this.ensureAgreement(actor, id);
    await this.prisma.agreement.update({
      where: { id },
      data: { status: AgreementStatus.CANCELLED, isActive: false, cancelledAt: new Date() }
    });
    await this.auditConfiguration(actor, "Agreement", id, "cancel", { version: agreement.version });
    await this.emitAgreementEvent(actor, id, "cancelled", { version: agreement.version });
    return this.getAgreement(actor, id);
  }

  async duplicateAgreement(actor: AuthUser, id: string) {
    this.ensureAgreementFeatureEnabled();
    const source = await this.getAgreement(actor, id);
    const version = source.versions[0];
    if (!version) throw new ConflictException("Legacy agreements must be versioned before duplication");
    const duplicate = await this.createAgreement(actor, {
      name: `${source.name} (copia)`,
      entityName: version.entityName ?? undefined,
      entityTaxId: version.entityTaxId ?? undefined,
      type: version.type,
      description: version.description ?? undefined,
      priceListId: version.priceListId ?? undefined,
      discountPercent: Number(version.discountPercent),
      coveragePercent: Number(version.coveragePercent),
      copayAmount: Number(version.copayAmount),
      coverageLimitAmount: version.coverageLimitAmount ? Number(version.coverageLimitAmount) : undefined,
      coverageRules: (version.coverageRules ?? undefined) as Record<string, unknown> | undefined,
      startsAt: version.startsAt?.toISOString(),
      endsAt: version.endsAt?.toISOString(),
      branchIds: version.branches.map((row) => row.branchId),
      categoryRules: version.categoryRules.map((rule) => this.categoryRuleDtoFromRow(rule)),
      procedureRules: version.procedureRules.map((rule) => this.ruleDtoFromRow(rule))
    });
    await this.auditConfiguration(actor, "Agreement", duplicate.id, "duplicate", {
      sourceAgreementId: id,
      sourceVersion: version.version
    });
    return duplicate;
  }

  async previewAgreementPrice(actor: AuthUser, id: string, dto: PreviewAgreementPriceDto) {
    this.ensureAgreementFeatureEnabled();
    const agreement = await this.ensureAgreement(actor, id);
    assertBranchAccess(actor, dto.branchId);
    const version = await this.currentAgreementVersion(actor, agreement);
    if (!version) throw new ConflictException("Agreement has no versioned rules to preview");
    return this.calculateAgreementPrice(
      actor,
      agreement,
      version,
      dto.branchId,
      dto.procedureId,
      dto.quantity ?? 1
    );
  }

  async listAgreementDebts(actor: AuthUser) {
    const rows = await this.prisma.treatmentPlanItem.findMany({
      where: {
        agreementId: { not: null },
        agreementCoverage: { gt: 0 },
        agreementPaidAt: null,
        treatmentPlan: { organizationId: actor.organizationId }
      },
      include: {
        agreement: { select: { id: true, name: true, discountPercent: true } }
      }
    });

    const summaries = new Map<
      string,
      { id: string; companyName: string; agreementName: string; debt: number }
    >();
    for (const row of rows) {
      if (!row.agreement) continue;
      const key = row.agreementId!;
      if (!summaries.has(key)) {
        summaries.set(key, {
          id: row.agreement.id,
          companyName: row.agreement.name,
          agreementName: row.agreement.name,
          debt: 0
        });
      }
      const summary = summaries.get(key)!;
      summary.debt += Number(row.agreementCoverage);
    }

    return Array.from(summaries.values()).map((s) => ({
      ...s,
      debt: this.roundMoney(s.debt)
    }));
  }

  async payAgreementDebt(actor: AuthUser, agreementId: string) {
    const agreement = await this.prisma.agreement.findFirst({
      where: { id: agreementId, organizationId: actor.organizationId }
    });
    if (!agreement) throw new NotFoundException("Agreement not found");

    const items = await this.prisma.treatmentPlanItem.findMany({
      where: {
        agreementId,
        agreementCoverage: { gt: 0 },
        agreementPaidAt: null,
        treatmentPlan: { organizationId: actor.organizationId }
      }
    });

    if (items.length === 0) throw new BadRequestException("No pending debts for this agreement");

    const totalDebt = items.reduce((sum, item) => sum + Number(item.agreementCoverage), 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.treatmentPlanItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: { agreementPaidAt: new Date() }
      });

      // En una versión más avanzada, aquí podríamos generar un registro en CashMovement
      // hacia una cuenta de banco global de la clínica.
    });

    return { success: true, amountPaid: totalDebt };
  }

  async assignAgreementPatients(actor: AuthUser, id: string, dto: AssignAgreementPatientsDto) {
    const agreement = await this.ensureUsableAgreement(actor, id);
    const version = await this.currentAgreementVersion(actor, agreement);
    if (!version) throw new ConflictException("Agreement has no active version");

    const patientIds = [...new Set(dto.patientIds.map((patientId) => patientId.trim()).filter(Boolean))];
    if (!patientIds.length) throw new BadRequestException("At least one patient is required");

    const patients = await this.prisma.patient.findMany({
      where: { id: { in: patientIds }, organizationId: actor.organizationId, deletedAt: null },
      select: { id: true, branchId: true }
    });
    if (patients.length !== patientIds.length)
      throw new BadRequestException("One or more patients are invalid");
    this.ensureAgreementBranchScope(
      version.branches,
      patients.map((patient) => patient.branchId)
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.agreementPatientAssignment.updateMany({
        where: { organizationId: actor.organizationId, patientId: { in: patientIds }, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: actor.id }
      });
      await tx.agreementPatientAssignment.createMany({
        data: patientIds.map((patientId) => ({
          organizationId: actor.organizationId,
          agreementId: agreement.id,
          patientId,
          version: agreement.version,
          assignedById: actor.id
        }))
      });
      await tx.patient.updateMany({ where: { id: { in: patientIds } }, data: { agreementId: agreement.id } });
    });
    await this.auditConfiguration(actor, "Agreement", agreement.id, "assign_patients", { patientIds });
    await this.emitAgreementEvent(actor, agreement.id, "patients_assigned", {
      patientIds,
      version: agreement.version
    });
    return { updated: patients.length, version: agreement.version };
  }

  async assignAgreementTreatmentPlan(actor: AuthUser, agreementId: string, treatmentPlanId: string) {
    this.ensureAgreementFeatureEnabled();
    const agreement = await this.ensureUsableAgreement(actor, agreementId);
    const version = await this.currentAgreementVersion(actor, agreement);
    if (!version) throw new ConflictException("Agreement has no active version");
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: treatmentPlanId, organizationId: actor.organizationId, branchId: { in: actor.branchIds } },
      select: { id: true, branchId: true, status: true }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");
    if (
      plan.status === TreatmentPlanStatus.ACCEPTED ||
      plan.status === TreatmentPlanStatus.IN_PROGRESS ||
      plan.status === TreatmentPlanStatus.COMPLETED
    ) {
      throw new ConflictException(
        "Accepted or started treatment plans keep their existing agreement snapshot"
      );
    }
    this.ensureAgreementBranchScope(version.branches, [plan.branchId]);
    await this.prisma.treatmentPlan.update({
      where: { id: plan.id },
      data: {
        agreementId: agreement.id,
        agreementVersionNumber: agreement.version,
        agreementSnapshot: this.agreementSnapshot(agreement, version)
      }
    });
    await this.auditConfiguration(actor, "TreatmentPlan", plan.id, "assign_agreement", {
      agreementId,
      version: agreement.version
    });
    await this.emitAgreementEvent(actor, agreementId, "treatment_plan_assigned", {
      treatmentPlanId: plan.id,
      version: agreement.version
    });
    return this.prisma.treatmentPlan.findUnique({ where: { id: plan.id } });
  }

  async listExpenses(
    actor: AuthUser,
    search?: string,
    branchId?: string,
    month?: number,
    year?: number,
    page?: number,
    pageSize?: number,
    status?: string,
    categoryId?: string
  ) {
    const { skip, take } = resolvePagination({ page, pageSize });
    const expenses = await this.prisma.expense.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor, branchId),
        ...(status ? { status: status as ExpenseStatus } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(search
          ? {
              OR: [
                { description: { contains: search, mode: "insensitive" } },
                { notes: { contains: search, mode: "insensitive" } },
                { category: { name: { contains: search, mode: "insensitive" } } }
              ]
            }
          : {}),
        ...(month && year
          ? {
              paidAt: {
                gte: new Date(year, month - 1, 1),
                lt: new Date(year, month, 1)
              }
            }
          : {})
      },
      include: {
        branch: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true, type: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        voidedBy: { select: { id: true, firstName: true, lastName: true } },
        cashMovements: {
          select: {
            id: true,
            cashRegisterId: true,
            cashRegister: { select: expenseCashRegisterSelect }
          }
        }
      },
      skip,
      take,
      orderBy: { paidAt: "desc" }
    });
    return expenses.map((expense) => this.serializeExpense(actor, expense));
  }

  async getExpenseSummary(actor: AuthUser, branchId?: string, month?: number, year?: number) {
    const selected = new Date(year ?? new Date().getFullYear(), (month ?? new Date().getMonth() + 1) - 1, 1);
    const start = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const end = new Date(selected.getFullYear(), selected.getMonth() + 1, 1);
    const previousStart = new Date(selected.getFullYear(), selected.getMonth() - 1, 1);
    const trendStart = new Date(selected.getFullYear(), selected.getMonth() - 11, 1);
    const scopedBranch = branchScope(actor, branchId);
    const baseWhere = {
      organizationId: actor.organizationId,
      branchId: scopedBranch,
      status: { not: ExpenseStatus.VOIDED }
    } satisfies Prisma.ExpenseWhereInput;

    const [currentGroups, previousGroups, categories, trendExpenses] = await Promise.all([
      this.prisma.expense.groupBy({
        by: ["categoryId"],
        where: { ...baseWhere, paidAt: { gte: start, lt: end } },
        _count: { _all: true },
        _sum: { total: true }
      }),
      this.prisma.expense.groupBy({
        by: ["categoryId"],
        where: { ...baseWhere, paidAt: { gte: previousStart, lt: start } },
        _sum: { total: true }
      }),
      this.prisma.expenseCategory.findMany({
        where: { organizationId: actor.organizationId },
        select: { id: true, name: true }
      }),
      this.prisma.expense.findMany({
        where: { ...baseWhere, paidAt: { gte: trendStart, lt: end } },
        select: { paidAt: true, total: true }
      })
    ]);
    const names = new Map(categories.map((category) => [category.id, category.name]));
    const previous = new Map(
      previousGroups.map((group) => [group.categoryId, this.roundMoney(Number(group._sum.total ?? 0))])
    );
    const total = this.roundMoney(
      currentGroups.reduce((sum, group) => sum + Number(group._sum.total ?? 0), 0)
    );
    const rows = currentGroups
      .map((group) => {
        const categoryTotal = this.roundMoney(Number(group._sum.total ?? 0));
        const previousTotal = previous.get(group.categoryId) ?? 0;
        return {
          categoryId: group.categoryId,
          category: names.get(group.categoryId) ?? "Sin categoría",
          count: group._count._all,
          total: categoryTotal,
          percentage: total ? this.roundMoney((categoryTotal / total) * 100) : 0,
          previousTotal,
          comparisonPercent:
            previousTotal > 0
              ? this.roundMoney(((categoryTotal - previousTotal) / previousTotal) * 100)
              : null
        };
      })
      .sort((a, b) => b.total - a.total);
    const trend = new Map<string, number>();
    for (let index = 0; index < 12; index += 1) {
      const cursor = new Date(trendStart.getFullYear(), trendStart.getMonth() + index, 1);
      trend.set(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`, 0);
    }
    for (const expense of trendExpenses) {
      const key = `${expense.paidAt.getFullYear()}-${String(expense.paidAt.getMonth() + 1).padStart(2, "0")}`;
      trend.set(key, this.roundMoney((trend.get(key) ?? 0) + Number(expense.total)));
    }

    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      total,
      count: rows.reduce((sum, row) => sum + row.count, 0),
      rows,
      trend: [...trend].map(([period, amount]) => ({ period, amount }))
    };
  }

  async createExpense(actor: AuthUser, dto: CreateExpenseDto) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchScope(actor, dto.branchId),
        organizationId: actor.organizationId,
        deletedAt: null,
        status: "ACTIVE"
      }
    });
    if (!branch) throw new BadRequestException("Invalid branch");

    const quantity = this.roundMoney(dto.quantity);
    const unitCost = this.roundMoney(dto.unitCost);
    const total = this.roundMoney(quantity * unitCost);
    const categoryName = dto.categoryName.trim();
    const description = dto.description.trim();
    if (!categoryName) throw new BadRequestException("Expense category is required");
    if (!description) throw new BadRequestException("Expense description is required");
    if (dto.paymentMethodId) await this.ensureExpensePaymentMethod(actor, dto.paymentMethodId);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const expenseId = await this.prisma.$transaction(
          async (tx) => {
            const category = await tx.expenseCategory.upsert({
              where: { organizationId_name: { organizationId: actor.organizationId, name: categoryName } },
              create: { organizationId: actor.organizationId, name: categoryName },
              update: { isActive: true }
            });

            const expense = await tx.expense.create({
              data: {
                publicNumber: randomInt(100000, 1000000),
                organizationId: actor.organizationId,
                branchId: dto.branchId,
                categoryId: category.id,
                description,
                supplierName: dto.supplierName?.trim(),
                quantity: this.toDecimal(quantity),
                unitCost: this.toDecimal(unitCost),
                total: this.toDecimal(total),
                invoicedAt: dto.invoicedAt ? new Date(dto.invoicedAt) : null,
                paidAt: new Date(dto.paidAt),
                paymentMethodId: dto.paymentMethodId,
                documentUrl: dto.documentUrl?.trim(),
                notes: dto.notes?.trim(),
                status: ExpenseStatus.PAID,
                createdById: actor.id
              }
            });

            if (dto.assignToOpenCash || dto.cashRegisterId) {
              const openRegister = await tx.cashRegister.findFirst({
                where: {
                  organizationId: actor.organizationId,
                  branchId: dto.branchId,
                  status: CashRegisterStatus.OPEN,
                  ...(dto.cashRegisterId ? { id: dto.cashRegisterId } : { responsibleUserId: actor.id })
                },
                orderBy: { openedAt: "desc" }
              });
              if (!openRegister)
                throw new BadRequestException("Open a cash register before assigning the expense");
              await tx.cashMovement.create({
                data: {
                  organizationId: actor.organizationId,
                  branchId: dto.branchId,
                  cashRegisterId: openRegister.id,
                  type: CashMovementType.EXPENSE,
                  direction: CashMovementDirection.OUT,
                  amount: this.toDecimal(total),
                  expenseId: expense.id,
                  paymentMethodId: dto.paymentMethodId,
                  description: `Gasto GAS-${String(expense.publicNumber).padStart(6, "0")}: ${expense.description}`,
                  createdById: actor.id
                }
              });
            }

            await tx.auditLog.create({
              data: {
                organizationId: actor.organizationId,
                actorUserId: actor.id,
                entity: "Expense",
                entityId: expense.id,
                action: "create",
                after: {
                  publicNumber: expense.publicNumber,
                  branchId: dto.branchId,
                  categoryName,
                  description: expense.description,
                  total,
                  assignedToCash: Boolean(dto.assignToOpenCash || dto.cashRegisterId)
                }
              }
            });
            return expense.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        return this.getExpense(actor, expenseId);
      } catch (error) {
        if (this.isUniqueCollision(error, "publicNumber")) continue;
        throw error;
      }
    }

    throw new ConflictException("Could not generate a unique expense number. Try again.");
  }

  async updateExpense(actor: AuthUser, expenseId: string, dto: UpdateExpenseDto) {
    const publicNumber = this.parseExpenseNumber(expenseId);
    const expense = await this.prisma.expense.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        OR: [{ id: expenseId }, ...(publicNumber !== null ? [{ publicNumber }] : [])]
      },
      include: expenseMutationInclude
    });
    if (!expense) throw new NotFoundException("Expense not found");
    if (dto.paymentMethodId) await this.ensureExpensePaymentMethod(actor, dto.paymentMethodId);

    const quantity = this.roundMoney(dto.quantity ?? Number(expense.quantity));
    const unitCost = this.roundMoney(dto.unitCost ?? Number(expense.unitCost));
    const total = this.roundMoney(quantity * unitCost);
    const categoryName = dto.categoryName?.trim();

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.expense.findFirst({
            where: { id: expense.id, organizationId: actor.organizationId, branchId: branchScope(actor) },
            include: expenseMutationInclude
          });
          if (!current) throw new NotFoundException("Expense not found");
          ExpensePolicy.assertCanEdit(current);
          if (current.version !== dto.expectedVersion) {
            throw new ConflictException({
              code: "EXPENSE_VERSION_CONFLICT",
              message: "El gasto cambió mientras lo editabas. Actualiza la información antes de continuar."
            });
          }

          let categoryId = current.categoryId;
          if (categoryName) {
            const category = await tx.expenseCategory.upsert({
              where: { organizationId_name: { organizationId: actor.organizationId, name: categoryName } },
              create: { organizationId: actor.organizationId, name: categoryName },
              update: { isActive: true }
            });
            categoryId = category.id;
          }

          const updated = await tx.expense.updateMany({
            where: { id: current.id, version: dto.expectedVersion, status: { not: ExpenseStatus.VOIDED } },
            data: {
              categoryId,
              description: dto.description?.trim(),
              supplierName: dto.supplierName?.trim(),
              quantity: this.toDecimal(quantity),
              unitCost: this.toDecimal(unitCost),
              total: this.toDecimal(total),
              invoicedAt: dto.invoicedAt ? new Date(dto.invoicedAt) : undefined,
              paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
              paymentMethodId: dto.paymentMethodId,
              documentUrl: dto.documentUrl?.trim(),
              notes: dto.notes?.trim(),
              updatedById: actor.id,
              version: { increment: 1 }
            }
          });
          if (updated.count !== 1)
            throw new ConflictException({
              code: "EXPENSE_VERSION_CONFLICT",
              message: "El gasto cambió mientras lo editabas. Actualiza la información antes de continuar."
            });

          await tx.cashMovement.updateMany({
            where: { expenseId: current.id, voidedAt: null },
            data: { amount: this.toDecimal(total), paymentMethodId: dto.paymentMethodId }
          });
          await tx.auditLog.create({
            data: {
              organizationId: actor.organizationId,
              actorUserId: actor.id,
              entity: "Expense",
              entityId: expense.id,
              action: "update",
              before: {
                category: current.category.name,
                description: current.description,
                total: current.total.toString(),
                version: current.version
              },
              after: {
                category: categoryName ?? current.category.name,
                description: dto.description ?? current.description,
                total,
                version: current.version + 1
              }
            }
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      const mappedError = await this.mapExpenseMutationError(actor, expense.id, error, "edit");
      await this.auditRejectedExpenseMutation(actor, expense, "update_rejected", mappedError);
      throw mappedError;
    }

    return this.getExpense(actor, expense.id);
  }

  async voidExpense(actor: AuthUser, expenseId: string, dto: VoidExpenseDto) {
    const publicNumber = this.parseExpenseNumber(expenseId);
    const expense = await this.prisma.expense.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        OR: [{ id: expenseId }, ...(publicNumber !== null ? [{ publicNumber }] : [])]
      },
      include: expenseMutationInclude
    });
    if (!expense) throw new NotFoundException("Expense not found");
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException("Void reason is required");

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.expense.findFirst({
            where: { id: expense.id, organizationId: actor.organizationId, branchId: branchScope(actor) },
            include: expenseMutationInclude
          });
          if (!current) throw new NotFoundException("Expense not found");
          ExpensePolicy.assertCanVoid(current);
          if (current.version !== dto.expectedVersion) {
            throw new ConflictException({
              code: "EXPENSE_VERSION_CONFLICT",
              message: "El gasto cambió mientras intentabas anularlo. Actualiza la información."
            });
          }
          const updated = await tx.expense.updateMany({
            where: { id: current.id, version: dto.expectedVersion, status: { not: ExpenseStatus.VOIDED } },
            data: {
              status: ExpenseStatus.VOIDED,
              voidedAt: new Date(),
              voidedById: actor.id,
              voidReason: reason,
              updatedById: actor.id,
              version: { increment: 1 }
            }
          });
          if (updated.count !== 1)
            throw new ConflictException({
              code: "EXPENSE_VERSION_CONFLICT",
              message: "El gasto cambió mientras intentabas anularlo. Actualiza la información."
            });

          for (const movement of current.cashMovements) {
            await tx.cashMovement.create({
              data: {
                organizationId: actor.organizationId,
                branchId: expense.branchId,
                cashRegisterId: movement.cashRegisterId,
                type: CashMovementType.ADJUSTMENT,
                direction: CashMovementDirection.IN,
                amount: movement.amount,
                expenseId: expense.id,
                paymentMethodId: current.paymentMethodId,
                description: `Reversión de gasto GAS-${String(current.publicNumber).padStart(6, "0")}: ${reason}`,
                createdById: actor.id
              }
            });
          }

          await tx.auditLog.create({
            data: {
              organizationId: actor.organizationId,
              actorUserId: actor.id,
              entity: "Expense",
              entityId: current.id,
              action: "void",
              before: { status: current.status, total: current.total.toString(), version: current.version },
              after: { status: ExpenseStatus.VOIDED, reason, version: current.version + 1 }
            }
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      const mappedError = await this.mapExpenseMutationError(actor, expense.id, error, "void");
      await this.auditRejectedExpenseMutation(actor, expense, "void_rejected", mappedError);
      throw mappedError;
    }

    return this.getExpense(actor, expense.id);
  }

  async getExpense(actor: AuthUser, expenseId: string) {
    const publicNumber = this.parseExpenseNumber(expenseId);
    const expense = await this.prisma.expense.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        OR: [{ id: expenseId }, ...(publicNumber !== null ? [{ publicNumber }] : [])]
      },
      include: {
        branch: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true, type: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        voidedBy: { select: { id: true, firstName: true, lastName: true } },
        cashMovements: {
          select: {
            id: true,
            cashRegisterId: true,
            cashRegister: { select: expenseCashRegisterSelect }
          }
        }
      }
    });
    if (!expense) throw new NotFoundException("Expense not found");
    return this.serializeExpense(actor, expense);
  }

  private serializeExpense<T extends ExpensePolicySource>(actor: AuthUser, expense: T) {
    const policy = ExpensePolicy.evaluate(expense);
    const association = policy.cashSession ?? expense.cashMovements[0]?.cashRegister ?? null;
    return {
      ...expense,
      cashAssociation: {
        associated: Boolean(association),
        cashSessionNumber: association ? `CAJ-${String(association.publicNumber).padStart(6, "0")}` : null,
        responsibleName: association
          ? `${association.responsibleUser.firstName} ${association.responsibleUser.lastName}`.trim()
          : null,
        branchName: association?.branch.name ?? null,
        status: association?.status ?? null,
        closedAt: association?.closedAt ?? null,
        locked: policy.locked,
        lockReason: policy.lockReason
      },
      permissions: ExpensePolicy.capabilities(expense, actor.permissions)
    };
  }

  private async auditRejectedExpenseMutation(
    actor: AuthUser,
    expense: ExpensePolicySource & { id: string; branchId: string },
    action: "update_rejected" | "void_rejected",
    error: unknown
  ) {
    const response = error instanceof ConflictException ? error.getResponse() : null;
    const code =
      response && typeof response === "object" && "code" in response
        ? String((response as { code?: unknown }).code ?? "")
        : "";
    if (!code.startsWith("EXPENSE_LOCKED_BY_")) return;
    const policy = ExpensePolicy.evaluate(expense);
    const details =
      response && typeof response === "object" && "details" in response
        ? ((response as { details?: Record<string, unknown> }).details ?? {})
        : {};
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        branchId: expense.branchId,
        actorUserId: actor.id,
        entity: "Expense",
        entityId: expense.id,
        action,
        reason: code,
        after: {
          expenseNumber: `GAS-${String(expense.publicNumber).padStart(6, "0")}`,
          cashSessionNumber:
            details.cashSessionNumber ??
            (policy.cashSession ? `CAJ-${String(policy.cashSession.publicNumber).padStart(6, "0")}` : null),
          requestedFields: action === "update_rejected" ? "expense_update" : "expense_void"
        }
      }
    });
  }

  private async mapExpenseMutationError(
    actor: AuthUser,
    expenseId: string,
    error: unknown,
    action: "edit" | "void"
  ) {
    if (error instanceof BadRequestException || error instanceof ConflictException) return error;
    if (!(error instanceof Error) || !error.message.includes("EXPENSE_LOCKED_BY_CASH_SESSION")) return error;
    const current = await this.prisma.expense.findFirst({
      where: { id: expenseId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: expenseMutationInclude
    });
    if (current) {
      try {
        if (action === "edit") ExpensePolicy.assertCanEdit(current);
        else ExpensePolicy.assertCanVoid(current);
      } catch (mappedError) {
        return mappedError;
      }
    }
    return new ConflictException({
      code: "EXPENSE_LOCKED_BY_CASH_SESSION",
      message: "El gasto está protegido por una sesión de caja no modificable."
    });
  }

  private async ensureExpensePaymentMethod(actor: AuthUser, paymentMethodId: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, organizationId: actor.organizationId, isActive: true },
      select: { id: true }
    });
    if (!method) throw new BadRequestException("Invalid payment method");
  }

  private isUniqueCollision(error: unknown, field: string) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
    const target = (error.meta?.target as string[] | string | undefined) ?? "";
    return Array.isArray(target) ? target.includes(field) : String(target).includes(field);
  }

  private parseExpenseNumber(value: string) {
    const normalized = value.trim().replace(/^GAS-/i, "");
    return /^\d{1,9}$/.test(normalized) ? Number(normalized) : null;
  }

  async listPayroll(actor: AuthUser, branchId?: string, professionalId?: string) {
    const rows = await this.prisma.treatmentPlanItem.findMany({
      where: {
        status: TreatmentPlanItemStatus.COMPLETED,
        treatmentPlan: {
          organizationId: actor.organizationId,
          branchId: branchScope(actor, branchId),
          ...(professionalId ? { professionalId } : {})
        },
        paymentAllocations: { some: { payment: { status: { in: PAYROLL_PAYMENT_STATUSES } } } },
        payrollLiquidationItem: { is: null }
      },
      include: payrollTreatmentItemInclude,
      orderBy: { completedAt: "desc" }
    });

    const summaries = new Map<
      string,
      {
        professionalId: string;
        professionalName: string;
        commissionRate: number;
        completedItems: number;
        pendingItems: number;
        collectedAmount: number;
        payableAmount: number;
        lastCompletedAt: Date | null;
        items: PayrollItemView[];
      }
    >();

    for (const row of rows) {
      const professional = row.treatmentPlan.professional;
      const rule = await this.resolvePayrollRule(actor, row, Number(professional.commissionRate));
      const item = this.buildPayrollItem(row, rule);
      const current = summaries.get(professional.id) ?? {
        professionalId: professional.id,
        professionalName: `${professional.firstName} ${professional.lastName}`,
        commissionRate: rule.commissionRate,
        completedItems: 0,
        pendingItems: 0,
        collectedAmount: 0,
        payableAmount: 0,
        lastCompletedAt: null,
        items: []
      };
      if (item.isReady) {
        current.completedItems += 1;
        current.collectedAmount = this.roundMoney(current.collectedAmount + item.collectedAmount);
        current.payableAmount = this.roundMoney(current.payableAmount + item.payableAmount);
        current.items.push(item);
      } else {
        current.pendingItems += 1;
      }
      if (row.completedAt && (!current.lastCompletedAt || row.completedAt > current.lastCompletedAt)) {
        current.lastCompletedAt = row.completedAt;
      }
      summaries.set(professional.id, current);
    }

    return [...summaries.values()]
      .filter((summary) => summary.completedItems > 0)
      .sort((left, right) => right.payableAmount - left.payableAmount);
  }

  async listFinalizedPayroll(actor: AuthUser, branchId?: string) {
    const rows = await this.prisma.payrollLiquidation.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor, branchId)
      },
      include: {
        professional: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        finalizedBy: { select: { id: true, firstName: true, lastName: true } },
        items: { include: payrollLiquidationItemInclude, orderBy: { createdAt: "asc" } },
        _count: { select: { items: true } }
      },
      orderBy: { finalizedAt: "desc" }
    });

    return rows.map((row) => ({
      ...row,
      commissionRate: Number(row.commissionRate),
      collectedAmount: Number(row.collectedAmount),
      payableAmount: Number(row.payableAmount),
      items: row.items.map((item) =>
        this.buildFinalizedPayrollItem(item, Number(item.commissionRate ?? row.commissionRate))
      )
    }));
  }

  async recalculatePayroll(actor: AuthUser, branchId?: string, professionalId?: string) {
    if (branchId) assertBranchAccess(actor, branchId);
    if (professionalId) {
      const professional = await this.prisma.professional.findFirst({
        where: { id: professionalId, organizationId: actor.organizationId, isActive: true }
      });
      if (!professional) throw new NotFoundException("Professional not found");
    }

    const rows = await this.listPayroll(actor, branchId, professionalId);
    await this.auditConfiguration(
      actor,
      "PayrollActive",
      professionalId ?? actor.organizationId,
      "recalculate",
      {
        branchId: branchId ?? null,
        professionalId: professionalId ?? null,
        professionalCount: rows.length,
        payableAmount: this.roundMoney(rows.reduce((sum, row) => sum + row.payableAmount, 0))
      }
    );

    return rows;
  }

  async finalizePayroll(actor: AuthUser, dto: FinalizePayrollDto) {
    assertBranchAccess(actor, dto.branchId);
    const professional = await this.prisma.professional.findFirst({
      where: {
        id: dto.professionalId,
        organizationId: actor.organizationId,
        isActive: true
      }
    });
    if (!professional) throw new NotFoundException("Professional not found");

    const rows = await this.prisma.treatmentPlanItem.findMany({
      where: {
        status: TreatmentPlanItemStatus.COMPLETED,
        treatmentPlan: {
          organizationId: actor.organizationId,
          professionalId: professional.id,
          branchId: branchScope(actor, dto.branchId)
        },
        paymentAllocations: { some: { payment: { status: { in: PAYROLL_PAYMENT_STATUSES } } } },
        payrollLiquidationItem: { is: null }
      },
      include: payrollTreatmentItemInclude,
      orderBy: { completedAt: "desc" }
    });

    const payrollRows = await Promise.all(
      rows.map(async (row) => {
        const rule = await this.resolvePayrollRule(actor, row, Number(professional.commissionRate));
        const item = this.buildPayrollItem(row, rule);
        return { row, item, rule };
      })
    );
    const payableRows = payrollRows.filter(({ item }) => item.isReady);

    if (!payableRows.length) {
      throw new BadRequestException("No fully paid completed items are ready to finalize");
    }

    const summary = payableRows.reduce(
      (current, item) => ({
        completedItems: current.completedItems + 1,
        collectedAmount: this.roundMoney(current.collectedAmount + item.item.collectedAmount),
        payableAmount: this.roundMoney(current.payableAmount + item.item.payableAmount),
        lastCompletedAt:
          item.row.completedAt && (!current.lastCompletedAt || item.row.completedAt > current.lastCompletedAt)
            ? item.row.completedAt
            : current.lastCompletedAt
      }),
      {
        completedItems: 0,
        collectedAmount: 0,
        payableAmount: 0,
        lastCompletedAt: null as Date | null
      }
    );

    const primaryRule = payableRows[0]?.rule ?? this.fallbackPayrollRule(Number(professional.commissionRate));
    const created = await this.prisma.payrollLiquidation.create({
      data: {
        organizationId: actor.organizationId,
        professionalId: professional.id,
        branchId: dto.branchId,
        professionalContractId: primaryRule.contractId ?? undefined,
        contractSnapshot: primaryRule.contractId ? (primaryRule as Prisma.InputJsonValue) : undefined,
        commissionRate: primaryRule.commissionRate,
        completedItems: summary.completedItems,
        collectedAmount: this.toDecimal(summary.collectedAmount),
        payableAmount: this.toDecimal(summary.payableAmount),
        lastCompletedAt: summary.lastCompletedAt,
        finalizedById: actor.id,
        items: {
          create: payableRows.map((item) => ({
            treatmentPlanItemId: item.row.id,
            collectedAmount: this.toDecimal(item.item.collectedAmount),
            payableAmount: this.toDecimal(item.item.payableAmount),
            commissionRate: this.toDecimal(item.rule.commissionRate),
            contractRule: item.rule as Prisma.InputJsonValue
          }))
        }
      },
      include: {
        professional: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        finalizedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true } }
      }
    });

    await this.auditConfiguration(actor, "PayrollLiquidation", created.id, "finalize", {
      professionalId: professional.id,
      completedItems: summary.completedItems,
      payableAmount: summary.payableAmount
    });

    return created;
  }

  private auditConfiguration(
    actor: AuthUser,
    entity: string,
    entityId: string,
    action: string,
    payload: unknown
  ) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity,
        entityId,
        action,
        after: payload as Prisma.InputJsonValue
      }
    });
  }

  private async ensureAgreement(actor: AuthUser, id: string) {
    const agreement = await this.prisma.agreement.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!agreement) throw new NotFoundException("Agreement not found");
    return agreement;
  }

  private ensureAgreementFeatureEnabled() {
    if (process.env.AGREEMENTS_V2_ENABLED !== "true") {
      throw new BadRequestException("Versioned agreements are disabled by feature flag");
    }
  }

  private emitAgreementEvent(
    actor: AuthUser,
    agreementId: string,
    event: string,
    payload: Record<string, unknown>
  ) {
    return this.auditConfiguration(actor, "AgreementEvent", agreementId, `event.${event}`, payload);
  }

  private async ensureUsableAgreement(actor: AuthUser, id: string) {
    const agreement = await this.ensureAgreement(actor, id);
    if (agreement.status !== AgreementStatus.ACTIVE || !agreement.isActive) {
      throw new ConflictException("Agreement is not active");
    }
    const now = new Date();
    if ((agreement.startsAt && agreement.startsAt > now) || (agreement.endsAt && agreement.endsAt < now)) {
      throw new ConflictException("Agreement is outside its validity period");
    }
    return agreement;
  }

  private async currentAgreementVersion(
    actor: AuthUser,
    agreement: { id: string; version: number }
  ): Promise<AgreementOperationalVersion | null> {
    const version = await this.prisma.agreementVersion.findFirst({
      where: { agreementId: agreement.id, organizationId: actor.organizationId, version: agreement.version },
      include: agreementOperationalVersionInclude
    });
    if (version) return version;

    const current = await this.prisma.agreement.findFirst({
      where: { id: agreement.id, organizationId: actor.organizationId }
    });
    if (!current) return null;

    return this.prisma.agreementVersion.create({
      data: {
        ...this.agreementVersionCreateData(actor, this.agreementDtoFromRow(current), current.version),
        agreementId: current.id
      },
      include: agreementOperationalVersionInclude
    });
  }

  private agreementDtoFromRow(row: {
    name: string;
    entityName: string | null;
    entityTaxId: string | null;
    type: AgreementType;
    description: string | null;
    priceListId: string | null;
    discountPercent: Prisma.Decimal;
    coveragePercent: Prisma.Decimal;
    copayAmount: Prisma.Decimal;
    coverageLimitAmount: Prisma.Decimal | null;
    coverageRules: Prisma.JsonValue | null;
    startsAt: Date | null;
    endsAt: Date | null;
    appliesToLabs: boolean;
    appliesToOtherCategories: boolean;
    payrollDiscount: boolean;
    isPublic: boolean;
  }): CreateAgreementDto {
    return {
      name: row.name,
      entityName: row.entityName ?? undefined,
      entityTaxId: row.entityTaxId ?? undefined,
      type: row.type,
      description: row.description ?? undefined,
      priceListId: row.priceListId ?? undefined,
      discountPercent: Number(row.discountPercent),
      coveragePercent: Number(row.coveragePercent),
      copayAmount: Number(row.copayAmount),
      coverageLimitAmount: row.coverageLimitAmount === null ? undefined : Number(row.coverageLimitAmount),
      coverageRules: (row.coverageRules ?? undefined) as Record<string, unknown> | undefined,
      startsAt: row.startsAt?.toISOString(),
      endsAt: row.endsAt?.toISOString(),
      appliesToLabs: row.appliesToLabs,
      appliesToOtherCategories: row.appliesToOtherCategories,
      payrollDiscount: row.payrollDiscount,
      isPublic: row.isPublic,
      branchIds: [],
      categoryRules: [],
      procedureRules: []
    };
  }

  private ensureAgreementDates(startsAt?: string | Date | null, endsAt?: string | Date | null) {
    if (!startsAt || !endsAt) return;
    if (new Date(endsAt) < new Date(startsAt))
      throw new BadRequestException("Agreement end date must be on or after its start date");
  }

  private async validateAgreementReferences(actor: AuthUser, dto: CreateAgreementDto) {
    await this.ensurePriceList(actor, dto.priceListId);
    const branchIds = [...new Set(dto.branchIds ?? [])];
    if (branchIds.length) {
      if (branchIds.some((branchId) => !actor.branchIds.includes(branchId)))
        throw new BadRequestException("One or more agreement branches are outside your scope");
      const count = await this.prisma.branch.count({
        where: {
          organizationId: actor.organizationId,
          id: { in: branchIds },
          deletedAt: null,
          status: "ACTIVE"
        }
      });
      if (count !== branchIds.length)
        throw new BadRequestException("One or more agreement branches are invalid");
    }
    const procedureIds = [...new Set((dto.procedureRules ?? []).map((rule) => rule.procedureId))];
    if (procedureIds.length) {
      const count = await this.prisma.procedure.count({
        where: { organizationId: actor.organizationId, id: { in: procedureIds }, isActive: true }
      });
      if (count !== procedureIds.length)
        throw new BadRequestException("One or more agreement procedures are invalid");
    }
    const categoryIds = [...new Set((dto.categoryRules ?? []).map((rule) => rule.procedureCategoryId))];
    if (categoryIds.length) {
      const count = await this.prisma.procedureCategory.count({
        where: { organizationId: actor.organizationId, id: { in: categoryIds }, isActive: true }
      });
      if (count !== categoryIds.length)
        throw new BadRequestException("One or more agreement categories are invalid");
    }
  }

  private agreementVersionCreateData(
    actor: AuthUser,
    dto: CreateAgreementDto,
    version: number,
    agreementId?: string
  ) {
    return {
      ...(agreementId ? { agreementId } : {}),
      organizationId: actor.organizationId,
      version,
      entityName: this.cleanAgreementText(dto.entityName),
      entityTaxId: this.cleanAgreementText(dto.entityTaxId),
      type: dto.type ?? AgreementType.CORPORATE,
      description: this.cleanAgreementText(dto.description),
      priceListId: dto.priceListId || null,
      discountPercent: this.toDecimal(dto.discountPercent ?? 0),
      coveragePercent: this.toDecimal(dto.coveragePercent ?? 0),
      copayAmount: this.toDecimal(dto.copayAmount ?? 0),
      coverageLimitAmount:
        dto.coverageLimitAmount === undefined ? null : this.toDecimal(dto.coverageLimitAmount),
      coverageRules: (dto.coverageRules ?? undefined) as Prisma.InputJsonValue | undefined,
      startsAt: this.dateOrNull(dto.startsAt),
      endsAt: this.dateOrNull(dto.endsAt),
      createdById: actor.id,
      branches: dto.branchIds?.length
        ? {
            create: [...new Set(dto.branchIds)].map((branchId) => ({
              organizationId: actor.organizationId,
              branchId
            }))
          }
        : undefined,
      categoryRules: dto.categoryRules?.length
        ? {
            create: this.categoryRuleData(actor, undefined, dto.categoryRules).map(
              ({ agreementVersionId: _ignored, ...rule }) => rule
            )
          }
        : undefined,
      procedureRules: dto.procedureRules?.length
        ? {
            create: this.procedureRuleData(actor, undefined, dto.procedureRules).map(
              ({ agreementVersionId: _ignored, ...rule }) => rule
            )
          }
        : undefined
    };
  }

  private agreementVersionUpdateData(dto: CreateAgreementDto, actor: AuthUser) {
    const data = this.agreementVersionCreateData(actor, dto, 1);
    const {
      organizationId: _organizationId,
      version: _version,
      branches: _branches,
      categoryRules: _categoryRules,
      procedureRules: _procedureRules,
      ...update
    } = data;
    return update;
  }

  private agreementMainUpdateData(dto: CreateAgreementDto) {
    return {
      name: dto.name.trim(),
      entityName: this.cleanAgreementText(dto.entityName),
      entityTaxId: this.cleanAgreementText(dto.entityTaxId),
      type: dto.type ?? AgreementType.CORPORATE,
      description: this.cleanAgreementText(dto.description),
      priceListId: dto.priceListId || null,
      startsAt: this.dateOrNull(dto.startsAt),
      endsAt: this.dateOrNull(dto.endsAt),
      discountPercent: this.toDecimal(dto.discountPercent ?? 0),
      coveragePercent: this.toDecimal(dto.coveragePercent ?? 0),
      copayAmount: this.toDecimal(dto.copayAmount ?? 0),
      coverageLimitAmount:
        dto.coverageLimitAmount === undefined ? null : this.toDecimal(dto.coverageLimitAmount),
      coverageRules: (dto.coverageRules ?? undefined) as Prisma.InputJsonValue | undefined,
      appliesToLabs: dto.appliesToLabs ?? false,
      appliesToOtherCategories: dto.appliesToOtherCategories ?? false,
      payrollDiscount: dto.payrollDiscount ?? false,
      isPublic: dto.isPublic ?? true
    };
  }

  private agreementMainFromVersion(version: {
    entityName: string | null;
    entityTaxId: string | null;
    type: AgreementType;
    description: string | null;
    priceListId: string | null;
    discountPercent: Prisma.Decimal;
    coveragePercent: Prisma.Decimal;
    copayAmount: Prisma.Decimal;
    coverageLimitAmount: Prisma.Decimal | null;
    coverageRules: Prisma.JsonValue | null;
    startsAt: Date | null;
    endsAt: Date | null;
  }) {
    return {
      entityName: version.entityName,
      entityTaxId: version.entityTaxId,
      type: version.type,
      description: version.description,
      priceListId: version.priceListId,
      discountPercent: version.discountPercent,
      coveragePercent: version.coveragePercent,
      copayAmount: version.copayAmount,
      coverageLimitAmount: version.coverageLimitAmount,
      coverageRules: version.coverageRules ?? undefined,
      startsAt: version.startsAt,
      endsAt: version.endsAt
    };
  }

  private mergeAgreementDto(current: Record<string, unknown>, patch: CreateAgreementDto): CreateAgreementDto {
    const currentBranches = Array.isArray(current.branches)
      ? current.branches
          .map((row) =>
            row && typeof row === "object" ? (row as { branchId?: unknown }).branchId : undefined
          )
          .filter((branchId): branchId is string => typeof branchId === "string")
      : undefined;
    const currentCategoryRules = Array.isArray(current.categoryRules)
      ? current.categoryRules.map((row) => this.categoryRuleDtoFromRow(row as never))
      : undefined;
    const currentProcedureRules = Array.isArray(current.procedureRules)
      ? current.procedureRules.map((row) => this.ruleDtoFromRow(row as never))
      : undefined;
    return {
      name: patch.name ?? String(current.name ?? ""),
      entityName: patch.entityName ?? this.stringOrUndefined(current.entityName),
      entityTaxId: patch.entityTaxId ?? this.stringOrUndefined(current.entityTaxId),
      type: patch.type ?? (current.type as AgreementType | undefined),
      description: patch.description ?? this.stringOrUndefined(current.description),
      priceListId: patch.priceListId ?? this.stringOrUndefined(current.priceListId),
      discountPercent: patch.discountPercent ?? this.numberOrZero(current.discountPercent),
      coveragePercent: patch.coveragePercent ?? this.numberOrZero(current.coveragePercent),
      copayAmount: patch.copayAmount ?? this.numberOrZero(current.copayAmount),
      coverageLimitAmount: patch.coverageLimitAmount ?? this.numberOrUndefined(current.coverageLimitAmount),
      coverageRules: patch.coverageRules ?? (current.coverageRules as Record<string, unknown> | undefined),
      startsAt: patch.startsAt ?? this.dateStringOrUndefined(current.startsAt),
      endsAt: patch.endsAt ?? this.dateStringOrUndefined(current.endsAt),
      appliesToLabs: patch.appliesToLabs ?? Boolean(current.appliesToLabs),
      appliesToOtherCategories: patch.appliesToOtherCategories ?? Boolean(current.appliesToOtherCategories),
      payrollDiscount: patch.payrollDiscount ?? Boolean(current.payrollDiscount),
      isPublic: patch.isPublic ?? Boolean(current.isPublic),
      branchIds: patch.branchIds ?? currentBranches,
      categoryRules: patch.categoryRules ?? currentCategoryRules,
      procedureRules: patch.procedureRules ?? currentProcedureRules
    };
  }

  private categoryRuleData(
    actor: AuthUser,
    agreementVersionId: string | undefined,
    rules: AgreementCategoryRuleDto[]
  ) {
    return rules.map((rule) => ({
      ...(agreementVersionId ? { agreementVersionId } : {}),
      organizationId: actor.organizationId,
      procedureCategoryId: rule.procedureCategoryId,
      isEligible: rule.isEligible ?? true,
      preferredPrice: rule.preferredPrice === undefined ? null : this.toDecimal(rule.preferredPrice),
      discountPercent: rule.discountPercent === undefined ? null : this.toDecimal(rule.discountPercent),
      coveragePercent: rule.coveragePercent === undefined ? null : this.toDecimal(rule.coveragePercent),
      copayAmount: rule.copayAmount === undefined ? null : this.toDecimal(rule.copayAmount),
      coverageLimitAmount:
        rule.coverageLimitAmount === undefined ? null : this.toDecimal(rule.coverageLimitAmount),
      coverageRules: (rule.coverageRules ?? undefined) as Prisma.InputJsonValue | undefined
    }));
  }

  private procedureRuleData(
    actor: AuthUser,
    agreementVersionId: string | undefined,
    rules: AgreementProcedureRuleDto[]
  ) {
    return rules.map((rule) => ({
      ...(agreementVersionId ? { agreementVersionId } : {}),
      organizationId: actor.organizationId,
      procedureId: rule.procedureId,
      isEligible: rule.isEligible ?? true,
      preferredPrice: rule.preferredPrice === undefined ? null : this.toDecimal(rule.preferredPrice),
      discountPercent: rule.discountPercent === undefined ? null : this.toDecimal(rule.discountPercent),
      coveragePercent: rule.coveragePercent === undefined ? null : this.toDecimal(rule.coveragePercent),
      copayAmount: rule.copayAmount === undefined ? null : this.toDecimal(rule.copayAmount),
      coverageLimitAmount:
        rule.coverageLimitAmount === undefined ? null : this.toDecimal(rule.coverageLimitAmount),
      coverageRules: (rule.coverageRules ?? undefined) as Prisma.InputJsonValue | undefined
    }));
  }

  private ruleDtoFromRow(rule: {
    procedureId: string;
    isEligible: boolean;
    preferredPrice: Prisma.Decimal | null;
    discountPercent: Prisma.Decimal | null;
    coveragePercent: Prisma.Decimal | null;
    copayAmount: Prisma.Decimal | null;
    coverageLimitAmount: Prisma.Decimal | null;
    coverageRules: Prisma.JsonValue | null;
  }): AgreementProcedureRuleDto {
    return {
      procedureId: rule.procedureId,
      isEligible: rule.isEligible,
      preferredPrice: rule.preferredPrice ? Number(rule.preferredPrice) : undefined,
      discountPercent: rule.discountPercent ? Number(rule.discountPercent) : undefined,
      coveragePercent: rule.coveragePercent ? Number(rule.coveragePercent) : undefined,
      copayAmount: rule.copayAmount ? Number(rule.copayAmount) : undefined,
      coverageLimitAmount: rule.coverageLimitAmount ? Number(rule.coverageLimitAmount) : undefined,
      coverageRules: (rule.coverageRules ?? undefined) as Record<string, unknown> | undefined
    };
  }

  private categoryRuleDtoFromRow(rule: {
    procedureCategoryId: string;
    isEligible: boolean;
    preferredPrice: Prisma.Decimal | null;
    discountPercent: Prisma.Decimal | null;
    coveragePercent: Prisma.Decimal | null;
    copayAmount: Prisma.Decimal | null;
    coverageLimitAmount: Prisma.Decimal | null;
    coverageRules: Prisma.JsonValue | null;
  }): AgreementCategoryRuleDto {
    return {
      procedureCategoryId: rule.procedureCategoryId,
      isEligible: rule.isEligible,
      preferredPrice: rule.preferredPrice ? Number(rule.preferredPrice) : undefined,
      discountPercent: rule.discountPercent ? Number(rule.discountPercent) : undefined,
      coveragePercent: rule.coveragePercent ? Number(rule.coveragePercent) : undefined,
      copayAmount: rule.copayAmount ? Number(rule.copayAmount) : undefined,
      coverageLimitAmount: rule.coverageLimitAmount ? Number(rule.coverageLimitAmount) : undefined,
      coverageRules: (rule.coverageRules ?? undefined) as Record<string, unknown> | undefined
    };
  }

  private ensureAgreementBranchScope(branches: Array<{ branchId: string }>, branchIds: string[]) {
    const allowed = new Set(branches.map((branch) => branch.branchId));
    if (branchIds.some((branchId) => !allowed.has(branchId))) {
      throw new BadRequestException("Agreement is not valid for one or more selected branches");
    }
  }

  private async ensureNoAgreementOverlap(
    actor: AuthUser,
    agreement: { id: string; entityTaxId: string | null; entityName: string | null },
    version: { startsAt: Date | null; endsAt: Date | null; branches: Array<{ branchId: string }> }
  ) {
    if (!version.startsAt || !version.endsAt) return;
    const entityKey = agreement.entityTaxId ?? agreement.entityName;
    if (!entityKey) return;
    const candidates = await this.prisma.agreement.findMany({
      where: {
        organizationId: actor.organizationId,
        id: { not: agreement.id },
        status: { in: [AgreementStatus.ACTIVE, AgreementStatus.SCHEDULED] },
        OR: [{ entityTaxId: agreement.entityTaxId }, { entityName: agreement.entityName }]
      },
      select: {
        id: true,
        version: true,
        startsAt: true,
        endsAt: true,
        versions: { include: { branches: true } }
      }
    });
    const conflicts = candidates.some((candidate) => {
      if (!candidate.startsAt || !candidate.endsAt) return false;
      const versionStartsAt = version.startsAt!;
      const versionEndsAt = version.endsAt!;
      const overlaps = candidate.startsAt <= versionEndsAt && candidate.endsAt >= versionStartsAt;
      const activeVersion = candidate.versions.find((row) => row.version === candidate.version);
      const existingBranches = activeVersion?.branches.map((branch) => branch.branchId) ?? [];
      return overlaps && version.branches.some((branch) => existingBranches.includes(branch.branchId));
    });
    if (conflicts)
      throw new ConflictException(
        "Agreement overlaps an active or scheduled agreement for the same entity and branch"
      );
  }

  private async calculateAgreementPrice(
    actor: AuthUser,
    agreement: { id: string; name: string; version: number },
    version: {
      id: string;
      version: number;
      priceListId: string | null;
      discountPercent: Prisma.Decimal;
      coveragePercent: Prisma.Decimal;
      copayAmount: Prisma.Decimal;
      coverageLimitAmount: Prisma.Decimal | null;
      coverageRules: Prisma.JsonValue | null;
      branches: Array<{ branchId: string }>;
      categoryRules: Array<{
        procedureCategoryId: string;
        isEligible: boolean;
        preferredPrice: Prisma.Decimal | null;
        discountPercent: Prisma.Decimal | null;
        coveragePercent: Prisma.Decimal | null;
        copayAmount: Prisma.Decimal | null;
        coverageLimitAmount: Prisma.Decimal | null;
        coverageRules: Prisma.JsonValue | null;
      }>;
      procedureRules: Array<{
        procedureId: string;
        isEligible: boolean;
        preferredPrice: Prisma.Decimal | null;
        discountPercent: Prisma.Decimal | null;
        coveragePercent: Prisma.Decimal | null;
        copayAmount: Prisma.Decimal | null;
        coverageLimitAmount: Prisma.Decimal | null;
        coverageRules: Prisma.JsonValue | null;
      }>;
    },
    branchId: string,
    procedureId: string,
    quantity: number
  ) {
    this.ensureAgreementBranchScope(version.branches, [branchId]);
    const procedure = await this.prisma.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId, isActive: true },
      select: { id: true, code: true, name: true, categoryId: true }
    });
    if (!procedure) throw new BadRequestException("Invalid procedureId");
    const procedureRule = version.procedureRules.find((item) => item.procedureId === procedureId);
    const categoryRule = version.categoryRules.find(
      (item) => item.procedureCategoryId === procedure.categoryId
    );
    const rule = procedureRule ?? categoryRule;
    if (version.categoryRules.length && !categoryRule && !procedureRule)
      throw new BadRequestException("Procedure category is not eligible for this agreement");
    if (rule && !rule.isEligible)
      throw new BadRequestException("Procedure is not eligible for this agreement");
    const price =
      (await this.prisma.priceListItem.findFirst({
        where: {
          procedureId,
          priceListId: version.priceListId ?? undefined,
          priceList: { organizationId: actor.organizationId, isActive: true }
        },
        select: { price: true, priceListId: true }
      })) ??
      (await this.prisma.priceListItem.findFirst({
        where: {
          procedureId,
          priceList: { organizationId: actor.organizationId, isActive: true, isDefault: true }
        },
        select: { price: true, priceListId: true }
      }));
    if (!price) throw new BadRequestException("Procedure has no active price for agreement preview");
    const normalPrice = Number(price.price);
    const preferredPrice =
      rule?.preferredPrice === null || rule?.preferredPrice === undefined
        ? normalPrice
        : Number(rule.preferredPrice);
    const discountPercent = Number(rule?.discountPercent ?? version.discountPercent);
    const appliedPrice = this.roundMoney(preferredPrice * (1 - discountPercent / 100));
    const coveragePercent = Number(rule?.coveragePercent ?? version.coveragePercent);
    const copay = Number(rule?.copayAmount ?? version.copayAmount);
    const grossCoverage = this.roundMoney(
      Math.max(0, appliedPrice * quantity - copay) * (coveragePercent / 100)
    );
    const limit = rule?.coverageLimitAmount ?? version.coverageLimitAmount;
    const coverageAmount = limit ? Math.min(grossCoverage, Number(limit)) : grossCoverage;
    const patientTotal = this.roundMoney(appliedPrice * quantity - coverageAmount);
    return {
      agreementId: agreement.id,
      agreementName: agreement.name,
      agreementVersion: version.version,
      procedure,
      priceListId: price.priceListId,
      quantity,
      normalPrice,
      appliedPrice,
      discountAmount: this.roundMoney((normalPrice - appliedPrice) * quantity),
      coverageAmount: this.roundMoney(coverageAmount),
      patientTotal,
      copayAmount: copay,
      coverageRules: rule?.coverageRules ?? version.coverageRules ?? null
    };
  }

  private agreementSnapshot(
    agreement: { id: string; name: string; version: number },
    version: {
      id: string;
      priceListId?: string | null;
      priceList?: { id: string; name: string } | null;
      coverageRules: Prisma.JsonValue | null;
    }
  ) {
    return {
      agreementId: agreement.id,
      agreementName: agreement.name,
      version: agreement.version,
      agreementVersionId: version.id,
      priceListId: version.priceListId ?? version.priceList?.id ?? null,
      priceListName: version.priceList?.name ?? null,
      coverageRules: version.coverageRules ?? null
    } as Prisma.InputJsonValue;
  }

  private cleanAgreementText(value?: string | null) {
    const text = value?.trim();
    return text || null;
  }

  private async resolveAgreementCompany(actor: AuthUser, dto: CreateAgreementDto) {
    const legalName = this.cleanAgreementText(dto.entityName) ?? dto.name.trim();
    const taxId = this.cleanAgreementText(dto.entityTaxId);
    const existing = await this.prisma.company.findFirst({
      where: {
        organizationId: actor.organizationId,
        OR: [...(taxId ? [{ taxId }] : []), { legalName }]
      }
    });
    if (existing) return existing;
    return this.prisma.company.create({
      data: { organizationId: actor.organizationId, legalName, taxId }
    });
  }

  private dateOrNull(value?: string | null) {
    return value ? new Date(value) : null;
  }

  private stringOrUndefined(value: unknown) {
    return typeof value === "string" ? value : undefined;
  }

  private numberOrZero(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private numberOrUndefined(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private dateStringOrUndefined(value: unknown) {
    return value instanceof Date ? value.toISOString() : undefined;
  }

  private async ensurePriceList(actor: AuthUser, priceListId?: string) {
    if (!priceListId) return;
    const list = await this.prisma.priceList.findFirst({
      where: { id: priceListId, organizationId: actor.organizationId, isActive: true }
    });
    if (!list) throw new BadRequestException("Invalid price list");
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private toDecimal(value: number) {
    return new Prisma.Decimal(this.roundMoney(value));
  }

  private async resolvePayrollRule(
    actor: AuthUser,
    row: PayrollTreatmentItemSource,
    fallbackCommissionRate: number
  ): Promise<PayrollRuleSnapshot> {
    const completedAt = row.completedAt ?? new Date();
    const contract = await this.prisma.professionalContract.findFirst({
      where: {
        organizationId: actor.organizationId,
        professionalId: row.treatmentPlan.professional.id,
        isActive: true,
        startsAt: { lte: completedAt },
        OR: [{ endsAt: null }, { endsAt: { gte: completedAt } }],
        branches: { some: { branchId: row.treatmentPlan.branchId } }
      },
      include: payrollContractInclude,
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }]
    });

    if (!contract) return this.fallbackPayrollRule(fallbackCommissionRate);
    return this.contractRuleForItem(contract, row);
  }

  private fallbackPayrollRule(commissionRate: number): PayrollRuleSnapshot {
    return {
      source: "PROFESSIONAL_FALLBACK",
      commissionRate: this.roundMoney(commissionRate)
    };
  }

  private contractRuleForItem(
    contract: PayrollContractSource,
    row: PayrollTreatmentItemSource
  ): PayrollRuleSnapshot {
    const fixedAmount = contract.fixedAmounts.find((amount) => amount.procedureId === row.procedure.id);
    if (fixedAmount) {
      return {
        ...this.baseContractRule(contract),
        source: "FIXED_AMOUNT",
        fixedAmount: this.roundMoney(Number(fixedAmount.amount)),
        priceListId: fixedAmount.priceListId ?? contract.priceListId
      };
    }

    const categoryRate = contract.categoryRates.find(
      (rate) => rate.procedureCategoryId === row.procedure.categoryId
    );
    if (categoryRate) {
      return {
        ...this.baseContractRule(contract),
        source: "CATEGORY_RATE",
        commissionRate: this.roundMoney(Number(categoryRate.rate)),
        procedureCategoryId: categoryRate.procedureCategoryId
      };
    }

    return {
      ...this.baseContractRule(contract),
      source: "CONTRACT_RATE"
    };
  }

  private baseContractRule(contract: PayrollContractSource): PayrollRuleSnapshot {
    return {
      source: "CONTRACT_RATE",
      contractId: contract.id,
      contractType: contract.contractType,
      commissionBase: contract.commissionBase,
      paymentDiscount: contract.paymentDiscount,
      paymentCondition: contract.paymentCondition,
      commissionRate: this.roundMoney(Number(contract.commissionRate)),
      priceListId: contract.priceListId,
      priceListName: contract.priceListName
    };
  }

  private parseStoredPayrollRule(
    value: Prisma.JsonValue | null,
    fallbackCommissionRate: number
  ): PayrollRuleSnapshot {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return this.fallbackPayrollRule(fallbackCommissionRate);
    const record = value as Record<string, unknown>;
    const source = record.source;
    const commissionRate = Number(record.commissionRate);
    return {
      source:
        source === "FIXED_AMOUNT" || source === "CATEGORY_RATE" || source === "CONTRACT_RATE"
          ? source
          : "PROFESSIONAL_FALLBACK",
      commissionRate: Number.isFinite(commissionRate)
        ? this.roundMoney(commissionRate)
        : this.roundMoney(fallbackCommissionRate),
      contractId: this.textOrNull(record.contractId),
      contractType: this.textOrNull(record.contractType),
      commissionBase: this.textOrNull(record.commissionBase),
      paymentDiscount: this.textOrNull(record.paymentDiscount),
      paymentCondition: this.textOrNull(record.paymentCondition),
      priceListId: this.textOrNull(record.priceListId),
      priceListName: this.textOrNull(record.priceListName),
      procedureCategoryId: this.textOrNull(record.procedureCategoryId),
      fixedAmount: Number.isFinite(Number(record.fixedAmount))
        ? this.roundMoney(Number(record.fixedAmount))
        : null
    };
  }

  private textOrNull(value: unknown) {
    return typeof value === "string" ? value : null;
  }

  private buildPayrollItem(row: PayrollTreatmentItemSource, rule: PayrollRuleSnapshot): PayrollItemView {
    const treatmentAmount = this.roundMoney(Number(row.total));
    const rawCollectedAmount = row.paymentAllocations.reduce(
      (sum, allocation) => sum + Number(allocation.amount),
      0
    );
    const collectedAmount = this.roundMoney(Math.min(treatmentAmount, rawCollectedAmount));
    const isReady = collectedAmount >= treatmentAmount;
    const payableAmount =
      rule.source === "FIXED_AMOUNT" && rule.fixedAmount !== undefined && rule.fixedAmount !== null
        ? this.roundMoney(rule.fixedAmount)
        : this.roundMoney(collectedAmount * (rule.commissionRate / 100));
    const patient = row.treatmentPlan.patient;
    const paymentMethodNames = [
      ...new Set(
        row.paymentAllocations.map((allocation) => allocation.payment.paymentMethod?.name).filter(Boolean)
      )
    ];
    const paymentIds = [...new Set(row.paymentAllocations.map((allocation) => allocation.payment.id))];
    const paymentDates = row.paymentAllocations
      .map((allocation) => allocation.payment.paidAt)
      .filter((date): date is Date => Boolean(date))
      .sort((left, right) => left.getTime() - right.getTime());
    const firstPaymentAt = paymentDates[0] ?? null;
    const lastPaymentAt = paymentDates[paymentDates.length - 1] ?? null;

    return {
      treatmentPlanItemId: row.id,
      treatmentNumber: row.treatmentPlan.id.slice(-6).toUpperCase(),
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`.trim(),
      action: row.procedure.name,
      procedureCode: row.procedure.code,
      priceSource: row.priceSource,
      priceSnapshotName: row.priceSnapshotName,
      priceSnapshotCode: row.priceSnapshotCode,
      priceSnapshotCategory: row.priceSnapshotCategory,
      completedAt: row.completedAt,
      firstPaymentAt,
      lastPaymentAt,
      toothNumber: row.toothNumber,
      surface: row.surface,
      treatmentAmount,
      collectedAmount,
      rawCollectedAmount: this.roundMoney(rawCollectedAmount),
      payableAmount,
      commissionRate: rule.commissionRate,
      paymentMethods: paymentMethodNames.length ? paymentMethodNames.join(", ") : "Sin metodo",
      paymentIds,
      cashValidated: row.paymentAllocations.some((allocation) => allocation.payment.cashMovements.length > 0),
      isReady,
      status: isReady ? "VALID" : "PARTIAL_PAYMENT",
      contractRule: rule,
      calculationExplanation: this.describePayrollRule(collectedAmount, payableAmount, rule)
    };
  }

  private buildFinalizedPayrollItem(item: PayrollLiquidationItemSource, commissionRate: number) {
    const rule = this.parseStoredPayrollRule(item.contractRule, commissionRate);
    const row = this.buildPayrollItem(item.treatmentPlanItem, rule);
    const collectedAmount = this.roundMoney(Number(item.collectedAmount));
    const payableAmount = this.roundMoney(Number(item.payableAmount));

    return {
      ...row,
      collectedAmount,
      payableAmount,
      isReady: true,
      status: "FINALIZED",
      calculationExplanation: this.describePayrollRule(collectedAmount, payableAmount, rule)
    };
  }

  private describePayrollRule(collectedAmount: number, payableAmount: number, rule: PayrollRuleSnapshot) {
    if (rule.source === "FIXED_AMOUNT" && rule.fixedAmount !== undefined && rule.fixedAmount !== null) {
      const source = rule.priceListName ? ` desde arancel ${rule.priceListName}` : "";
      return `Monto fijo ${this.formatMoney(rule.fixedAmount)}${source} = ${this.formatMoney(payableAmount)}`;
    }

    const label =
      rule.source === "CATEGORY_RATE"
        ? "porcentaje avanzado por categoria"
        : rule.source === "CONTRACT_RATE"
          ? "porcentaje de contrato"
          : "comision global legacy";
    return `${this.formatMoney(collectedAmount)} x ${rule.commissionRate}% (${label}) = ${this.formatMoney(payableAmount)}`;
  }

  private formatMoney(value: number) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 2
    }).format(value);
  }
}
