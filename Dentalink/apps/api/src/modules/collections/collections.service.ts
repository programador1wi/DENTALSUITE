import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CollectionCaseStatus, InstallmentStatus, Prisma } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  AddCollectionActivityDto,
  AssignCollectionCaseDto,
  CreateCollectionCaseDto,
  DetectOverdueCasesDto,
  ListCollectionCasesQueryDto,
  UpdateCollectionCaseStatusDto
} from "./dto/collections.dto";

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCases(actor: AuthUser, query: ListCollectionCasesQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.collectionCase.findMany({
      where: {
        patient: {
          organizationId: actor.organizationId,
          branchId: branchScope(actor, query.branchId)
        },
        ...(query.patientId ? { patientId: query.patientId } : {}),
        ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, branchId: true } },
        installment: { select: { id: true, dueDate: true, amount: true, paidAmount: true, status: true } },
        treatmentPlan: { select: { id: true, name: true, status: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { user: { select: { id: true, firstName: true, lastName: true } } }
        }
      },
      skip,
      take,
      orderBy: [{ status: "asc" }, { daysOverdue: "desc" }, { createdAt: "desc" }]
    });
  }

  async getCase(actor: AuthUser, id: string) {
    const row = await this.prisma.collectionCase.findFirst({
      where: {
        id,
        patient: { organizationId: actor.organizationId, branchId: branchScope(actor) }
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, branchId: true } },
        installment: { select: { id: true, dueDate: true, amount: true, paidAmount: true, status: true } },
        treatmentPlan: { select: { id: true, name: true, status: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        activities: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, firstName: true, lastName: true } } }
        }
      }
    });
    if (!row) throw new NotFoundException("Collection case not found");
    return row;
  }

  async createCase(actor: AuthUser, dto: CreateCollectionCaseDto) {
    await this.ensurePatient(actor, dto.patientId);
    await this.ensureAssignableUser(actor, dto.assignedToId);

    if (!dto.installmentId && !dto.treatmentPlanId) {
      throw new BadRequestException("installmentId or treatmentPlanId is required");
    }

    if (dto.installmentId) {
      const installment = await this.prisma.installment.findFirst({
        where: {
          id: dto.installmentId,
          patientId: dto.patientId,
          patient: { organizationId: actor.organizationId, branchId: branchScope(actor) }
        }
      });
      if (!installment) throw new BadRequestException("Invalid installment for patient");
    }

    if (dto.treatmentPlanId) {
      const plan = await this.prisma.treatmentPlan.findFirst({
        where: {
          id: dto.treatmentPlanId,
          patientId: dto.patientId,
          organizationId: actor.organizationId
        }
      });
      if (!plan) throw new BadRequestException("Invalid treatment plan for patient");
    }

    const duplicate = await this.prisma.collectionCase.findFirst({
      where: {
        patientId: dto.patientId,
        installmentId: dto.installmentId ?? null,
        treatmentPlanId: dto.treatmentPlanId ?? null,
        status: { in: ["PENDING", "CONTACTED", "PROMISE_TO_PAY"] }
      }
    });

    if (duplicate) {
      throw new BadRequestException("An active collection case already exists for this scope");
    }

    const created = await this.prisma.collectionCase.create({
      data: {
        patientId: dto.patientId,
        installmentId: dto.installmentId,
        treatmentPlanId: dto.treatmentPlanId,
        amountDue: this.toDecimal(dto.amountDue),
        daysOverdue: dto.daysOverdue,
        status: dto.status ?? CollectionCaseStatus.PENDING,
        assignedToId: dto.assignedToId,
        lastContactAt: dto.lastContactAt ? new Date(dto.lastContactAt) : null,
        nextContactAt: dto.nextContactAt ? new Date(dto.nextContactAt) : null
      }
    });

    await this.audit(actor, {
      entity: "CollectionCase",
      entityId: created.id,
      action: "create",
      after: {
        patientId: dto.patientId,
        installmentId: dto.installmentId,
        treatmentPlanId: dto.treatmentPlanId,
        amountDue: dto.amountDue
      }
    });

    return this.getCase(actor, created.id);
  }

  async detectOverdueCases(actor: AuthUser, dto: DetectOverdueCasesDto) {
    const minDays = dto.minDaysOverdue ?? 1;
    const now = new Date();

    const rows = await this.prisma.installment.findMany({
      where: {
        patient: {
          organizationId: actor.organizationId,
          branchId: branchScope(actor, dto.branchId)
        },
        dueDate: { lt: now },
        status: { in: [InstallmentStatus.PENDING, InstallmentStatus.PARTIAL, InstallmentStatus.OVERDUE] }
      },
      include: {
        patient: { select: { id: true } },
        installmentPlan: { select: { treatmentPlanId: true } }
      },
      orderBy: { dueDate: "asc" }
    });

    const assignedToId = dto.assignedToId ?? actor.id;
    await this.ensureAssignableUser(actor, assignedToId);

    let createdCount = 0;
    for (const installment of rows) {
      const daysOverdue = Math.floor((now.getTime() - installment.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue < minDays) continue;

      const amountDue = this.roundMoney(Number(installment.amount) - Number(installment.paidAmount));
      if (amountDue <= 0) continue;

      const existing = await this.prisma.collectionCase.findFirst({
        where: {
          installmentId: installment.id,
          status: { in: ["PENDING", "CONTACTED", "PROMISE_TO_PAY"] }
        }
      });
      if (existing) continue;

      await this.prisma.collectionCase.create({
        data: {
          patientId: installment.patientId,
          installmentId: installment.id,
          treatmentPlanId: installment.installmentPlan.treatmentPlanId,
          amountDue: this.toDecimal(amountDue),
          daysOverdue,
          status: CollectionCaseStatus.PENDING,
          assignedToId
        }
      });
      createdCount += 1;
    }

    return {
      scanned: rows.length,
      created: createdCount
    };
  }

  async updateStatus(actor: AuthUser, id: string, dto: UpdateCollectionCaseStatusDto) {
    const current = await this.prisma.collectionCase.findFirst({
      where: { id, patient: { organizationId: actor.organizationId, branchId: branchScope(actor) } }
    });
    if (!current) throw new NotFoundException("Collection case not found");

    const updated = await this.prisma.collectionCase.update({
      where: { id },
      data: { status: dto.status }
    });

    await this.audit(actor, {
      entity: "CollectionCase",
      entityId: id,
      action: "update_status",
      before: { status: current.status },
      after: { status: dto.status }
    });

    return updated;
  }

  async assignCase(actor: AuthUser, id: string, dto: AssignCollectionCaseDto) {
    await this.ensureAssignableUser(actor, dto.assignedToId);
    const current = await this.prisma.collectionCase.findFirst({
      where: { id, patient: { organizationId: actor.organizationId, branchId: branchScope(actor) } }
    });
    if (!current) throw new NotFoundException("Collection case not found");

    const updated = await this.prisma.collectionCase.update({
      where: { id },
      data: { assignedToId: dto.assignedToId }
    });

    await this.audit(actor, {
      entity: "CollectionCase",
      entityId: id,
      action: "assign",
      before: { assignedToId: current.assignedToId },
      after: { assignedToId: dto.assignedToId }
    });
    return updated;
  }

  async addActivity(actor: AuthUser, id: string, dto: AddCollectionActivityDto) {
    const row = await this.prisma.collectionCase.findFirst({
      where: { id, patient: { organizationId: actor.organizationId, branchId: branchScope(actor) } }
    });
    if (!row) throw new NotFoundException("Collection case not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.collectionActivity.create({
        data: {
          collectionCaseId: id,
          userId: actor.id,
          channel: dto.channel.trim(),
          result: dto.result.trim(),
          notes: dto.notes?.trim(),
          nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : null
        }
      });

      await tx.collectionCase.update({
        where: { id },
        data: {
          lastContactAt: new Date(),
          nextContactAt: dto.nextActionAt ? new Date(dto.nextActionAt) : row.nextContactAt,
          status: row.status === CollectionCaseStatus.PENDING ? CollectionCaseStatus.CONTACTED : row.status
        }
      });
    });

    await this.audit(actor, {
      entity: "CollectionActivity",
      entityId: id,
      action: "create",
      after: {
        channel: dto.channel,
        result: dto.result,
        nextActionAt: dto.nextActionAt
      }
    });

    return this.getCase(actor, id);
  }

  private async ensurePatient(actor: AuthUser, patientId: string) {
    const row = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: actor.organizationId, branchId: branchScope(actor), deletedAt: null }
    });
    if (!row) throw new NotFoundException("Patient not found");
    return row;
  }

  private async ensureAssignableUser(actor: AuthUser, userId: string) {
    const row = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId, deletedAt: null, isActive: true }
    });
    if (!row) throw new NotFoundException("Assigned user not found");
    return row;
  }

  private toDecimal(value: number) {
    return new Prisma.Decimal(this.roundMoney(value));
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private async audit(
    actor: AuthUser,
    payload: {
      entity: string;
      entityId?: string;
      action: string;
      before?: Prisma.InputJsonValue;
      after?: Prisma.InputJsonValue;
    }
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        actorUserId: actor.id,
        entity: payload.entity,
        entityId: payload.entityId,
        action: payload.action,
        before: payload.before,
        after: payload.after
      }
    });
  }
}
