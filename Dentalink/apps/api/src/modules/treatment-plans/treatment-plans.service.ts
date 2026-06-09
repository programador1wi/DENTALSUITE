import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  BudgetStatus,
  Prisma,
  ProfessionalBranchStatus,
  ToothProcedureStatus,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus
} from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  ChangeTreatmentPlanBranchDto,
  CreateAlternativeDto,
  CreateBudgetDto,
  CreateTreatmentPlanDto,
  ListBudgetsQueryDto,
  ListTreatmentPlansQueryDto,
  TreatmentPlanSectionInputDto,
  UpdateTreatmentPlanDto,
  UpdateTreatmentPlanItemDto,
  UpdateTreatmentPlanItemStatusDto
} from "./dto/treatment-plan.dto";

@Injectable()
export class TreatmentPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async listTreatmentPlans(actor: AuthUser, query: ListTreatmentPlansQueryDto) {
    const { skip, take } = resolvePagination(query);
    const rows = await this.prisma.treatmentPlan.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.patientId ? { patientId: query.patientId } : {}),
        branchId: branchScope(actor, query.branchId),
        ...(query.professionalId ? { professionalId: query.professionalId } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        items: true,
        budgets: true
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });

    return rows.map((row) => ({
      ...row,
      itemsCount: row.items.length,
      budgetCount: row.budgets.length
    }));
  }

  async createTreatmentPlan(actor: AuthUser, dto: CreateTreatmentPlanDto) {
    await this.validateBranch(actor, dto.branchId);
    const patient = await this.validatePatient(actor, dto.patientId);
    await this.validateProfessional(actor, dto.professionalId, dto.branchId);
    if (dto.parentTreatmentPlanId) await this.ensureTreatmentPlan(actor, dto.parentTreatmentPlanId);

    const created = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.treatmentPlan.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          professionalId: dto.professionalId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          status: dto.status ?? TreatmentPlanStatus.DRAFT,
          isAlternative: dto.isAlternative ?? false,
          parentTreatmentPlanId: dto.parentTreatmentPlanId
        }
      });

      if (dto.sections?.length) {
        for (const section of dto.sections) {
          await tx.treatmentPlanSection.create({
            data: {
              treatmentPlanId: plan.id,
              name: section.name.trim(),
              sortOrder: section.sortOrder ?? 0
            }
          });
        }
      }

      if (dto.items?.length) {
        for (const item of dto.items) {
          await this.validateProcedureInTransaction(tx, actor, item.procedureId);
          if (item.sectionId) await this.validateSectionInTransaction(tx, plan.id, item.sectionId);
          
          const agreement = patient.agreement;
          await tx.treatmentPlanItem.create({
            data: this.buildItemData(plan.id, item, agreement)
          });
        }
      }

      if (dto.parentTreatmentPlanId) {
        await tx.treatmentPlanAlternative.upsert({
          where: {
            parentTreatmentPlanId_alternativeTreatmentPlanId: {
              parentTreatmentPlanId: dto.parentTreatmentPlanId,
              alternativeTreatmentPlanId: plan.id
            }
          },
          update: {},
          create: {
            parentTreatmentPlanId: dto.parentTreatmentPlanId,
            alternativeTreatmentPlanId: plan.id
          }
        });
      }

      return plan;
    });

    await this.audit(actor, "TreatmentPlan", created.id, "create", {}, {
      name: created.name,
      status: created.status,
      isAlternative: created.isAlternative
    });
    return this.getTreatmentPlan(actor, created.id);
  }

  async getTreatmentPlan(actor: AuthUser, id: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        sections: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        items: {
          include: {
            procedure: { select: { id: true, code: true, name: true } },
            section: true,
            paymentAllocations: { select: { id: true, amount: true } }
          },
          orderBy: { createdAt: "asc" }
        },
        budgets: {
          include: { items: true },
          orderBy: { createdAt: "desc" }
        },
        alternativePlans: {
          include: {
            items: true,
            professional: { select: { firstName: true, lastName: true } }
          }
        },
        alternativesAsParent: {
          include: {
            alternativeTreatmentPlan: {
              include: { items: true, professional: { select: { firstName: true, lastName: true } } }
            }
          }
        }
      }
    });

    if (!plan) throw new NotFoundException("Treatment plan not found");
    return plan;
  }

  async updateTreatmentPlan(actor: AuthUser, id: string, dto: UpdateTreatmentPlanDto) {
    const current = await this.ensureTreatmentPlan(actor, id);
    if (dto.branchId) await this.validateBranch(actor, dto.branchId);
    if (dto.branchId || dto.professionalId) {
      await this.validateProfessional(actor, dto.professionalId ?? current.professionalId, dto.branchId ?? current.branchId);
    }

    const updated = await this.prisma.treatmentPlan.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        professionalId: dto.professionalId,
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        status: dto.status,
        acceptedAt: dto.status === TreatmentPlanStatus.ACCEPTED ? current.acceptedAt ?? new Date() : current.acceptedAt,
        completedAt: dto.status === TreatmentPlanStatus.COMPLETED ? current.completedAt ?? new Date() : current.completedAt
      }
    });

    await this.audit(actor, "TreatmentPlan", id, "update", current as Prisma.InputJsonValue, updated as Prisma.InputJsonValue);
    return this.getTreatmentPlan(actor, id);
  }

  async changeBranch(actor: AuthUser, id: string, dto: ChangeTreatmentPlanBranchDto) {
    const current = await this.ensureTreatmentPlan(actor, id);
    await this.validateBranch(actor, dto.branchId);
    await this.validateProfessional(actor, dto.professionalId, dto.branchId);

    const futureAppointmentWhere: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,
      patientId: current.patientId,
      treatmentPlanId: id,
      startAt: { gte: new Date() },
      status: {
        notIn: [
          AppointmentStatus.COMPLETED,
          AppointmentStatus.CANCELLED_BY_PATIENT,
          AppointmentStatus.CANCELLED_BY_CLINIC,
          AppointmentStatus.NO_SHOW,
          AppointmentStatus.RESCHEDULED,
          AppointmentStatus.BLOCKED
        ]
      }
    };
    const futureAppointmentsCount = await this.prisma.appointment.count({ where: futureAppointmentWhere });

    const movedFutureAppointmentsCount = await this.prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id: current.patientId },
        data: { branchId: dto.branchId }
      });

      await tx.treatmentPlan.update({
        where: { id },
        data: {
          branchId: dto.branchId,
          professionalId: dto.professionalId
        }
      });

      if (!dto.moveFutureAppointments || futureAppointmentsCount === 0) return 0;

      const result = await tx.appointment.updateMany({
        where: futureAppointmentWhere,
        data: {
          branchId: dto.branchId,
          professionalId: dto.professionalId,
          chairId: null,
          updatedById: actor.id
        }
      });
      return result.count;
    });

    await this.audit(
      actor,
      "TreatmentPlan",
      id,
      "change_branch",
      {
        patientId: current.patientId,
        branchId: current.branchId,
        professionalId: current.professionalId
      } as Prisma.InputJsonValue,
      {
        branchId: dto.branchId,
        professionalId: dto.professionalId,
        futureAppointmentsCount,
        movedFutureAppointmentsCount
      } as Prisma.InputJsonValue
    );

    return {
      ...(await this.getTreatmentPlan(actor, id)),
      futureAppointmentsCount,
      movedFutureAppointmentsCount
    };
  }

  async addSection(actor: AuthUser, treatmentPlanId: string, dto: TreatmentPlanSectionInputDto) {
    await this.ensureTreatmentPlan(actor, treatmentPlanId);
    const nextSortOrder =
      dto.sortOrder ??
      ((await this.prisma.treatmentPlanSection.aggregate({
        where: { treatmentPlanId },
        _max: { sortOrder: true }
      }))._max.sortOrder ?? -1) + 1;

    const created = await this.prisma.treatmentPlanSection.create({
      data: {
        treatmentPlanId,
        name: dto.name.trim(),
        sortOrder: nextSortOrder
      }
    });

    await this.audit(actor, "TreatmentPlanSection", created.id, "create", {}, created as Prisma.InputJsonValue);
    return this.getTreatmentPlan(actor, treatmentPlanId);
  }

  async createAlternative(actor: AuthUser, parentId: string, dto: CreateAlternativeDto) {
    const parent = await this.ensureTreatmentPlan(actor, parentId);
    const created = await this.createTreatmentPlan(actor, {
      ...dto,
      branchId: dto.branchId ?? parent.branchId,
      patientId: dto.patientId ?? parent.patientId,
      professionalId: dto.professionalId ?? parent.professionalId,
      isAlternative: true,
      parentTreatmentPlanId: parentId
    });
    return created;
  }

  async activateAlternative(actor: AuthUser, parentId: string, alternativeId: string) {
    const [parent, alternative, link] = await Promise.all([
      this.ensureTreatmentPlan(actor, parentId),
      this.ensureTreatmentPlan(actor, alternativeId),
      this.prisma.treatmentPlanAlternative.findUnique({
        where: {
          parentTreatmentPlanId_alternativeTreatmentPlanId: {
            parentTreatmentPlanId: parentId,
            alternativeTreatmentPlanId: alternativeId
          }
        }
      })
    ]);

    if (!link) throw new BadRequestException("The selected plan is not registered as an alternative of the parent plan");
    if (parent.patientId !== alternative.patientId) throw new BadRequestException("Alternative and parent plan must belong to the same patient");

    await this.prisma.$transaction(async (tx) => {
      await tx.treatmentPlan.update({
        where: { id: alternative.id },
        data: {
          isAlternative: false,
          parentTreatmentPlanId: null
        }
      });

      await tx.treatmentPlan.update({
        where: { id: parent.id },
        data: {
          isAlternative: true,
          parentTreatmentPlanId: alternative.id,
          status: TreatmentPlanStatus.REJECTED
        }
      });
    });

    await this.audit(actor, "TreatmentPlanAlternative", parentId, "activate_alternative", {
      parentId,
      alternativeId
    } as Prisma.InputJsonValue, {});

    return this.getTreatmentPlan(actor, alternative.id);
  }

  async addItem(actor: AuthUser, treatmentPlanId: string, dto: UpdateTreatmentPlanItemDto) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    if (!dto.procedureId) throw new BadRequestException("procedureId is required");

    await this.validateProcedure(actor, dto.procedureId);
    if (dto.sectionId) await this.validateSection(treatmentPlanId, dto.sectionId);

    const agreement = plan.patient.agreement;
    const quantity = dto.quantity ?? 1;
    const unitPrice = dto.unitPrice ?? (await this.resolveProcedurePrice(actor, plan.branchId, plan.patient, dto.procedureId));
    const discount = dto.discount ?? 0;
    const itemPayload = {
      ...dto,
      procedureId: dto.procedureId,
      quantity,
      unitPrice,
      discount
    };

    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.treatmentPlanItem.create({
        data: this.buildItemData(treatmentPlanId, itemPayload, agreement),
        include: { procedure: true, section: true }
      });

      if (dto.syncOdontogram && item.toothNumber) {
        await this.syncTreatmentItemOdontogram(tx, plan, item, dto.notes?.trim());
      }

      return item;
    });

    await this.audit(actor, "TreatmentPlanItem", created.id, "create", {}, created as Prisma.InputJsonValue);
    return this.getTreatmentPlan(actor, plan.id);
  }

  async updateItem(actor: AuthUser, treatmentPlanId: string, itemId: string, dto: UpdateTreatmentPlanItemDto) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    const current = await this.prisma.treatmentPlanItem.findFirst({
      where: { id: itemId, treatmentPlanId }
    });
    if (!current) throw new NotFoundException("Treatment plan item not found");

    if (
      current.status === TreatmentPlanItemStatus.PAID &&
      (dto.procedureId !== undefined ||
        dto.quantity !== undefined ||
        dto.unitPrice !== undefined ||
        dto.discount !== undefined ||
        dto.toothNumber !== undefined ||
        dto.surface !== undefined)
    ) {
      throw new BadRequestException("Paid procedures cannot be modified");
    }

    if (dto.procedureId) await this.validateProcedure(actor, dto.procedureId);
    if (dto.sectionId) await this.validateSection(treatmentPlanId, dto.sectionId);

    const quantity = dto.quantity ?? Number(current.quantity);
    const unitPrice = dto.unitPrice ?? Number(current.unitPrice);
    
    let discount = dto.discount ?? Number(current.discount);
    let agreementCoverage = Number(current.agreementCoverage || 0);
    const agreement = plan.patient.agreement;

    if (dto.quantity !== undefined || dto.unitPrice !== undefined) {
      if (agreement && agreement.isActive && Number(agreement.discountPercent) > 0) {
        agreementCoverage = Number((quantity * unitPrice * (Number(agreement.discountPercent) / 100)).toFixed(2));
        discount = Number(agreementCoverage.toFixed(2));
      }
    }
    
    const total = this.computeTotal(quantity, unitPrice, discount);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.treatmentPlanItem.update({
        where: { id: current.id },
        data: {
          sectionId: dto.sectionId ?? current.sectionId,
          procedureId: dto.procedureId ?? current.procedureId,
          toothNumber: dto.toothNumber ?? current.toothNumber,
          surface: dto.surface ?? current.surface,
          quantity: this.decimal(quantity),
          unitPrice: this.decimal(unitPrice),
          discount: this.decimal(discount),
          total: this.decimal(total),
          notes: dto.notes ?? current.notes,
          plannedAt: dto.plannedAt === undefined ? current.plannedAt : dto.plannedAt ? new Date(dto.plannedAt) : null,
          agreementId: agreement?.id || null,
          agreementCoverage: this.decimal(agreementCoverage)
        }
      });

      if (dto.syncOdontogram && row.toothNumber) {
        await this.syncTreatmentItemOdontogram(tx, plan, row, dto.notes?.trim());
      }

      return row;
    });

    if (
      quantity !== Number(current.quantity) ||
      unitPrice !== Number(current.unitPrice) ||
      discount !== Number(current.discount) ||
      total !== Number(current.total)
    ) {
      await this.audit(
        actor,
        "TreatmentPlanItem",
        itemId,
        "price_update",
        {
          quantity: current.quantity,
          unitPrice: current.unitPrice,
          discount: current.discount,
          total: current.total
        } as Prisma.InputJsonValue,
        {
          quantity: updated.quantity,
          unitPrice: updated.unitPrice,
          discount: updated.discount,
          total: updated.total
        } as Prisma.InputJsonValue
      );
    } else {
      await this.audit(actor, "TreatmentPlanItem", itemId, "update", current as Prisma.InputJsonValue, updated as Prisma.InputJsonValue);
    }

    return this.getTreatmentPlan(actor, treatmentPlanId);
  }

  async updateItemStatus(actor: AuthUser, treatmentPlanId: string, itemId: string, dto: UpdateTreatmentPlanItemStatusDto) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    const current = await this.prisma.treatmentPlanItem.findFirst({
      where: { id: itemId, treatmentPlanId }
    });
    if (!current) throw new NotFoundException("Treatment plan item not found");

    if (dto.status === TreatmentPlanItemStatus.PAID && plan.isAlternative) {
      throw new BadRequestException("Alternative plans cannot receive paid items until they become the principal plan");
    }

    const updated = await this.prisma.treatmentPlanItem.update({
      where: { id: itemId },
      data: {
        status: dto.status,
        notes: dto.notes ?? current.notes,
        completedAt: dto.status === TreatmentPlanItemStatus.COMPLETED ? current.completedAt ?? new Date() : current.completedAt
      }
    });

    await this.syncTreatmentItemProcedureStatus(itemId, dto.status);

    await this.audit(
      actor,
      "TreatmentPlanItem",
      itemId,
      "status_update",
      { status: current.status } as Prisma.InputJsonValue,
      { status: updated.status } as Prisma.InputJsonValue
    );
    return this.getTreatmentPlan(actor, treatmentPlanId);
  }

  async deleteItem(actor: AuthUser, treatmentPlanId: string, itemId: string) {
    await this.ensureTreatmentPlan(actor, treatmentPlanId);
    const current = await this.prisma.treatmentPlanItem.findFirst({
      where: { id: itemId, treatmentPlanId }
    });
    if (!current) throw new NotFoundException("Treatment plan item not found");
    if (current.status === TreatmentPlanItemStatus.PAID) {
      throw new BadRequestException("Cannot remove paid procedures");
    }

    await this.prisma.treatmentPlanItem.delete({ where: { id: itemId } });
    await this.audit(actor, "TreatmentPlanItem", itemId, "delete", current as Prisma.InputJsonValue, {});
    return { success: true };
  }

  async createBudget(actor: AuthUser, treatmentPlanId: string, dto: CreateBudgetDto) {
    const plan = await this.ensureTreatmentPlan(actor, treatmentPlanId);
    const items = await this.prisma.treatmentPlanItem.findMany({
      where: { treatmentPlanId, status: { not: TreatmentPlanItemStatus.CANCELLED } },
      include: { procedure: true }
    });
    if (!items.length) throw new BadRequestException("Treatment plan requires at least one active item to generate a budget");

    let rawSubtotal = 0;
    let itemsDiscount = 0;

    for (const item of items) {
      rawSubtotal += Number(item.quantity) * Number(item.unitPrice);
      itemsDiscount += Number(item.discount);
    }

    const budgetDiscountTotal = dto.discountTotal ?? 0;
    const totalDiscount = itemsDiscount + budgetDiscountTotal;
    
    if (totalDiscount > rawSubtotal) throw new BadRequestException("total discount cannot be greater than subtotal");
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
    return this.prisma.budget.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.patientId ? { patientId: query.patientId } : {}),
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
    if (current.status !== BudgetStatus.DRAFT) throw new BadRequestException("Only DRAFT budgets can be sent");
    const updated = await this.prisma.budget.update({
      where: { id },
      data: { status: BudgetStatus.SENT, sentAt: new Date() }
    });
    await this.audit(actor, "Budget", id, "send", { status: current.status } as Prisma.InputJsonValue, updated as Prisma.InputJsonValue);
    return this.getBudget(actor, id);
  }

  async acceptBudget(actor: AuthUser, id: string) {
    const current = await this.getBudget(actor, id);
    if (current.treatmentPlan.isAlternative) {
      throw new BadRequestException("Alternative treatment plans cannot be accepted for payments until converted to principal");
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

    await this.audit(actor, "Budget", id, "accept", { status: current.status } as Prisma.InputJsonValue, { status: BudgetStatus.ACCEPTED } as Prisma.InputJsonValue);
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

    await this.audit(actor, "Budget", id, "reject", { status: current.status } as Prisma.InputJsonValue, { status: BudgetStatus.REJECTED } as Prisma.InputJsonValue);
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

  private buildItemData(treatmentPlanId: string, dto: Required<Pick<UpdateTreatmentPlanItemDto, "procedureId" | "quantity" | "unitPrice" | "discount">> & UpdateTreatmentPlanItemDto, agreement: any = null): Prisma.TreatmentPlanItemUncheckedCreateInput {
    let finalDiscount = dto.discount;
    let agreementCoverage = 0;
    if (agreement && agreement.isActive && Number(agreement.discountPercent) > 0) {
      agreementCoverage = Number((dto.quantity * dto.unitPrice * (Number(agreement.discountPercent) / 100)).toFixed(2));
      finalDiscount = finalDiscount + agreementCoverage;
    }
    const total = this.computeTotal(dto.quantity, dto.unitPrice, finalDiscount);
    return {
      treatmentPlanId,
      sectionId: dto.sectionId,
      procedureId: dto.procedureId,
      toothNumber: dto.toothNumber?.trim(),
      surface: dto.surface?.trim().toUpperCase(),
      quantity: this.decimal(dto.quantity),
      unitPrice: this.decimal(dto.unitPrice),
      discount: this.decimal(finalDiscount),
      total: this.decimal(total),
      status: TreatmentPlanItemStatus.PLANNED,
      notes: dto.notes?.trim(),
      plannedAt: dto.plannedAt ? new Date(dto.plannedAt) : null,
      agreementId: agreement?.id || null,
      agreementCoverage: this.decimal(agreementCoverage)
    };
  }

  private computeTotal(quantity: number, unitPrice: number, discount: number) {
    if (quantity <= 0) throw new BadRequestException("quantity must be greater than 0");
    if (unitPrice < 0) throw new BadRequestException("unitPrice cannot be negative");
    if (discount < 0) throw new BadRequestException("discount cannot be negative");
    const total = Number((quantity * unitPrice - discount).toFixed(2));
    if (total < 0) throw new BadRequestException("discount cannot exceed quantity * unitPrice");
    return total;
  }

  private decimal(value: number) {
    return new Prisma.Decimal(value);
  }

  private async resolveProcedurePrice(
    actor: AuthUser,
    branchId: string,
    patient: { agreement?: { priceListId?: string | null } | null },
    procedureId: string
  ) {
    const preferredPriceListId = patient.agreement?.priceListId;
    const hasBranchScopedLists = await this.prisma.branchPriceList.count({
      where: {
        organizationId: actor.organizationId,
        branchId,
        isActive: true,
        priceList: { isActive: true }
      }
    });

    if (preferredPriceListId) {
      const agreementPrice = await this.prisma.priceListItem.findFirst({
        where: {
          procedureId,
          priceListId: preferredPriceListId,
          priceList: {
            organizationId: actor.organizationId,
            isActive: true,
            ...(hasBranchScopedLists
              ? {
                  branchAssignments: {
                    some: { branchId, isActive: true }
                  }
                }
              : {})
          }
        }
      });
      if (agreementPrice) return Number(agreementPrice.price);
    }

    if (hasBranchScopedLists) {
      const branchDefaultPrice = await this.prisma.priceListItem.findFirst({
        where: {
          procedureId,
          priceList: {
            organizationId: actor.organizationId,
            isActive: true,
            branchAssignments: {
              some: { branchId, isActive: true, isDefault: true }
            }
          }
        }
      });
      if (branchDefaultPrice) return Number(branchDefaultPrice.price);

      const branchPrice = await this.prisma.priceListItem.findFirst({
        where: {
          procedureId,
          priceList: {
            organizationId: actor.organizationId,
            isActive: true,
            branchAssignments: {
              some: { branchId, isActive: true }
            }
          }
        }
      });
      if (branchPrice) return Number(branchPrice.price);
    }

    const defaultPrice = await this.prisma.priceListItem.findFirst({
      where: {
        procedureId,
        priceList: {
          organizationId: actor.organizationId,
          isActive: true,
          isDefault: true
        }
      }
    });

    return Number(defaultPrice?.price ?? 0);
  }

  private normalizeToothNumber(value: string) {
    const toothNumber = value.trim();
    if (!/^([1-4][1-8]|[5-8][1-5])$/.test(toothNumber)) {
      throw new BadRequestException("Invalid toothNumber for FDI notation");
    }
    return toothNumber;
  }

  private normalizeSurface(value?: string) {
    if (!value) return undefined;
    const surface = value.trim().toUpperCase();
    const allowedSingle = new Set(["O", "I", "M", "D", "B", "L", "P", "C"]);
    const allowedLegacy = new Set(["MO", "DO", "MOD", "ALL"]);
    if (allowedSingle.has(surface) || allowedLegacy.has(surface)) return surface;

    const preferredOrder = ["P", "M", "B", "D", "O", "I", "L", "C"];
    const parts = [...new Set(surface.split(",").map((part) => part.trim()).filter(Boolean))];
    if (!parts.length || parts.some((part) => !allowedSingle.has(part))) throw new BadRequestException("Invalid tooth surface");
    parts.sort((left, right) => preferredOrder.indexOf(left) - preferredOrder.indexOf(right));
    return parts.join(",");
  }

  private mapItemStatusToToothProcedureStatus(status: TreatmentPlanItemStatus) {
    if (status === TreatmentPlanItemStatus.IN_PROGRESS) return ToothProcedureStatus.IN_PROGRESS;
    if (status === TreatmentPlanItemStatus.COMPLETED) return ToothProcedureStatus.COMPLETED;
    if (status === TreatmentPlanItemStatus.CANCELLED) return ToothProcedureStatus.CANCELLED;
    if (status === TreatmentPlanItemStatus.ACCEPTED || status === TreatmentPlanItemStatus.PAID) return ToothProcedureStatus.ACCEPTED;
    return ToothProcedureStatus.PLANNED;
  }

  private async syncTreatmentItemOdontogram(
    tx: Prisma.TransactionClient,
    plan: { id: string; patientId: string; professionalId: string },
    item: {
      id: string;
      procedureId: string;
      toothNumber: string | null;
      surface: string | null;
      status: TreatmentPlanItemStatus;
      notes: string | null;
    },
    notes?: string
  ) {
    if (!item.toothNumber) return;

    const toothNumber = this.normalizeToothNumber(item.toothNumber);
    const surface = this.normalizeSurface(item.surface ?? undefined);
    const status = this.mapItemStatusToToothProcedureStatus(item.status);
    const diagnosis = notes ?? item.notes?.trim();
    const current = await tx.toothProcedure.findUnique({
      where: { treatmentPlanItemId: item.id },
      include: { odontogramRecord: true }
    });

    const recordPayload = {
      patientId: plan.patientId,
      professionalId: plan.professionalId,
      toothNumber,
      surface,
      condition: "TOOTH_PROCEDURE",
      diagnosis,
      procedureId: item.procedureId,
      status,
      notes: diagnosis
    };

    if (current) {
      if (current.odontogramRecordId) {
        await tx.odontogramRecord.update({
          where: { id: current.odontogramRecordId },
          data: recordPayload
        });
      } else {
        const record = await tx.odontogramRecord.create({ data: recordPayload });
        await tx.toothProcedure.update({
          where: { id: current.id },
          data: { odontogramRecordId: record.id }
        });
      }

      await tx.toothProcedure.update({
        where: { id: current.id },
        data: {
          patientId: plan.patientId,
          professionalId: plan.professionalId,
          procedureId: item.procedureId,
          treatmentPlanId: plan.id,
          treatmentPlanItemId: item.id,
          toothNumber,
          surface,
          diagnosis,
          status,
          notes: diagnosis,
          completedAt: status === ToothProcedureStatus.COMPLETED ? current.completedAt ?? new Date() : null
        }
      });
      return;
    }

    const record = await tx.odontogramRecord.create({ data: recordPayload });
    await tx.toothProcedure.create({
      data: {
        patientId: plan.patientId,
        professionalId: plan.professionalId,
        procedureId: item.procedureId,
        treatmentPlanId: plan.id,
        treatmentPlanItemId: item.id,
        odontogramRecordId: record.id,
        toothNumber,
        surface,
        diagnosis,
        status,
        notes: diagnosis,
        completedAt: status === ToothProcedureStatus.COMPLETED ? new Date() : null
      }
    });
  }

  private async syncTreatmentItemProcedureStatus(itemId: string, itemStatus: TreatmentPlanItemStatus) {
    const status = this.mapItemStatusToToothProcedureStatus(itemStatus);
    const current = await this.prisma.toothProcedure.findUnique({
      where: { treatmentPlanItemId: itemId },
      select: { id: true, odontogramRecordId: true, completedAt: true }
    });
    if (!current) return;

    const completedAt = status === ToothProcedureStatus.COMPLETED ? current.completedAt ?? new Date() : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.toothProcedure.update({
        where: { id: current.id },
        data: { status, completedAt }
      });
      if (current.odontogramRecordId) {
        await tx.odontogramRecord.update({
          where: { id: current.odontogramRecordId },
          data: { status }
        });
      }
    });
  }

  private async ensureTreatmentPlan(actor: AuthUser, treatmentPlanId: string) {
    const row = await this.prisma.treatmentPlan.findFirst({
      where: { id: treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        patient: {
          include: { agreement: true }
        }
      }
    });
    if (!row) throw new NotFoundException("Treatment plan not found");
    return row;
  }

  private async validateBranch(actor: AuthUser, branchId: string) {
    const row = await this.prisma.branch.findFirst({
      where: { id: branchScope(actor, branchId), organizationId: actor.organizationId, deletedAt: null, status: "ACTIVE" }
    });
    if (!row) throw new BadRequestException("Invalid branchId");
  }

  private async validatePatient(actor: AuthUser, patientId: string) {
    const row = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: actor.organizationId, branchId: branchScope(actor), deletedAt: null },
      include: { agreement: true }
    });
    if (!row) throw new BadRequestException("Invalid patientId");
    return row;
  }

  private async validateProfessional(actor: AuthUser, professionalId: string, branchId?: string) {
    const now = new Date();
    const row = await this.prisma.professional.findFirst({
      where: {
        id: professionalId,
        organizationId: actor.organizationId,
        isActive: true,
        ...(branchId
          ? {
              branches: {
                some: {
                  branchId,
                  status: ProfessionalBranchStatus.ACTIVE,
                  startsAt: { lte: now },
                  OR: [{ endsAt: null }, { endsAt: { gt: now } }]
                }
              }
            }
          : {})
      }
    });
    if (!row) throw new BadRequestException("Invalid professionalId");
  }

  private async validateProcedure(actor: AuthUser, procedureId: string) {
    const row = await this.prisma.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId, isActive: true }
    });
    if (!row) throw new BadRequestException("Invalid procedureId");
  }

  private async validateProcedureInTransaction(tx: Prisma.TransactionClient, actor: AuthUser, procedureId: string) {
    const row = await tx.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId, isActive: true }
    });
    if (!row) throw new BadRequestException("Invalid procedureId");
  }

  private async validateSection(treatmentPlanId: string, sectionId: string) {
    const row = await this.prisma.treatmentPlanSection.findFirst({
      where: { id: sectionId, treatmentPlanId }
    });
    if (!row) throw new BadRequestException("Invalid sectionId for treatment plan");
  }

  private async validateSectionInTransaction(tx: Prisma.TransactionClient, treatmentPlanId: string, sectionId: string) {
    const row = await tx.treatmentPlanSection.findFirst({
      where: { id: sectionId, treatmentPlanId }
    });
    if (!row) throw new BadRequestException("Invalid sectionId for treatment plan");
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
}
