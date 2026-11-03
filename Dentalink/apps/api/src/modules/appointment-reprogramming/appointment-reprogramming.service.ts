import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AppointmentReprogrammingBatchItemStatus,
  AppointmentReprogrammingBatchStatus,
  AppointmentReprogrammingCaseStatus,
  AppointmentStatus,
  Prisma
} from "@prisma/client";
import { AuthUser } from "../../common/types/auth-user";
import { assertBranchAccess } from "../../common/utils/branch-scope.util";
import { PrismaService } from "../../database/prisma.service";
import { AppointmentsService } from "../appointments/appointments.service";
import { AvailabilityQueryDto } from "../appointments/dto/appointment-actions.dto";
import { CreateAppointmentDto } from "../appointments/dto/create-appointment.dto";
import { TreatmentPlanFinancialSummaryService } from "../treatment-plans/treatment-plan-financial-summary.service";
import {
  CreateMassReprogrammingBatchDto,
  DefinitivelyCancelReprogrammingCaseDto,
  ListReprogrammingCasesQueryDto,
  PreviewMassReprogrammingDto,
  RescheduleAppointmentCaseDto
} from "./dto/appointment-reprogramming.dto";

const MASS_REPROGRAMMING_ALLOWED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CONFIRMED_BY_WHATSAPP,
  AppointmentStatus.CONFIRMED_BY_PHONE,
  AppointmentStatus.CONFIRMED_BY_EMAIL,
  AppointmentStatus.PENDING_CONFIRMATION,
  AppointmentStatus.NOTIFIED_BY_WHATSAPP,
  AppointmentStatus.NOTIFIED_BY_EMAIL
];
const OPEN_REPROGRAMMING_CASE_STATUSES: AppointmentReprogrammingCaseStatus[] = [
  AppointmentReprogrammingCaseStatus.PENDING,
  AppointmentReprogrammingCaseStatus.IN_PROGRESS
];
const TERMINAL_BATCH_ITEM_STATUSES: AppointmentReprogrammingBatchItemStatus[] = [
  AppointmentReprogrammingBatchItemStatus.PROCESSED,
  AppointmentReprogrammingBatchItemStatus.SKIPPED,
  AppointmentReprogrammingBatchItemStatus.EXCLUDED
];

@Injectable()
export class AppointmentReprogrammingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsService: AppointmentsService,
    private readonly financialSummaryService: TreatmentPlanFinancialSummaryService
  ) {}

  async preview(actor: AuthUser, dto: PreviewMassReprogrammingDto) {
    const context = await this.resolveBatchContext(actor, dto);
    const appointments = await this.prisma.appointment.findMany({
      where: this.previewWhere(actor, dto, context.startAt, context.endAt),
      include: {
        branch: { select: { id: true, name: true, timezone: true } },
        patient: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        chair: { select: { id: true, name: true } },
        _count: { select: { appointmentNotes: true } }
      },
      orderBy: { startAt: "asc" }
    });

    return {
      criteria: {
        branchId: dto.branchId,
        professionalId: dto.professionalId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        timezone: context.timezone,
        rangeStartAt: context.startAt,
        rangeEndAt: context.endAt,
        reasonCode: dto.reasonCode.trim(),
        reasonText: dto.reasonText.trim(),
        observation: dto.observation?.trim() || null
      },
      total: appointments.length,
      appointments: appointments.map((appointment) => ({
        id: appointment.id,
        patient: appointment.patient,
        branch: appointment.branch,
        professional: appointment.professional,
        chair: appointment.chair,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        durationMinutes: appointment.durationMinutes,
        status: appointment.status,
        attentionReason: appointment.reason || appointment.title,
        warnings: [
          ...(!appointment.patient?.phone && !appointment.patient?.email
            ? ["Paciente sin teléfono ni correo registrado"]
            : []),
          ...(appointment._count.appointmentNotes > 0
            ? [`La cita tiene ${appointment._count.appointmentNotes} observación(es)`]
            : [])
        ]
      }))
    };
  }

  async createBatch(actor: AuthUser, dto: CreateMassReprogrammingBatchDto, idempotencyKey: string) {
    const normalizedKey = idempotencyKey?.trim();
    if (!normalizedKey) throw new BadRequestException("Idempotency-Key es obligatorio");

    const repeated = await this.prisma.appointmentReprogrammingBatch.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: actor.organizationId,
          idempotencyKey: normalizedKey
        }
      },
      select: { id: true }
    });
    if (repeated) return this.getBatch(actor, repeated.id);

    const preview = await this.preview(actor, dto);
    const previewIds = new Set(preview.appointments.map((appointment) => appointment.id));
    const selectedIds = [...new Set(dto.selectedAppointmentIds)];
    const invalidIds = selectedIds.filter((id) => !previewIds.has(id));
    if (invalidIds.length) {
      throw new ConflictException({
        code: "REPROGRAMMING_PREVIEW_STALE",
        message: "Algunas citas ya no cumplen los criterios de la vista previa",
        appointmentIds: invalidIds
      });
    }

    const selectedSet = new Set(selectedIds);
    const excludedIds = preview.appointments
      .map((appointment) => appointment.id)
      .filter((id) => !selectedSet.has(id));

    let batchId: string;
    try {
      const batch = await this.prisma.$transaction(async (tx) => {
        const created = await tx.appointmentReprogrammingBatch.create({
          data: {
            organizationId: actor.organizationId,
            branchId: dto.branchId,
            professionalId: dto.professionalId,
            startAt: preview.criteria.rangeStartAt,
            endAt: preview.criteria.rangeEndAt,
            timezone: preview.criteria.timezone,
            reasonCode: preview.criteria.reasonCode,
            reasonText: preview.criteria.reasonText,
            observation: preview.criteria.observation,
            idempotencyKey: normalizedKey,
            status: AppointmentReprogrammingBatchStatus.PROCESSING,
            selectedCount: selectedIds.length,
            excludedCount: excludedIds.length,
            createdById: actor.id,
            items: {
              create: preview.appointments.map((appointment) => ({
                appointmentId: appointment.id,
                status: selectedSet.has(appointment.id)
                  ? AppointmentReprogrammingBatchItemStatus.PENDING
                  : AppointmentReprogrammingBatchItemStatus.EXCLUDED
              }))
            }
          }
        });
        await this.audit(tx, actor, "AppointmentReprogrammingBatch", created.id, "reprogramming.batch.created", {
          branchId: dto.branchId,
          professionalId: dto.professionalId,
          selectedCount: selectedIds.length,
          excludedCount: excludedIds.length,
          startDate: dto.startDate,
          endDate: dto.endDate,
          reasonCode: dto.reasonCode
        }, dto.branchId);
        return created;
      });
      batchId = batch.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.appointmentReprogrammingBatch.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: actor.organizationId,
              idempotencyKey: normalizedKey
            }
          },
          select: { id: true }
        });
        if (existing) return this.getBatch(actor, existing.id);
      }
      throw error;
    }

    await this.processBatchItems(actor, batchId, AppointmentReprogrammingBatchItemStatus.PENDING);
    return this.getBatch(actor, batchId);
  }

  async retryFailedBatchItems(actor: AuthUser, batchId: string) {
    await this.ensureBatchAccess(actor, batchId);
    await this.prisma.appointmentReprogrammingBatch.update({
      where: { id: batchId },
      data: { status: AppointmentReprogrammingBatchStatus.PROCESSING, completedAt: null }
    });
    await this.processBatchItems(actor, batchId, AppointmentReprogrammingBatchItemStatus.FAILED);
    return this.getBatch(actor, batchId);
  }

  async getBatch(actor: AuthUser, batchId: string) {
    const batch = await this.prisma.appointmentReprogrammingBatch.findFirst({
      where: {
        id: batchId,
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds }
      },
      include: {
        branch: { select: { id: true, name: true } },
        professional: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            appointment: {
              select: {
                id: true,
                startAt: true,
                endAt: true,
                patient: { select: { id: true, firstName: true, lastName: true } }
              }
            },
            case: { select: { id: true, status: true } }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });
    if (!batch) throw new NotFoundException("Lote de reprogramación no encontrado");
    return batch;
  }

  async listCases(actor: AuthUser, query: ListReprogrammingCasesQueryDto) {
    if (query.branchId) assertBranchAccess(actor, query.branchId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    const where: Prisma.AppointmentReprogrammingCaseWhereInput = {
      organizationId: actor.organizationId,
      branchId: query.branchId ? query.branchId : { in: actor.branchIds },
      originalProfessionalId: query.professionalId || undefined,
      status: query.status
        ? (query.status as AppointmentReprogrammingCaseStatus)
        : { in: [AppointmentReprogrammingCaseStatus.PENDING, AppointmentReprogrammingCaseStatus.IN_PROGRESS] },
      ...(search
        ? {
            OR: [
              { patient: { firstName: { contains: search, mode: "insensitive" } } },
              { patient: { lastName: { contains: search, mode: "insensitive" } } },
              { patient: { phone: { contains: search } } },
              { reasonText: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [total, cases] = await this.prisma.$transaction([
      this.prisma.appointmentReprogrammingCase.count({ where }),
      this.prisma.appointmentReprogrammingCase.findMany({
        where,
        include: this.caseInclude(),
        orderBy: [{ originalStartAt: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    const financialByPlan = await this.financialSituations(actor, cases);

    return {
      items: cases.map((item) => this.presentCase(item, financialByPlan)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    };
  }

  async getCase(actor: AuthUser, caseId: string) {
    const item = await this.prisma.appointmentReprogrammingCase.findFirst({
      where: {
        id: caseId,
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds }
      },
      include: this.caseInclude()
    });
    if (!item) throw new NotFoundException("Caso de reprogramación no encontrado");
    const financialByPlan = await this.financialSituations(actor, [item]);
    return this.presentCase(item, financialByPlan);
  }

  availability(actor: AuthUser, query: AvailabilityQueryDto) {
    return this.appointmentsService.availability(actor, query);
  }

  async rescheduleCase(actor: AuthUser, caseId: string, dto: RescheduleAppointmentCaseDto) {
    const current = await this.getCaseRecord(actor, caseId);
    if (dto.branchId !== current.branchId) this.assertPermission(actor, "agenda.reprogramming.change_branch");
    if (dto.professionalId !== current.originalProfessionalId) {
      this.assertPermission(actor, "agenda.reprogramming.change_professional");
    }

    const appointmentDto: CreateAppointmentDto = {
      branchId: dto.branchId,
      patientId: current.patientId,
      professionalId: dto.professionalId,
      chairId: dto.chairId,
      chairIndex: dto.chairIndex,
      attendanceMode: dto.attendanceMode ?? current.originalAppointment.attendanceMode,
      specialtyId: current.originalAppointment.specialtyId ?? undefined,
      treatmentPlanId: current.originalAppointment.treatmentPlanId ?? undefined,
      title: current.originalAppointment.title,
      reason: current.originalAppointment.reason ?? undefined,
      status: dto.initialStatus ?? AppointmentStatus.SCHEDULED,
      startAt: dto.startAt,
      endAt: dto.endAt,
      durationMinutes: dto.durationMinutes,
      notes: dto.notes?.trim() || current.originalAppointment.notes || undefined
    };
    const prepared = await this.appointmentsService.prepareReprogrammedAppointment(
      actor,
      appointmentDto,
      current.originalAppointmentId
    );

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "AppointmentReprogrammingCase" WHERE "id" = ${caseId} FOR UPDATE`
      );
      const locked = await tx.appointmentReprogrammingCase.findFirst({
        where: { id: caseId, organizationId: actor.organizationId, branchId: { in: actor.branchIds } }
      });
      if (!locked) throw new NotFoundException("Caso de reprogramación no encontrado");
      if (
        !OPEN_REPROGRAMMING_CASE_STATUSES.includes(locked.status)
      ) {
        throw new ConflictException("El caso ya fue cerrado");
      }
      if (locked.version !== dto.version) {
        throw new ConflictException({
          code: "REPROGRAMMING_CASE_VERSION_CONFLICT",
          message: "El caso cambió. Actualiza la bandeja antes de continuar."
        });
      }

      const appointment = await this.appointmentsService.createReprogrammedAppointmentInTransaction(
        tx,
        actor,
        prepared
      );
      const updated = await tx.appointmentReprogrammingCase.update({
        where: { id: caseId },
        data: {
          newAppointmentId: appointment.id,
          status: AppointmentReprogrammingCaseStatus.RESCHEDULED,
          updatedById: actor.id,
          completedAt: new Date(),
          version: { increment: 1 }
        }
      });
      await this.audit(tx, actor, "AppointmentReprogrammingCase", caseId, "reprogramming.case.rescheduled", {
        originalAppointmentId: current.originalAppointmentId,
        newAppointmentId: appointment.id,
        previousVersion: locked.version,
        branchId: dto.branchId,
        professionalId: dto.professionalId,
        startAt: dto.startAt,
        endAt: dto.endAt
      }, dto.branchId);
      return { appointment, updated };
    });

    if (dto.notifyPatient) {
      await this.enqueueNotificationAfterCommit(actor, current, result.appointment.id);
    }
    return this.getCase(actor, result.updated.id);
  }

  async definitivelyCancelCase(
    actor: AuthUser,
    caseId: string,
    dto: DefinitivelyCancelReprogrammingCaseDto
  ) {
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException("El motivo es obligatorio");
    await this.getCaseRecord(actor, caseId);

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "AppointmentReprogrammingCase" WHERE "id" = ${caseId} FOR UPDATE`
      );
      const locked = await tx.appointmentReprogrammingCase.findUnique({ where: { id: caseId } });
      if (!locked) throw new NotFoundException("Caso de reprogramación no encontrado");
      if (
        !OPEN_REPROGRAMMING_CASE_STATUSES.includes(locked.status)
      ) {
        throw new ConflictException("El caso ya fue cerrado");
      }
      if (locked.version !== dto.version) {
        throw new ConflictException({
          code: "REPROGRAMMING_CASE_VERSION_CONFLICT",
          message: "El caso cambió. Actualiza la bandeja antes de continuar."
        });
      }

      await tx.appointmentReprogrammingCase.update({
        where: { id: caseId },
        data: {
          status: AppointmentReprogrammingCaseStatus.DEFINITIVELY_CANCELLED,
          closedReason: reason,
          closedObservation: dto.observation?.trim() || null,
          updatedById: actor.id,
          cancelledAt: new Date(),
          version: { increment: 1 }
        }
      });
      await this.audit(
        tx,
        actor,
        "AppointmentReprogrammingCase",
        caseId,
        "reprogramming.case.definitively_cancelled",
        { reason, observation: dto.observation?.trim() || null, previousVersion: locked.version },
        locked.branchId
      );
    });
    return this.getCase(actor, caseId);
  }

  private async processBatchItems(
    actor: AuthUser,
    batchId: string,
    status: AppointmentReprogrammingBatchItemStatus
  ) {
    const items = await this.prisma.appointmentReprogrammingBatchItem.findMany({
      where: { batchId, status },
      select: { id: true }
    });
    for (const item of items) {
      await this.processBatchItem(actor, batchId, item.id);
    }
    await this.refreshBatchCounts(batchId);
  }

  private async processBatchItem(actor: AuthUser, batchId: string, itemId: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "AppointmentReprogrammingBatchItem" WHERE "id" = ${itemId} FOR UPDATE`
        );
        const item = await tx.appointmentReprogrammingBatchItem.findFirst({
          where: { id: itemId, batchId },
          include: {
            batch: true,
            appointment: {
              include: {
                patient: true,
                professional: true,
                branch: true,
                chair: true
              }
            }
          }
        });
        if (!item) throw new NotFoundException("Elemento del lote no encontrado");
        if (
          TERMINAL_BATCH_ITEM_STATUSES.includes(item.status)
        ) {
          return;
        }
        if (
          item.batch.organizationId !== actor.organizationId ||
          !actor.branchIds.includes(item.batch.branchId)
        ) {
          throw new ForbiddenException("Branch access denied");
        }

        const appointment = item.appointment;
        if (!appointment.patientId) {
          throw new ConflictException("La cita no tiene paciente y no puede ingresar a reprogramación");
        }
        if (!MASS_REPROGRAMMING_ALLOWED_STATUSES.includes(appointment.status)) {
          throw new ConflictException(`La cita cambió a estado ${appointment.status}`);
        }
        if (
          appointment.branchId !== item.batch.branchId ||
          appointment.professionalId !== item.batch.professionalId ||
          appointment.startAt < item.batch.startAt ||
          appointment.startAt >= item.batch.endAt
        ) {
          throw new ConflictException("La cita ya no coincide con los criterios del lote");
        }

        const existingCase = await tx.appointmentReprogrammingCase.findUnique({
          where: { originalAppointmentId: appointment.id },
          select: { id: true }
        });
        if (existingCase) {
          await tx.appointmentReprogrammingBatchItem.update({
            where: { id: item.id },
            data: {
              status: AppointmentReprogrammingBatchItemStatus.SKIPPED,
              caseId: existingCase.id,
              errorCode: "CASE_ALREADY_EXISTS",
              errorMessage: "La cita ya tiene un caso de reprogramación",
              attempts: { increment: 1 },
              processedAt: new Date()
            }
          });
          return;
        }

        const originalSnapshot: Prisma.InputJsonObject = {
          appointmentId: appointment.id,
          branchId: appointment.branchId,
          branchName: appointment.branch.name,
          patientId: appointment.patientId,
          patientName: appointment.patient
            ? `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim()
            : "",
          professionalId: appointment.professionalId,
          professionalName: `${appointment.professional.firstName} ${appointment.professional.lastName}`.trim(),
          chairId: appointment.chairId ?? "",
          chairName: appointment.chair?.name ?? "",
          title: appointment.title,
          reason: appointment.reason ?? "",
          status: appointment.status,
          startAt: appointment.startAt.toISOString(),
          endAt: appointment.endAt.toISOString(),
          durationMinutes: appointment.durationMinutes,
          notes: appointment.notes ?? ""
        };
        const reprogrammingCase = await tx.appointmentReprogrammingCase.create({
          data: {
            organizationId: actor.organizationId,
            branchId: appointment.branchId,
            originalAppointmentId: appointment.id,
            batchId: item.batchId,
            patientId: appointment.patientId,
            originalProfessionalId: appointment.professionalId,
            reasonCode: item.batch.reasonCode,
            reasonText: item.batch.reasonText,
            originalStartAt: appointment.startAt,
            originalEndAt: appointment.endAt,
            originalDurationMinutes: appointment.durationMinutes,
            originalBoxId: appointment.chairId,
            originalAttentionReason: appointment.reason || appointment.title,
            originalSnapshot,
            createdById: actor.id,
            updatedById: actor.id
          }
        });
        await tx.appointment.update({
          where: { id: appointment.id },
          data: {
            status: AppointmentStatus.CANCELLED_RESCHEDULED,
            cancellationReason: item.batch.reasonText,
            updatedById: actor.id
          }
        });
        await tx.appointmentStatusHistory.create({
          data: {
            appointmentId: appointment.id,
            previousStatus: appointment.status,
            newStatus: AppointmentStatus.CANCELLED_RESCHEDULED,
            changedById: actor.id,
            reason: item.batch.reasonText
          }
        });
        await tx.appointmentReprogrammingBatchItem.update({
          where: { id: item.id },
          data: {
            status: AppointmentReprogrammingBatchItemStatus.PROCESSED,
            caseId: reprogrammingCase.id,
            errorCode: null,
            errorMessage: null,
            attempts: { increment: 1 },
            processedAt: new Date()
          }
        });
        await this.audit(
          tx,
          actor,
          "Appointment",
          appointment.id,
          "appointment.cancelled_for_reprogramming",
          {
            previousStatus: appointment.status,
            newStatus: AppointmentStatus.CANCELLED_RESCHEDULED,
            reprogrammingCaseId: reprogrammingCase.id,
            batchId: item.batchId,
            reasonCode: item.batch.reasonCode
          },
          appointment.branchId
        );
      });
    } catch (error) {
      const details = this.errorDetails(error);
      await this.prisma.appointmentReprogrammingBatchItem.updateMany({
        where: {
          id: itemId,
          batchId,
          status: {
            in: [
              AppointmentReprogrammingBatchItemStatus.PENDING,
              AppointmentReprogrammingBatchItemStatus.FAILED
            ]
          }
        },
        data: {
          status: AppointmentReprogrammingBatchItemStatus.FAILED,
          errorCode: details.code,
          errorMessage: details.message.slice(0, 500),
          attempts: { increment: 1 },
          processedAt: new Date()
        }
      });
    }
  }

  private async refreshBatchCounts(batchId: string) {
    const items = await this.prisma.appointmentReprogrammingBatchItem.findMany({
      where: { batchId },
      select: { status: true }
    });
    const count = (status: AppointmentReprogrammingBatchItemStatus) =>
      items.filter((item) => item.status === status).length;
    const processedCount = count(AppointmentReprogrammingBatchItemStatus.PROCESSED);
    const skippedCount = count(AppointmentReprogrammingBatchItemStatus.SKIPPED);
    const failedCount = count(AppointmentReprogrammingBatchItemStatus.FAILED);
    const excludedCount = count(AppointmentReprogrammingBatchItemStatus.EXCLUDED);
    const status =
      failedCount === 0
        ? AppointmentReprogrammingBatchStatus.COMPLETED
        : processedCount + skippedCount > 0
          ? AppointmentReprogrammingBatchStatus.PARTIAL
          : AppointmentReprogrammingBatchStatus.FAILED;
    await this.prisma.appointmentReprogrammingBatch.update({
      where: { id: batchId },
      data: {
        status,
        processedCount,
        skippedCount,
        failedCount,
        excludedCount,
        completedAt: new Date()
      }
    });
  }

  private async resolveBatchContext(actor: AuthUser, dto: PreviewMassReprogrammingDto) {
    assertBranchAccess(actor, dto.branchId);
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, organizationId: actor.organizationId, isActive: true },
      select: { id: true, timezone: true }
    });
    if (!branch) throw new BadRequestException("Sucursal inválida o inactiva");
    const professional = await this.prisma.professional.findFirst({
      where: {
        id: dto.professionalId,
        organizationId: actor.organizationId,
        isActive: true,
        branches: { some: { branchId: dto.branchId, status: "ACTIVE" } }
      },
      select: { id: true }
    });
    if (!professional) throw new BadRequestException("Profesional inválido para la sucursal");
    if (!dto.reasonCode.trim() || !dto.reasonText.trim()) {
      throw new BadRequestException("El motivo de reprogramación es obligatorio");
    }
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException("La fecha final no puede ser anterior a la fecha inicial");
    }
    const timezone = branch.timezone || "America/Mexico_City";
    const startAt = this.zonedLocalToUtc(dto.startDate, "00:00:00.000", timezone);
    const nextDate = new Date(`${dto.endDate}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const endAt = this.zonedLocalToUtc(nextDate.toISOString().slice(0, 10), "00:00:00.000", timezone);
    return { timezone, startAt, endAt };
  }

  private previewWhere(
    actor: AuthUser,
    dto: PreviewMassReprogrammingDto,
    startAt: Date,
    endAt: Date
  ): Prisma.AppointmentWhereInput {
    return {
      organizationId: actor.organizationId,
      branchId: dto.branchId,
      professionalId: dto.professionalId,
      patientId: { not: null },
      status: { in: MASS_REPROGRAMMING_ALLOWED_STATUSES },
      startAt: { gte: startAt, lt: endAt },
      reprogrammingCaseAsOriginal: null
    };
  }

  private async ensureBatchAccess(actor: AuthUser, batchId: string) {
    const batch = await this.prisma.appointmentReprogrammingBatch.findFirst({
      where: { id: batchId, organizationId: actor.organizationId, branchId: { in: actor.branchIds } },
      select: { id: true }
    });
    if (!batch) throw new NotFoundException("Lote de reprogramación no encontrado");
  }

  private async getCaseRecord(actor: AuthUser, caseId: string) {
    const item = await this.prisma.appointmentReprogrammingCase.findFirst({
      where: {
        id: caseId,
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds }
      },
      include: {
        originalAppointment: {
          include: {
            patient: true,
            professional: true,
            branch: true,
            chair: true
          }
        }
      }
    });
    if (!item) throw new NotFoundException("Caso de reprogramación no encontrado");
    return item;
  }

  private caseInclude() {
    return {
      branch: { select: { id: true, name: true, timezone: true } },
      originalProfessional: { select: { id: true, firstName: true, lastName: true } },
      assignedUser: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      originalAppointment: {
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          professional: { select: { id: true, firstName: true, lastName: true } },
          branch: { select: { id: true, name: true, timezone: true } },
          chair: { select: { id: true, name: true } },
          treatmentPlan: { select: { id: true, name: true, status: true } },
          appointmentNotes: {
            select: { id: true, note: true, isPrivate: true, createdAt: true },
            orderBy: { createdAt: "desc" as const }
          }
        }
      },
      newAppointment: {
        select: { id: true, startAt: true, endAt: true, status: true }
      },
      batch: { select: { id: true, reasonCode: true, reasonText: true, observation: true } }
    } satisfies Prisma.AppointmentReprogrammingCaseInclude;
  }

  private async financialSituations(
    actor: AuthUser,
    cases: Array<{ originalAppointment: { treatmentPlanId: string | null } }>
  ) {
    if (!this.hasPermission(actor, "agenda.reprogramming.view_financial_status")) return new Map();
    const treatmentPlanIds = cases.flatMap((item) =>
      item.originalAppointment.treatmentPlanId ? [item.originalAppointment.treatmentPlanId] : []
    );
    return this.financialSummaryService.calculateBatch(actor, treatmentPlanIds);
  }

  private presentCase<
    T extends {
      originalAppointment: { treatmentPlanId: string | null };
    }
  >(item: T, financialByPlan: Map<string, { currency: string; situation: object }>) {
    const treatmentPlanId = item.originalAppointment.treatmentPlanId;
    const summary = treatmentPlanId ? financialByPlan.get(treatmentPlanId) : undefined;
    return {
      ...item,
      financialSituation: summary
        ? {
            treatmentPlanId,
            currency: summary.currency,
            ...summary.situation
          }
        : null
    };
  }

  private async enqueueNotificationAfterCommit(
    actor: AuthUser,
    reprogrammingCase: Awaited<ReturnType<AppointmentReprogrammingService["getCaseRecord"]>>,
    newAppointmentId: string
  ) {
    try {
      await this.prisma.outboxEvent.create({
        data: {
          organizationId: actor.organizationId,
          aggregateType: "AppointmentReprogrammingCase",
          aggregateId: reprogrammingCase.id,
          eventType: "appointment.reprogrammed",
          idempotencyKey: `appointment-reprogrammed:${reprogrammingCase.id}:${newAppointmentId}`,
          payload: {
            caseId: reprogrammingCase.id,
            originalAppointmentId: reprogrammingCase.originalAppointmentId,
            newAppointmentId,
            patientId: reprogrammingCase.patientId,
            branchId: reprogrammingCase.branchId
          }
        }
      });
    } catch (error) {
      await this.prisma.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          branchId: reprogrammingCase.branchId,
          actorUserId: actor.id,
          entity: "AppointmentReprogrammingCase",
          entityId: reprogrammingCase.id,
          action: "reprogramming.notification.enqueue_failed",
          after: this.errorDetails(error)
        }
      });
    }
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    entity: string,
    entityId: string,
    action: string,
    after: Prisma.InputJsonValue,
    branchId?: string
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        branchId,
        actorUserId: actor.id,
        entity,
        entityId,
        action,
        after
      }
    });
  }

  private hasPermission(actor: AuthUser, permission: string) {
    return actor.permissions.includes("organization.manage_all") || actor.permissions.includes(permission);
  }

  private assertPermission(actor: AuthUser, permission: string) {
    if (!this.hasPermission(actor, permission)) throw new ForbiddenException("Permission denied");
  }

  private errorDetails(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === "object" && response && "code" in response && "message" in response) {
        return {
          code: String((response as { code: unknown }).code),
          message: String((response as { message: unknown }).message)
        };
      }
      return { code: `HTTP_${error.getStatus()}`, message: error.message };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return { code: error.code, message: "Error de persistencia al procesar la cita" };
    }
    return { code: "REPROGRAMMING_ITEM_FAILED", message: error instanceof Error ? error.message : "Error desconocido" };
  }

  private zonedLocalToUtc(date: string, time: string, timezone: string) {
    const utcGuess = new Date(`${date}T${time}Z`);
    if (Number.isNaN(utcGuess.getTime())) throw new BadRequestException("Fecha inválida");
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(utcGuess);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second")
    );
    return new Date(utcGuess.getTime() - (asUtc - utcGuess.getTime()));
  }
}
