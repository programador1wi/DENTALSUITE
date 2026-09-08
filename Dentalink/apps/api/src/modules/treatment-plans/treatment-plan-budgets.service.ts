import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { BudgetStatus, Prisma, TreatmentPlanItemStatus, TreatmentPlanStatus } from "@prisma/client";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CrmTasksService } from "../crm-tasks/crm-tasks.service";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { CreateBudgetDto, ListBudgetsQueryDto } from "./dto/treatment-plan.dto";

@Injectable()
export class TreatmentPlanBudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly crmTasksService?: CrmTasksService
  ) {}

  private decimal(value: number) {
    return new Prisma.Decimal(Math.round(value * 100) / 100);
  }

  private ensureTreatmentPlanCanMutate(
    plan: { status: TreatmentPlanStatus; name: string },
    action: string
  ) {
    if (plan.status === TreatmentPlanStatus.COMPLETED) {
      throw new BadRequestException(`Cannot ${action} a completed treatment plan`);
    }
    if (plan.status === TreatmentPlanStatus.CANCELLED) {
      throw new BadRequestException(`Cannot ${action} a cancelled treatment plan`);
    }
  }

  private async ensureTreatmentPlan(actor: AuthUser, id: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");
    return plan;
  }

  private async audit(
    actor: AuthUser,
    entity: string,
    entityId: string | null,
    action: string,
    before: Prisma.InputJsonValue,
    after: Prisma.InputJsonValue
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        actorUserId: actor.id,
        entity,
        entityId: entityId ?? undefined,
        action,
        before,
        after
      }
    });
  }

  async createBudget(actor: AuthUser, treatmentPlanId: string, dto: CreateBudgetDto) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    this.ensureTreatmentPlanCanMutate(plan, "create budgets for");
    const items = await this.prisma.treatmentPlanItem.findMany({
      where: { treatmentPlanId, status: { not: TreatmentPlanItemStatus.CANCELLED } },
      include: { procedure: true }
    });
    if (!items.length)
      throw new BadRequestException("Treatment plan requires at least one active item to generate a budget");

    let rawSubtotal = 0;
    let itemsDiscount = 0;

    for (const item of items) {
      rawSubtotal += Number(item.quantity) * Number(item.unitPrice);
      itemsDiscount += Number(item.discount);
    }

    const budgetDiscountTotal = dto.discountTotal ?? 0;
    const totalDiscount = itemsDiscount + budgetDiscountTotal;

    if (totalDiscount > rawSubtotal)
      throw new BadRequestException("total discount cannot be greater than subtotal");
    const total = rawSubtotal - totalDiscount;

    const budget = await this.prisma.$transaction(async (tx) => {
      const created = await tx.budget.create({
        data: {
          treatmentPlanId: plan.id,
          patientId: plan.patientId,
          professionalId: plan.professionalId,
          organizationId: actor.organizationId,
          subtotal: this.decimal(rawSubtotal),
          discountTotal: this.decimal(totalDiscount),
          total: this.decimal(total),
          status: BudgetStatus.DRAFT,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          notes: dto.notes?.trim()
        }
      });

      for (const item of items) {
        await tx.budgetItem.create({
          data: {
            budgetId: created.id,
            treatmentPlanItemId: item.id,
            description: `${item.procedure.code} - ${item.procedure.name}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: item.total
          }
        });
      }

      return created;
    });

    await this.audit(actor, "Budget", budget.id, "create", {}, budget as Prisma.InputJsonValue);
    return this.getBudget(actor, budget.id);
  }

  async listBudgets(actor: AuthUser, query: ListBudgetsQueryDto) {
    const { skip, take } = resolvePagination(query);
    const trimmedPatientId = query.patientId?.trim();
    const isNumericPatient = trimmedPatientId ? /^\d+$/.test(trimmedPatientId) : false;

    return this.prisma.budget.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(trimmedPatientId
          ? {
              patient: {
                organizationId: actor.organizationId,
                branchId: branchScope(actor),
                deletedAt: null,
                ...(isNumericPatient
                  ? { OR: [{ id: trimmedPatientId }, { patientNumber: parseInt(trimmedPatientId, 10) }] }
                  : { id: trimmedPatientId })
              }
            }
          : {}),
        ...(query.treatmentPlanId ? { treatmentPlanId: query.treatmentPlanId } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        treatmentPlan: { select: { id: true, name: true, status: true, isAlternative: true } },
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        items: true
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });
  }

  async getBudget(actor: AuthUser, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        treatmentPlan: {
          select: {
            id: true,
            name: true,
            status: true,
            isAlternative: true,
            patientId: true
          }
        },
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            treatmentPlanItem: {
              include: {
                procedure: { select: { code: true, name: true } }
              }
            }
          }
        }
      }
    });
    if (!budget) throw new NotFoundException("Budget not found");
    return budget;
  }

  async sendBudget(actor: AuthUser, id: string) {
    const current = await this.getBudget(actor, id);
    this.ensureTreatmentPlanCanMutate(current.treatmentPlan, "send budgets for");
    if (current.status !== BudgetStatus.DRAFT)
      throw new BadRequestException("Only DRAFT budgets can be sent");
    const updated = await this.prisma.budget.update({
      where: { id },
      data: { status: BudgetStatus.SENT, sentAt: new Date() }
    });
    await this.audit(
      actor,
      "Budget",
      id,
      "send",
      { status: current.status } as Prisma.InputJsonValue,
      updated as Prisma.InputJsonValue
    );
    return this.getBudget(actor, id);
  }

  async acceptBudget(actor: AuthUser, id: string) {
    const current = await this.getBudget(actor, id);
    this.ensureTreatmentPlanCanMutate(current.treatmentPlan, "accept budgets for");
    if (current.treatmentPlan.isAlternative) {
      throw new BadRequestException(
        "Alternative treatment plans cannot be accepted for payments until converted to principal"
      );
    }
    const acceptStatuses: BudgetStatus[] = [BudgetStatus.DRAFT, BudgetStatus.SENT];
    if (!acceptStatuses.includes(current.status)) {
      throw new BadRequestException("Only DRAFT or SENT budgets can be accepted");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.budget.update({
        where: { id },
        data: {
          status: BudgetStatus.ACCEPTED,
          acceptedAt: new Date()
        }
      });
      await tx.treatmentPlan.update({
        where: { id: current.treatmentPlan.id },
        data: {
          status: TreatmentPlanStatus.ACCEPTED,
          acceptedAt: new Date()
        }
      });
    });

    await this.audit(
      actor,
      "Budget",
      id,
      "accept",
      { status: current.status } as Prisma.InputJsonValue,
      { status: BudgetStatus.ACCEPTED } as Prisma.InputJsonValue
    );
    await this.crmTasksService?.handleBudgetAccepted(id, actor.id);
    return this.getBudget(actor, id);
  }

  async rejectBudget(actor: AuthUser, id: string) {
    const current = await this.getBudget(actor, id);
    const rejectStatuses: BudgetStatus[] = [BudgetStatus.DRAFT, BudgetStatus.SENT];
    if (!rejectStatuses.includes(current.status)) {
      throw new BadRequestException("Only DRAFT or SENT budgets can be rejected");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.budget.update({
        where: { id },
        data: {
          status: BudgetStatus.REJECTED,
          rejectedAt: new Date()
        }
      });
      if (current.treatmentPlan.status === TreatmentPlanStatus.PRESENTED) {
        await tx.treatmentPlan.update({
          where: { id: current.treatmentPlan.id },
          data: { status: TreatmentPlanStatus.REJECTED }
        });
      }
    });

    await this.audit(
      actor,
      "Budget",
      id,
      "reject",
      { status: current.status } as Prisma.InputJsonValue,
      { status: BudgetStatus.REJECTED } as Prisma.InputJsonValue
    );
    return this.getBudget(actor, id);
  }

  async printBudget(actor: AuthUser, id: string) {
    const budget = await this.getBudget(actor, id);
    const lines = budget.items.map((item) => {
      const label = `${item.treatmentPlanItem.procedure.code} ${item.treatmentPlanItem.procedure.name}`;
      return `- ${label} x${item.quantity} = ${item.total}`;
    });

    return {
      ...budget,
      printableText: [
        `Presupuesto: ${budget.id}`,
        `Paciente: ${budget.patient.firstName} ${budget.patient.lastName}`,
        `Plan: ${budget.treatmentPlan.name}`,
        `Estado: ${budget.status}`,
        ...lines,
        `Subtotal: ${budget.subtotal}`,
        `Descuento: ${budget.discountTotal}`,
        `Total: ${budget.total}`
      ].join("\n")
    };
  }
}
