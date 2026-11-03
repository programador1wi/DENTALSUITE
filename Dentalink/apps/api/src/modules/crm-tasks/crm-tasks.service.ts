import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  BudgetStatus,
  CrmTaskDelayUnit,
  CrmTaskOrigin,
  CrmTaskPriority,
  PatientTaskStatus,
  PaymentStatus,
  Prisma,
  TreatmentPlanStatus
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuthUser } from "../../common/types/auth-user";
import {
  AUTOMATIC_CRM_TASK_TYPES,
  CancelCrmTaskDto,
  CreateCrmTaskDto,
  CrmTaskStatisticsQueryDto,
  ListCrmTasksQueryDto,
  UpdateCrmTaskConfigurationDto,
  UpdateCrmTaskDto
} from "./dto/crm-tasks.dto";

const DEFAULT_CONFIG: Record<string, { delayValue: number; delayUnit: CrmTaskDelayUnit }> = {
  COBRANZA: { delayValue: 7, delayUnit: CrmTaskDelayUnit.DAYS },
  CAPTURA: { delayValue: 1, delayUnit: CrmTaskDelayUnit.DAYS },
  CONTROL: { delayValue: 5, delayUnit: CrmTaskDelayUnit.DAYS },
  CITA: { delayValue: 90, delayUnit: CrmTaskDelayUnit.DAYS }
};

const APPOINTMENT_FOLLOW_UP_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_BY_CLINIC,
  AppointmentStatus.CANCELLED_CONFLICT
]);

const FUTURE_APPOINTMENT_EXCLUDED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_BY_CLINIC,
  AppointmentStatus.CANCELLED_CONFLICT,
  AppointmentStatus.CANCELLED_RESCHEDULED,
  AppointmentStatus.RESCHEDULED,
  AppointmentStatus.BLOCKED
];

@Injectable()
export class CrmTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthUser, query: ListCrmTasksQueryDto) {
    const branch = await this.ensureBranch(actor, query.branchId);
    const where = this.buildListWhere(actor, query, branch.timezone ?? "America/Mexico_City");
    const skip = (query.page - 1) * query.pageSize;
    const orderBy = this.resolveOrderBy(query.sortBy, query.sortOrder);

    const [items, total, overdueCount] = await this.prisma.$transaction([
      this.prisma.patientTask.findMany({
        where,
        include: this.taskInclude(),
        skip,
        take: query.pageSize,
        orderBy
      }),
      this.prisma.patientTask.count({ where }),
      this.prisma.patientTask.count({
        where: {
          organizationId: actor.organizationId,
          branchId: branch.id,
          status: PatientTaskStatus.PENDING,
          dueDate: { lt: new Date() }
        }
      })
    ]);

    return { items, total, overdueCount, page: query.page, pageSize: query.pageSize };
  }

  async get(actor: AuthUser, id: string) {
    const task = await this.prisma.patientTask.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds }
      },
      include: this.taskInclude()
    });
    if (!task) throw new NotFoundException("CRM task not found");
    return task;
  }

  async history(actor: AuthUser, id: string) {
    await this.get(actor, id);
    return this.prisma.crmTaskHistory.findMany({
      where: { taskId: id },
      include: { actorUser: { select: this.userSelect() } },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(actor: AuthUser, dto: CreateCrmTaskDto, rawIdempotencyKey?: string) {
    await this.ensureBranch(actor, dto.branchId);
    await this.ensurePatient(actor, dto.patientId, dto.branchId);
    const assignedToId = await this.validateAssignee(actor, dto.branchId, dto.assignedToId);
    const title = this.requiredText(dto.title, "title");
    const detail = this.requiredText(dto.detail, "detail");
    const idempotencyKey = this.optionalIdempotencyKey(rawIdempotencyKey);

    if (idempotencyKey) {
      const existing = await this.prisma.patientTask.findUnique({
        where: { organizationId_idempotencyKey: { organizationId: actor.organizationId, idempotencyKey } },
        include: this.taskInclude()
      });
      if (existing) return existing;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const task = await tx.patientTask.create({
          data: {
            organizationId: actor.organizationId,
            branchId: dto.branchId,
            patientId: dto.patientId,
            type: dto.type,
            title,
            detail,
            dueDate: dto.dueAt ? new Date(dto.dueAt) : null,
            priority: dto.priority ?? CrmTaskPriority.NORMAL,
            origin: CrmTaskOrigin.MANUAL,
            assignedToId,
            createdById: actor.id,
            idempotencyKey
          },
          include: this.taskInclude()
        });
        await tx.crmTaskHistory.create({
          data: {
            taskId: task.id,
            action: "CREATED",
            actorUserId: actor.id,
            after: this.taskSnapshot(task)
          }
        });
        return task;
      });
    } catch (error) {
      if (idempotencyKey && this.isUniqueConstraint(error)) {
        return this.prisma.patientTask.findUniqueOrThrow({
          where: { organizationId_idempotencyKey: { organizationId: actor.organizationId, idempotencyKey } },
          include: this.taskInclude()
        });
      }
      throw error;
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdateCrmTaskDto) {
    const current = await this.get(actor, id);
    if (current.status !== PatientTaskStatus.PENDING) {
      throw new ConflictException("Only pending tasks can be edited");
    }

    const data: Prisma.PatientTaskUncheckedUpdateInput = { version: { increment: 1 } };
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.title !== undefined) data.title = this.requiredText(dto.title, "title");
    if (dto.detail !== undefined) data.detail = this.requiredText(dto.detail, "detail");
    if (dto.dueAt !== undefined) data.dueDate = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.assignedToId !== undefined) {
      data.assignedToId = await this.validateAssignee(actor, current.branchId, dto.assignedToId);
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.patientTask.updateMany({
        where: { id, organizationId: actor.organizationId, version: dto.version, status: PatientTaskStatus.PENDING },
        data
      });
      if (result.count !== 1) throw new ConflictException("Task changed by another user; reload before editing");
      const updated = await tx.patientTask.findUniqueOrThrow({ where: { id }, include: this.taskInclude() });
      await tx.crmTaskHistory.create({
        data: {
          taskId: id,
          action: current.assignedToId !== updated.assignedToId ? "REASSIGNED" : "UPDATED",
          actorUserId: actor.id,
          before: this.taskSnapshot(current),
          after: this.taskSnapshot(updated)
        }
      });
      return updated;
    });
  }

  complete(actor: AuthUser, id: string, version: number) {
    return this.transition(actor, id, version, PatientTaskStatus.COMPLETED, "COMPLETED");
  }

  reopen(actor: AuthUser, id: string, version: number) {
    return this.transition(actor, id, version, PatientTaskStatus.PENDING, "REOPENED");
  }

  async cancel(actor: AuthUser, id: string, dto: CancelCrmTaskDto) {
    const reason = this.requiredText(dto.reason, "reason");
    return this.transition(actor, id, dto.version, PatientTaskStatus.CANCELLED, "CANCELLED", reason);
  }

  async statistics(actor: AuthUser, query: CrmTaskStatisticsQueryDto) {
    const branch = await this.ensureBranch(actor, query.branchId);
    const where: Prisma.PatientTaskWhereInput = {
      organizationId: actor.organizationId,
      branchId: branch.id
    };
    if (query.month) {
      const [year, month] = query.month.split("-").map(Number);
      const startDate = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`;
      const next = new Date(Date.UTC(year, month, 1));
      const nextDate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
      where.createdAt = {
        gte: this.zonedDateTimeToUtc(startDate, "00:00:00", branch.timezone ?? "America/Mexico_City"),
        lt: this.zonedDateTimeToUtc(nextDate, "00:00:00", branch.timezone ?? "America/Mexico_City")
      };
    }

    const now = new Date();
    const [total, completed, pending, cancelled, overdue, byTypeRows, byAssigneeRows] = await this.prisma.$transaction([
      this.prisma.patientTask.count({ where }),
      this.prisma.patientTask.count({ where: { ...where, status: PatientTaskStatus.COMPLETED } }),
      this.prisma.patientTask.count({ where: { ...where, status: PatientTaskStatus.PENDING } }),
      this.prisma.patientTask.count({ where: { ...where, status: PatientTaskStatus.CANCELLED } }),
      this.prisma.patientTask.count({
        where: { ...where, status: PatientTaskStatus.PENDING, dueDate: { lt: now } }
      }),
      this.prisma.patientTask.groupBy({ by: ["type"], where, _count: { _all: true } }),
      this.prisma.patientTask.groupBy({ by: ["assignedToId"], where, _count: { _all: true } })
    ]);
    const assigneeIds = byAssigneeRows.flatMap((row) => (row.assignedToId ? [row.assignedToId] : []));
    const users = await this.prisma.user.findMany({
      where: { id: { in: assigneeIds }, organizationId: actor.organizationId },
      select: this.userSelect()
    });
    const userNames = new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]));
    const eligible = total - cancelled;

    return {
      total,
      completed,
      pending,
      overdue,
      cancelled,
      completionRate: eligible > 0 ? Number(((completed / eligible) * 100).toFixed(2)) : 0,
      metricDefinition: "completed / (total - cancelled) * 100",
      byType: byTypeRows.map((row) => ({ type: row.type, count: row._count._all })),
      byAssignee: byAssigneeRows.map((row) => ({
        assignedToId: row.assignedToId,
        name: row.assignedToId ? (userNames.get(row.assignedToId) ?? "Usuario no disponible") : "Sin responsable",
        count: row._count._all
      }))
    };
  }

  async getConfiguration(actor: AuthUser, branchId: string) {
    await this.ensureBranch(actor, branchId);
    const rows = await this.prisma.crmTaskConfiguration.findMany({
      where: { organizationId: actor.organizationId, branchId },
      orderBy: { type: "asc" }
    });
    const byType = new Map(rows.map((row) => [row.type, row]));
    return AUTOMATIC_CRM_TASK_TYPES.map((type) => {
      const row = byType.get(type);
      return row ?? {
        id: null,
        organizationId: actor.organizationId,
        branchId,
        type,
        enabled: true,
        delayValue: DEFAULT_CONFIG[type].delayValue,
        delayUnit: DEFAULT_CONFIG[type].delayUnit,
        defaultAssignedToId: null,
        createdAt: null,
        updatedAt: null
      };
    });
  }

  async updateConfiguration(actor: AuthUser, dto: UpdateCrmTaskConfigurationDto) {
    await this.ensureBranch(actor, dto.branchId);
    const types = new Set(dto.items.map((item) => item.type));
    if (types.size !== AUTOMATIC_CRM_TASK_TYPES.length || AUTOMATIC_CRM_TASK_TYPES.some((type) => !types.has(type))) {
      throw new BadRequestException("Configuration must contain COBRANZA, CAPTURA, CONTROL and CITA exactly once");
    }
    for (const item of dto.items) {
      await this.validateAssignee(actor, dto.branchId, item.defaultAssignedToId);
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.crmTaskConfiguration.upsert({
          where: {
            organizationId_branchId_type: {
              organizationId: actor.organizationId,
              branchId: dto.branchId,
              type: item.type
            }
          },
          create: {
            organizationId: actor.organizationId,
            branchId: dto.branchId,
            type: item.type,
            enabled: item.enabled,
            delayValue: item.delayValue,
            delayUnit: item.delayUnit,
            defaultAssignedToId: item.defaultAssignedToId || null,
            createdById: actor.id,
            updatedById: actor.id
          },
          update: {
            enabled: item.enabled,
            delayValue: item.delayValue,
            delayUnit: item.delayUnit,
            defaultAssignedToId: item.defaultAssignedToId || null,
            updatedById: actor.id
          }
        })
      )
    );
    return this.getConfiguration(actor, dto.branchId);
  }

  async handleAppointmentStatusChanged(appointmentId: string, status: AppointmentStatus) {
    if (!APPOINTMENT_FOLLOW_UP_STATUSES.has(status)) return null;
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        organizationId: true,
        branchId: true,
        patientId: true,
        startAt: true,
        createdById: true,
        updatedById: true
      }
    });
    if (!appointment?.patientId) return null;
    const futureCount = await this.prisma.appointment.count({
      where: {
        organizationId: appointment.organizationId,
        patientId: appointment.patientId,
        id: { not: appointment.id },
        startAt: { gt: new Date() },
        status: { notIn: FUTURE_APPOINTMENT_EXCLUDED_STATUSES }
      }
    });
    if (futureCount > 0) return null;
    const createdById = appointment.updatedById ?? appointment.createdById;
    if (!createdById) return null;
    return this.createAutomatic({
      organizationId: appointment.organizationId,
      branchId: appointment.branchId,
      patientId: appointment.patientId,
      type: "CITA",
      title: "Seguimiento de cita sin continuidad",
      detail: `Seguimiento automático por cambio de cita a ${status}.`,
      sourceType: "APPOINTMENT",
      sourceId: appointment.id,
      trigger: status,
      createdById,
      eventAt: appointment.startAt
    });
  }

  async handleTreatmentItemAdded(itemId: string, actorUserId: string) {
    const item = await this.prisma.treatmentPlanItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        treatmentPlan: {
          select: { organizationId: true, branchId: true, patientId: true, status: true }
        },
        procedure: { select: { name: true } },
        createdAt: true
      }
    });
    if (!item || item.treatmentPlan.status !== TreatmentPlanStatus.DRAFT) return null;
    return this.createAutomatic({
      organizationId: item.treatmentPlan.organizationId,
      branchId: item.treatmentPlan.branchId,
      patientId: item.treatmentPlan.patientId,
      type: "CAPTURA",
      title: "Captura de procedimiento pendiente",
      detail: `Procedimiento agregado al plan: ${item.procedure.name}.`,
      sourceType: "TREATMENT_PLAN_ITEM",
      sourceId: item.id,
      trigger: "ITEM_ADDED_TO_DRAFT_PLAN",
      createdById: actorUserId,
      eventAt: item.createdAt
    });
  }

  async handleBudgetAccepted(budgetId: string, actorUserId: string) {
    const budget = await this.prisma.budget.findUnique({
      where: { id: budgetId },
      select: {
        id: true,
        organizationId: true,
        patientId: true,
        total: true,
        acceptedAt: true,
        status: true,
        treatmentPlan: { select: { branchId: true } },
        items: {
          select: {
            treatmentPlanItem: {
              select: {
                paymentAllocations: {
                  where: { payment: { status: { not: PaymentStatus.VOIDED } } },
                  select: { amount: true, settlementDiscountAmount: true }
                }
              }
            }
          }
        }
      }
    });
    if (!budget || budget.status !== BudgetStatus.ACCEPTED) return [];
    const eventAt = budget.acceptedAt ?? new Date();
    const control = await this.createAutomatic({
      organizationId: budget.organizationId,
      branchId: budget.treatmentPlan.branchId,
      patientId: budget.patientId,
      type: "CONTROL",
      title: "Control de presupuesto aceptado",
      detail: "Seguimiento automático posterior a la aceptación del presupuesto.",
      sourceType: "BUDGET",
      sourceId: budget.id,
      trigger: "BUDGET_ACCEPTED",
      createdById: actorUserId,
      eventAt
    });
    const paid = budget.items.reduce(
      (total, item) =>
        total +
        item.treatmentPlanItem.paymentAllocations.reduce(
          (sum, allocation) => sum + Number(allocation.amount) + Number(allocation.settlementDiscountAmount),
          0
        ),
      0
    );
    const collection =
      Number(budget.total) > paid
        ? await this.createAutomatic({
            organizationId: budget.organizationId,
            branchId: budget.treatmentPlan.branchId,
            patientId: budget.patientId,
            type: "COBRANZA",
            title: "Cobranza de presupuesto con saldo pendiente",
            detail: `Saldo pendiente al aceptar presupuesto: ${(Number(budget.total) - paid).toFixed(2)}.`,
            sourceType: "BUDGET",
            sourceId: budget.id,
            trigger: "BUDGET_ACCEPTED_WITH_DEBT",
            createdById: actorUserId,
            eventAt
          })
        : null;
    return [control, collection].filter(Boolean);
  }

  private async transition(
    actor: AuthUser,
    id: string,
    version: number,
    status: PatientTaskStatus,
    action: string,
    reason?: string
  ) {
    const current = await this.get(actor, id);
    if (current.status === status) return current;
    if (status === PatientTaskStatus.PENDING && current.status !== PatientTaskStatus.COMPLETED) {
      throw new ConflictException("Only completed tasks can be reopened");
    }
    if (status !== PatientTaskStatus.PENDING && current.status !== PatientTaskStatus.PENDING) {
      throw new ConflictException("Only pending tasks can change to that status");
    }
    const now = new Date();
    const data: Prisma.PatientTaskUncheckedUpdateInput = {
      status,
      version: { increment: 1 },
      completedAt: status === PatientTaskStatus.COMPLETED ? now : null,
      completedById: status === PatientTaskStatus.COMPLETED ? actor.id : null,
      cancelledAt: status === PatientTaskStatus.CANCELLED ? now : null,
      cancelledById: status === PatientTaskStatus.CANCELLED ? actor.id : null,
      cancellationReason: status === PatientTaskStatus.CANCELLED ? reason : null
    };
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.patientTask.updateMany({
        where: { id, organizationId: actor.organizationId, version, status: current.status },
        data
      });
      if (result.count !== 1) throw new ConflictException("Task changed by another user; reload before retrying");
      const updated = await tx.patientTask.findUniqueOrThrow({ where: { id }, include: this.taskInclude() });
      await tx.crmTaskHistory.create({
        data: {
          taskId: id,
          action,
          actorUserId: actor.id,
          before: this.taskSnapshot(current),
          after: this.taskSnapshot(updated)
        }
      });
      return updated;
    });
  }

  private async createAutomatic(input: {
    organizationId: string;
    branchId: string;
    patientId: string;
    type: string;
    title: string;
    detail: string;
    sourceType: string;
    sourceId: string;
    trigger: string;
    createdById: string;
    eventAt: Date;
  }) {
    const config = await this.prisma.crmTaskConfiguration.findUnique({
      where: {
        organizationId_branchId_type: {
          organizationId: input.organizationId,
          branchId: input.branchId,
          type: input.type
        }
      }
    });
    if (config && !config.enabled) return null;
    const delay = config ?? DEFAULT_CONFIG[input.type];
    if (!delay) return null;
    const dueDate = this.addDelay(input.eventAt, delay.delayValue, delay.delayUnit);
    const assignedToId = config?.defaultAssignedToId ?? null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const task = await tx.patientTask.create({
          data: {
            organizationId: input.organizationId,
            branchId: input.branchId,
            patientId: input.patientId,
            type: input.type,
            title: input.title,
            detail: input.detail,
            dueDate,
            priority: CrmTaskPriority.NORMAL,
            origin: CrmTaskOrigin.AUTOMATIC,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            trigger: input.trigger,
            assignedToId,
            createdById: input.createdById
          }
        });
        await tx.crmTaskHistory.create({
          data: {
            taskId: task.id,
            action: "AUTOMATICALLY_CREATED",
            actorUserId: input.createdById,
            after: {
              sourceType: input.sourceType,
              sourceId: input.sourceId,
              trigger: input.trigger,
              dueDate: dueDate.toISOString()
            }
          }
        });
        return task;
      });
    } catch (error) {
      if (!this.isUniqueConstraint(error)) throw error;
      return this.prisma.patientTask.findFirst({
        where: {
          organizationId: input.organizationId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          trigger: input.trigger,
          type: input.type
        }
      });
    }
  }

  private buildListWhere(actor: AuthUser, query: ListCrmTasksQueryDto, timezone: string): Prisma.PatientTaskWhereInput {
    const where: Prisma.PatientTaskWhereInput = {
      organizationId: actor.organizationId,
      branchId: query.branchId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.origin ? { origin: query.origin } : {})
    };
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { detail: { contains: search, mode: "insensitive" } },
        { patient: { firstName: { contains: search, mode: "insensitive" } } },
        { patient: { lastName: { contains: search, mode: "insensitive" } } }
      ];
    }
    if (query.overdue === "true") {
      where.status = PatientTaskStatus.PENDING;
      where.dueDate = { lt: new Date() };
    } else if (query.date) {
      const range = this.localDayRange(query.date, timezone);
      where.dueDate = { gte: range.start, lt: range.end };
    }
    return where;
  }

  private resolveOrderBy(sortBy: string, sortOrder: "asc" | "desc"): Prisma.PatientTaskOrderByWithRelationInput[] {
    return [{ [sortBy]: sortOrder }, { createdAt: "desc" }] as Prisma.PatientTaskOrderByWithRelationInput[];
  }

  private async ensureBranch(actor: AuthUser, branchId: string) {
    if (!actor.branchIds.includes(branchId)) throw new NotFoundException("Branch not found");
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: actor.organizationId, deletedAt: null },
      select: { id: true, timezone: true }
    });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  private async ensurePatient(actor: AuthUser, patientId: string, branchId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: actor.organizationId, branchId, deletedAt: null },
      select: { id: true }
    });
    if (!patient) throw new NotFoundException("Patient not found");
  }

  private async validateAssignee(actor: AuthUser, branchId: string, assignedToId?: string | null) {
    const id = assignedToId?.trim();
    if (!id) return null;
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        isActive: true,
        deletedAt: null,
        branches: { some: { branchId } }
      },
      select: { id: true }
    });
    if (!user) throw new BadRequestException("Invalid assignedToId for branch");
    return user.id;
  }

  private taskInclude() {
    return {
      patient: { select: { id: true, firstName: true, lastName: true, branchId: true } },
      branch: { select: { id: true, name: true, timezone: true } },
      assignedTo: { select: this.userSelect() },
      createdBy: { select: this.userSelect() },
      completedBy: { select: this.userSelect() },
      cancelledBy: { select: this.userSelect() }
    } as const;
  }

  private userSelect() {
    return { id: true, firstName: true, lastName: true, email: true } as const;
  }

  private taskSnapshot(task: {
    type: string;
    title: string;
    detail: string;
    dueDate: Date | null;
    assignedToId: string | null;
    status: PatientTaskStatus;
    priority: CrmTaskPriority;
    version: number;
  }): Prisma.InputJsonValue {
    return {
      type: task.type,
      title: task.title,
      detail: task.detail,
      dueDate: task.dueDate?.toISOString() ?? null,
      assignedToId: task.assignedToId,
      status: task.status,
      priority: task.priority,
      version: task.version
    };
  }

  private requiredText(value: string, field: string) {
    const text = value.trim();
    if (!text) throw new BadRequestException(`${field} is required`);
    return text;
  }

  private optionalIdempotencyKey(value?: string) {
    const key = value?.trim();
    if (!key) return null;
    if (key.length > 120) throw new BadRequestException("Idempotency-Key is too long");
    return key;
  }

  private isUniqueConstraint(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private addDelay(date: Date, value: number, unit: CrmTaskDelayUnit) {
    const result = new Date(date);
    if (unit === CrmTaskDelayUnit.DAYS) result.setUTCDate(result.getUTCDate() + value);
    if (unit === CrmTaskDelayUnit.WEEKS) result.setUTCDate(result.getUTCDate() + value * 7);
    if (unit === CrmTaskDelayUnit.MONTHS) result.setUTCMonth(result.getUTCMonth() + value);
    if (unit === CrmTaskDelayUnit.YEARS) result.setUTCFullYear(result.getUTCFullYear() + value);
    return result;
  }

  private localDayRange(date: string, timezone: string) {
    return {
      start: this.zonedDateTimeToUtc(date, "00:00:00", timezone),
      end: this.zonedDateTimeToUtc(this.nextDate(date), "00:00:00", timezone)
    };
  }

  private nextDate(date: string) {
    const [year, month, day] = date.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  }

  private zonedDateTimeToUtc(date: string, time: string, timezone: string) {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute, second] = time.split(":").map(Number);
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    let candidate = desired;
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = Object.fromEntries(
        formatter
          .formatToParts(new Date(candidate))
          .filter((part) => part.type !== "literal")
          .map((part) => [part.type, Number(part.value)])
      );
      const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      candidate += desired - represented;
    }
    return new Date(candidate);
  }
}
