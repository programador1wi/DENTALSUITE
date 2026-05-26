import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
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

  async listPayroll(actor: AuthUser, branchId?: string) {
    const rows = await this.prisma.treatmentPlanItem.findMany({
      where: {
        status: "COMPLETED",
        treatmentPlan: { organizationId: actor.organizationId, branchId: branchScope(actor, branchId) },
        paymentAllocations: { some: {} },
        payrollLiquidationItem: { is: null }
      },
      include: {
        treatmentPlan: {
          select: {
            id: true,
            professional: { select: { id: true, firstName: true, lastName: true, commissionRate: true } },
            patient: { select: { id: true, firstName: true, lastName: true } }
          }
        },
        paymentAllocations: { select: { amount: true } }
      },
      orderBy: { completedAt: "desc" }
    });

    const summaries = new Map<
      string,
      {
        professionalId: string;
        professionalName: string;
        commissionRate: number;
        completedItems: number;
        collectedAmount: number;
        payableAmount: number;
        lastCompletedAt: Date | null;
      }
    >();

    for (const row of rows) {
      const professional = row.treatmentPlan.professional;
      const collectedAmount = Math.min(
        Number(row.total),
        row.paymentAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0)
      );
      const current =
        summaries.get(professional.id) ??
        {
          professionalId: professional.id,
          professionalName: `${professional.firstName} ${professional.lastName}`,
          commissionRate: Number(professional.commissionRate),
          completedItems: 0,
          collectedAmount: 0,
          payableAmount: 0,
          lastCompletedAt: null
        };
      current.completedItems += 1;
      current.collectedAmount = this.roundMoney(current.collectedAmount + collectedAmount);
      current.payableAmount = this.roundMoney(current.payableAmount + collectedAmount * (current.commissionRate / 100));
      if (row.completedAt && (!current.lastCompletedAt || row.completedAt > current.lastCompletedAt)) {
        current.lastCompletedAt = row.completedAt;
      }
      summaries.set(professional.id, current);
    }

    return [...summaries.values()].sort((left, right) => right.payableAmount - left.payableAmount);
  }

  async listFinalizedPayroll(actor: AuthUser, branchId?: string) {
    return this.prisma.payrollLiquidation.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor, branchId)
      },
      include: {
        professional: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        finalizedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true } }
      },
      orderBy: { finalizedAt: "desc" }
    });
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
        status: "COMPLETED",
        treatmentPlan: {
          organizationId: actor.organizationId,
          professionalId: professional.id,
          branchId: branchScope(actor, dto.branchId)
        },
        paymentAllocations: { some: {} },
        payrollLiquidationItem: { is: null }
      },
      include: {
        paymentAllocations: { select: { amount: true } }
      },
      orderBy: { completedAt: "desc" }
    });

    const payableRows = rows
      .map((row) => {
        const collectedAmount = Math.min(
          Number(row.total),
          row.paymentAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0)
        );
        return {
          row,
          collectedAmount: this.roundMoney(collectedAmount),
          payableAmount: this.roundMoney(collectedAmount * (Number(professional.commissionRate) / 100))
        };
      })
      .filter(({ row, collectedAmount }) => collectedAmount >= Number(row.total));

    if (!payableRows.length) {
      throw new BadRequestException("No fully paid completed items are ready to finalize");
    }

    const summary = payableRows.reduce(
      (current, item) => ({
        completedItems: current.completedItems + 1,
        collectedAmount: this.roundMoney(current.collectedAmount + item.collectedAmount),
        payableAmount: this.roundMoney(current.payableAmount + item.payableAmount),
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

    const created = await this.prisma.payrollLiquidation.create({
      data: {
        organizationId: actor.organizationId,
        professionalId: professional.id,
        branchId: dto.branchId,
        commissionRate: professional.commissionRate,
        completedItems: summary.completedItems,
        collectedAmount: this.toDecimal(summary.collectedAmount),
        payableAmount: this.toDecimal(summary.payableAmount),
        lastCompletedAt: summary.lastCompletedAt,
        finalizedById: actor.id,
        items: {
          create: payableRows.map((item) => ({
            treatmentPlanItemId: item.row.id,
            collectedAmount: this.toDecimal(item.collectedAmount),
            payableAmount: this.toDecimal(item.payableAmount)
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
}
