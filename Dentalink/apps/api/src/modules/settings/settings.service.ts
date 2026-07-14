import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentStatus, Prisma, TreatmentPlanItemStatus } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { assertBranchAccess, branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateFinancialInstitutionDto, UpdateFinancialInstitutionDto } from "./dto/financial-institution.dto";
import {
  AssignAgreementPatientsDto,
  CreateAgreementDto,
  CreateExpenseDto,
  FinalizePayrollDto,
  UpdateAgreementDto
} from "./dto/admin-workflows.dto";
import { UpdateGeneralSettingsDto } from "./dto/update-general-settings.dto";

const PAYROLL_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.RECEIVED,
  PaymentStatus.PARTIALLY_ALLOCATED,
  PaymentStatus.ALLOCATED
];

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

type PayrollTreatmentItemSource = Prisma.TreatmentPlanItemGetPayload<{ include: typeof payrollTreatmentItemInclude }>;
type PayrollLiquidationItemSource = Prisma.PayrollLiquidationItemGetPayload<{
  include: typeof payrollLiquidationItemInclude;
}>;
type PayrollContractSource = Prisma.ProfessionalContractGetPayload<{ include: typeof payrollContractInclude }>;
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

  async listFinancialInstitutions(actor: AuthUser, search?: string, active?: string, page?: number, pageSize?: number) {
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
    await this.auditConfiguration(actor, "FinancialInstitution", created.id, "create", { name: created.name });
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
        _count: { select: { patients: true } }
      },
      skip,
      take,
      orderBy: { name: "asc" }
    });
  }

  async createAgreement(actor: AuthUser, dto: CreateAgreementDto) {
    await this.ensurePriceList(actor, dto.priceListId);
    const agreement = await this.prisma.agreement.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        priceListId: dto.priceListId || null,
        discountPercent: this.toDecimal(dto.discountPercent ?? 0),
        appliesToLabs: dto.appliesToLabs ?? false,
        appliesToOtherCategories: dto.appliesToOtherCategories ?? false,
        payrollDiscount: dto.payrollDiscount ?? false,
        isPublic: dto.isPublic ?? true
      },
      include: {
        priceList: { select: { id: true, name: true, isDefault: true } },
        _count: { select: { patients: true } }
      }
    });
    await this.auditConfiguration(actor, "Agreement", agreement.id, "create", {
      name: agreement.name,
      priceListId: agreement.priceListId,
      discountPercent: agreement.discountPercent
    });
    return agreement;
  }

  async updateAgreement(actor: AuthUser, id: string, dto: UpdateAgreementDto) {
    const current = await this.prisma.agreement.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!current) throw new NotFoundException("Agreement not found");
    await this.ensurePriceList(actor, dto.priceListId);

    const updated = await this.prisma.agreement.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        priceListId: dto.priceListId || null,
        discountPercent: dto.discountPercent === undefined ? undefined : this.toDecimal(dto.discountPercent),
        appliesToLabs: dto.appliesToLabs,
        appliesToOtherCategories: dto.appliesToOtherCategories,
        payrollDiscount: dto.payrollDiscount,
        isPublic: dto.isPublic,
        isActive: dto.isActive
      },
      include: {
        priceList: { select: { id: true, name: true, isDefault: true } },
        _count: { select: { patients: true } }
      }
    });

    await this.auditConfiguration(actor, "Agreement", id, "update", {
      before: { name: current.name, priceListId: current.priceListId, isActive: current.isActive },
      after: { name: updated.name, priceListId: updated.priceListId, isActive: updated.isActive }
    });
    return updated;
  }

  async deactivateAgreement(actor: AuthUser, id: string) {
    return this.updateAgreement(actor, id, { isActive: false } as UpdateAgreementDto);
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

    const summaries = new Map<string, { id: string; companyName: string; agreementName: string; debt: number }>();
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
    const agreement = await this.prisma.agreement.findFirst({
      where: { id, organizationId: actor.organizationId, isActive: true }
    });
    if (!agreement) throw new NotFoundException("Agreement not found");

    const patientIds = [...new Set(dto.patientIds.map((patientId) => patientId.trim()).filter(Boolean))];
    if (!patientIds.length) throw new BadRequestException("At least one patient is required");

    const patients = await this.prisma.patient.count({
      where: { id: { in: patientIds }, organizationId: actor.organizationId, deletedAt: null }
    });
    if (patients !== patientIds.length) throw new BadRequestException("One or more patients are invalid");

    const result = await this.prisma.patient.updateMany({
      where: { id: { in: patientIds }, organizationId: actor.organizationId, deletedAt: null },
      data: { agreementId: agreement.id }
    });
    await this.auditConfiguration(actor, "Agreement", agreement.id, "assign_patients", { patientIds });
    return { updated: result.count };
  }

  async listExpenses(actor: AuthUser, search?: string, branchId?: string, month?: number, year?: number, page?: number, pageSize?: number) {
    const { skip, take } = resolvePagination({ page, pageSize });
    return this.prisma.expense.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor, branchId),
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
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        cashMovements: { select: { id: true, cashRegisterId: true } }
      },
      skip,
      take,
      orderBy: { paidAt: "desc" }
    });
  }

  async createExpense(actor: AuthUser, dto: CreateExpenseDto) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchScope(actor, dto.branchId), organizationId: actor.organizationId, deletedAt: null, status: "ACTIVE" }
    });
    if (!branch) throw new BadRequestException("Invalid branch");

    const quantity = this.roundMoney(dto.quantity);
    const unitCost = this.roundMoney(dto.unitCost);
    const total = this.roundMoney(quantity * unitCost);
    const categoryName = dto.categoryName.trim();
    if (!categoryName) throw new BadRequestException("Expense category is required");

    const expenseId = await this.prisma.$transaction(async (tx) => {
      const category = await tx.expenseCategory.upsert({
        where: { organizationId_name: { organizationId: actor.organizationId, name: categoryName } },
        create: { organizationId: actor.organizationId, name: categoryName },
        update: { isActive: true }
      });
      const expense = await tx.expense.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          categoryId: category.id,
          description: dto.description.trim(),
          quantity: this.toDecimal(quantity),
          unitCost: this.toDecimal(unitCost),
          total: this.toDecimal(total),
          invoicedAt: dto.invoicedAt ? new Date(dto.invoicedAt) : null,
          paidAt: new Date(dto.paidAt),
          notes: dto.notes?.trim(),
          createdById: actor.id
        }
      });

      if (dto.assignToOpenCash) {
        const openRegister = await tx.cashRegister.findFirst({
          where: {
            organizationId: actor.organizationId,
            branchId: dto.branchId,
            status: "OPEN"
          },
          orderBy: { openedAt: "desc" }
        });
        if (!openRegister) throw new BadRequestException("Open a cash register before assigning the expense");
        await tx.cashMovement.create({
          data: {
            cashRegisterId: openRegister.id,
            type: "EXPENSE",
            amount: this.toDecimal(total),
            expenseId: expense.id,
            description: `Gasto ${expense.description}`,
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
            branchId: dto.branchId,
            categoryName,
            description: expense.description,
            total
          }
        }
      });
      return expense.id;
    });

    return this.prisma.expense.findFirst({
      where: { id: expenseId, organizationId: actor.organizationId },
      include: {
        branch: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        cashMovements: { select: { id: true, cashRegisterId: true } }
      }
    });
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
      const current =
        summaries.get(professional.id) ??
        {
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
      items: row.items.map((item) => this.buildFinalizedPayrollItem(item, Number(item.commissionRate ?? row.commissionRate)))
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
    await this.auditConfiguration(actor, "PayrollActive", professionalId ?? actor.organizationId, "recalculate", {
      branchId: branchId ?? null,
      professionalId: professionalId ?? null,
      professionalCount: rows.length,
      payableAmount: this.roundMoney(rows.reduce((sum, row) => sum + row.payableAmount, 0))
    });

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

  private auditConfiguration(actor: AuthUser, entity: string, entityId: string, action: string, payload: unknown) {
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

  private contractRuleForItem(contract: PayrollContractSource, row: PayrollTreatmentItemSource): PayrollRuleSnapshot {
    const fixedAmount = contract.fixedAmounts.find((amount) => amount.procedureId === row.procedure.id);
    if (fixedAmount) {
      return {
        ...this.baseContractRule(contract),
        source: "FIXED_AMOUNT",
        fixedAmount: this.roundMoney(Number(fixedAmount.amount)),
        priceListId: fixedAmount.priceListId ?? contract.priceListId
      };
    }

    const categoryRate = contract.categoryRates.find((rate) => rate.procedureCategoryId === row.procedure.categoryId);
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

  private parseStoredPayrollRule(value: Prisma.JsonValue | null, fallbackCommissionRate: number): PayrollRuleSnapshot {
    if (!value || typeof value !== "object" || Array.isArray(value)) return this.fallbackPayrollRule(fallbackCommissionRate);
    const record = value as Record<string, unknown>;
    const source = record.source;
    const commissionRate = Number(record.commissionRate);
    return {
      source:
        source === "FIXED_AMOUNT" || source === "CATEGORY_RATE" || source === "CONTRACT_RATE"
          ? source
          : "PROFESSIONAL_FALLBACK",
      commissionRate: Number.isFinite(commissionRate) ? this.roundMoney(commissionRate) : this.roundMoney(fallbackCommissionRate),
      contractId: this.textOrNull(record.contractId),
      contractType: this.textOrNull(record.contractType),
      commissionBase: this.textOrNull(record.commissionBase),
      paymentDiscount: this.textOrNull(record.paymentDiscount),
      paymentCondition: this.textOrNull(record.paymentCondition),
      priceListId: this.textOrNull(record.priceListId),
      priceListName: this.textOrNull(record.priceListName),
      procedureCategoryId: this.textOrNull(record.procedureCategoryId),
      fixedAmount: Number.isFinite(Number(record.fixedAmount)) ? this.roundMoney(Number(record.fixedAmount)) : null
    };
  }

  private textOrNull(value: unknown) {
    return typeof value === "string" ? value : null;
  }

  private buildPayrollItem(row: PayrollTreatmentItemSource, rule: PayrollRuleSnapshot): PayrollItemView {
    const treatmentAmount = this.roundMoney(Number(row.total));
    const rawCollectedAmount = row.paymentAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    const collectedAmount = this.roundMoney(Math.min(treatmentAmount, rawCollectedAmount));
    const isReady = collectedAmount >= treatmentAmount;
    const payableAmount =
      rule.source === "FIXED_AMOUNT" && rule.fixedAmount !== undefined && rule.fixedAmount !== null
        ? this.roundMoney(rule.fixedAmount)
        : this.roundMoney(collectedAmount * (rule.commissionRate / 100));
    const patient = row.treatmentPlan.patient;
    const paymentMethodNames = [
      ...new Set(row.paymentAllocations.map((allocation) => allocation.payment.paymentMethod?.name).filter(Boolean))
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
