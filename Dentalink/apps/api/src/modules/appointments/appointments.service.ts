import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentStatus, Prisma, ProfessionalBranchStatus } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { assertBranchAccess, branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { isAllowedSpecialtyName, resolveAllowedSpecialtyName, withAllowedSpecialtyName } from "../../common/utils/specialty-policy.util";
import { AppointmentQueryDto } from "./dto/appointment-query.dto";
import {
  AppointmentStatusReasonDto,
  AvailabilityQueryDto,
  CancelAppointmentDto,
  RescheduleAppointmentDto
} from "./dto/appointment-actions.dto";
import { CreateAppointmentNoteDto } from "./dto/appointment-note.dto";
import { CreateAppointmentReminderDto, UpdateAppointmentReminderDto } from "./dto/appointment-reminder.dto";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";

const FREE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_BY_CLINIC,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.RESCHEDULED
];

const APPOINTMENT_STATUS_TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  [AppointmentStatus.SCHEDULED]: [
    AppointmentStatus.PENDING_CONFIRMATION,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.ARRIVED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC
  ],
  [AppointmentStatus.PENDING_CONFIRMATION]: [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.ARRIVED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC
  ],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.ARRIVED,
    AppointmentStatus.WAITING_ROOM,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC
  ],
  [AppointmentStatus.ARRIVED]: [
    AppointmentStatus.WAITING_ROOM,
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC
  ],
  [AppointmentStatus.WAITING_ROOM]: [
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC
  ],
  [AppointmentStatus.IN_PROGRESS]: [AppointmentStatus.WAITING_ROOM, AppointmentStatus.COMPLETED],
  [AppointmentStatus.RESCHEDULED]: [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.PENDING_CONFIRMATION,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.ARRIVED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC
  ]
};

const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: "Agendada",
  [AppointmentStatus.CONFIRMED]: "Confirmada",
  [AppointmentStatus.PENDING_CONFIRMATION]: "Por confirmar",
  [AppointmentStatus.ARRIVED]: "Llegó a clínica",
  [AppointmentStatus.WAITING_ROOM]: "Sala de espera",
  [AppointmentStatus.IN_PROGRESS]: "En atención",
  [AppointmentStatus.COMPLETED]: "Atendida",
  [AppointmentStatus.CANCELLED_BY_PATIENT]: "Cancelada por paciente",
  [AppointmentStatus.CANCELLED_BY_CLINIC]: "Cancelada por clínica",
  [AppointmentStatus.NO_SHOW]: "No asistió",
  [AppointmentStatus.RESCHEDULED]: "Reagendada",
  [AppointmentStatus.BLOCKED]: "Bloqueada"
};

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: AppointmentQueryDto) {
    const { skip, take } = resolvePagination(query);
    const range = this.resolveRange(query);
    const where: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,
      ...(range ? { startAt: { lt: range.end }, endAt: { gt: range.start } } : {}),
      branchId: branchScope(actor, query.branchId),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(query.chairId ? { chairId: query.chairId } : {}),
      ...(query.status ? { status: query.status as AppointmentStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { reason: { contains: query.search, mode: "insensitive" } },
              { patient: { firstName: { contains: query.search, mode: "insensitive" } } },
              { patient: { lastName: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    const appointments = await this.prisma.appointment.findMany({
      where,
      skip,
      take,
      include: this.include(),
      orderBy: [{ startAt: "asc" }, { professionalId: "asc" }]
    });

    return appointments.map((appointment) => this.withCanonicalSpecialty(appointment));
  }

  async findOne(actor: AuthUser, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: { in: actor.branchIds } },
      include: {
        ...this.include(),
        statusHistory: {
          include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" }
        },
        appointmentNotes: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" }
        },
        reminders: { orderBy: { scheduledAt: "asc" } }
      }
    });

    if (!appointment) throw new NotFoundException("Appointment not found");
    return appointment;
  }

  async listReasonSuggestions(actor: AuthUser, specialtyId?: string) {
    const specialtyIds = specialtyId ? await this.resolveEquivalentSpecialtyIds(actor, specialtyId) : undefined;
    const rows = await this.prisma.appointment.groupBy({
      by: ["reason", "durationMinutes"],
      where: {
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        reason: { not: null },
        ...(specialtyIds ? { specialtyId: { in: specialtyIds } } : {})
      },
      _count: { _all: true }
    });

    const byReason = new Map<
      string,
      { id: string; name: string; durationMinutes: number; color: null; isActive: boolean; source: "history"; count: number }
    >();

    for (const row of rows) {
      const name = row.reason?.trim();
      if (!name) continue;

      const key = this.normalizeReasonKey(name);
      const current = byReason.get(key);
      if (!current || row._count._all > current.count) {
        byReason.set(key, {
          id: `history:${encodeURIComponent(key)}`,
          name,
          durationMinutes: row.durationMinutes,
          color: null,
          isActive: true,
          source: "history",
          count: row._count._all
        });
      }
    }

    return Array.from(byReason.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 24);
  }

  async create(actor: AuthUser, dto: CreateAppointmentDto) {
    assertBranchAccess(actor, dto.branchId);
    const status = (dto.status ?? "SCHEDULED") as AppointmentStatus;
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    const durationMinutes = dto.durationMinutes ?? this.diffMinutes(startAt, endAt);
    const chairId = dto.chairId ?? (await this.defaultChairForSchedule(actor, dto.branchId, dto.professionalId, startAt));

    this.validateDates(startAt, endAt, durationMinutes);
    await this.validateDurationSlotEnforcement(actor, dto.branchId, dto.professionalId, durationMinutes, startAt);
    await this.validateReferences(actor, {
      branchId: dto.branchId,
      patientId: dto.patientId,
      professionalId: dto.professionalId,
      chairId,
      specialtyId: dto.specialtyId,
      status,
      startAt
    });
    await this.enforceSchedulingRules(actor, {
      branchId: dto.branchId,
      professionalId: dto.professionalId,
      chairId,
      startAt,
      endAt,
      status
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          professionalId: dto.professionalId,
          chairId,
          specialtyId: dto.specialtyId,
          treatmentPlanId: dto.treatmentPlanId,
          title: dto.title.trim(),
          reason: dto.reason?.trim(),
          status,
          startAt,
          endAt,
          durationMinutes,
          notes: dto.notes?.trim(),
          createdById: actor.id,
          updatedById: actor.id
        }
      });

      await this.createStatusHistory(tx, appointment.id, null, status, actor.id, "create");
      await this.audit(tx, actor, appointment.id, "create", { status, startAt, endAt });
      return appointment;
    });

    return this.findOne(actor, created.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateAppointmentDto) {
    const current = await this.findOne(actor, id);
    const status = (dto.status ?? current.status) as AppointmentStatus;
    const branchId = dto.branchId ?? current.branchId;
    const professionalId = dto.professionalId ?? current.professionalId;
    const startAt = dto.startAt ? new Date(dto.startAt) : current.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : current.endAt;
    const durationMinutes = dto.durationMinutes ?? this.diffMinutes(startAt, endAt);
    const keepCurrentChair = current.chairId && branchId === current.branchId && professionalId === current.professionalId;
    const chairId =
      dto.chairId ??
      (keepCurrentChair ? current.chairId ?? undefined : await this.defaultChairForSchedule(actor, branchId, professionalId, startAt));
    assertBranchAccess(actor, branchId);
    if (status !== current.status && this.isCancellationStatus(status)) {
      throw new BadRequestException("Usa el flujo de cancelación para cancelar una cita");
    }
    if (status !== current.status && status === AppointmentStatus.RESCHEDULED) {
      throw new BadRequestException("Usa el flujo de reagendado para reagendar una cita");
    }
    this.assertStatusTransition(current.status, status);

    this.validateDates(startAt, endAt, durationMinutes);
    await this.validateDurationSlotEnforcement(actor, branchId, professionalId, durationMinutes, startAt);
    await this.validateReferences(actor, {
      branchId,
      patientId: dto.patientId ?? current.patientId ?? undefined,
      professionalId,
      chairId,
      specialtyId: dto.specialtyId ?? current.specialtyId ?? undefined,
      status,
      startAt
    });
    await this.enforceSchedulingRules(
      actor,
      {
        branchId,
        professionalId,
        chairId,
        startAt,
        endAt,
        status
      },
      id
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: {
          branchId: dto.branchId,
          patientId: dto.patientId,
          professionalId: dto.professionalId,
          chairId,
          specialtyId: dto.specialtyId,
          treatmentPlanId: dto.treatmentPlanId,
          title: dto.title?.trim(),
          reason: dto.reason?.trim(),
          status,
          startAt,
          endAt,
          durationMinutes,
          notes: dto.notes?.trim(),
          updatedById: actor.id
        }
      });

      if (status !== current.status) {
        await this.createStatusHistory(tx, id, current.status, status, actor.id, "manual update");
      }

      await this.audit(tx, actor, id, "update", { status, startAt, endAt });
    });

    return this.findOne(actor, id);
  }

  async remove(actor: AuthUser, id: string) {
    return this.changeStatus(actor, id, AppointmentStatus.CANCELLED_BY_CLINIC, "deleted via API", {
      cancellationReason: "Cancelled by clinic"
    });
  }

  async confirm(actor: AuthUser, id: string) {
    return this.changeStatus(actor, id, AppointmentStatus.CONFIRMED, "confirmed");
  }

  async cancel(actor: AuthUser, id: string, dto: CancelAppointmentDto) {
    const status = dto.cancelledBy === "patient" ? AppointmentStatus.CANCELLED_BY_PATIENT : AppointmentStatus.CANCELLED_BY_CLINIC;
    return this.changeStatus(actor, id, status, dto.reason, { cancellationReason: dto.reason });
  }

  async reschedule(actor: AuthUser, id: string, dto: RescheduleAppointmentDto) {
    const current = await this.findOne(actor, id);
    const branchId = dto.branchId ?? current.branchId;
    const professionalId = dto.professionalId ?? current.professionalId;
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    const durationMinutes = dto.durationMinutes ?? this.diffMinutes(startAt, endAt);
    const keepCurrentChair = current.chairId && branchId === current.branchId && professionalId === current.professionalId;
    const chairId =
      dto.chairId ??
      (keepCurrentChair ? current.chairId ?? undefined : await this.defaultChairForSchedule(actor, branchId, professionalId, startAt));
    const specialtyId = dto.specialtyId ?? current.specialtyId ?? undefined;

    assertBranchAccess(actor, branchId);
    this.assertStatusTransition(current.status, AppointmentStatus.RESCHEDULED);
    this.validateDates(startAt, endAt, durationMinutes);
    await this.validateDurationSlotEnforcement(actor, branchId, professionalId, durationMinutes, startAt);
    await this.validateReferences(actor, {
      branchId,
      patientId: current.patientId ?? undefined,
      professionalId,
      chairId,
      specialtyId,
      status: AppointmentStatus.SCHEDULED,
      startAt
    });
    await this.enforceSchedulingRules(
      actor,
      {
        branchId,
        professionalId,
        chairId,
        startAt,
        endAt,
        status: AppointmentStatus.SCHEDULED
      },
      id
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: {
          branchId,
          professionalId,
          chairId: chairId ?? null,
          specialtyId,
          startAt,
          endAt,
          durationMinutes,
          status: AppointmentStatus.RESCHEDULED,
          updatedById: actor.id
        }
      });
      await this.createStatusHistory(tx, id, current.status, AppointmentStatus.RESCHEDULED, actor.id, dto.reason ?? "rescheduled");
      await this.audit(tx, actor, id, "reschedule", { startAt, endAt });
    });

    return this.findOne(actor, id);
  }

  async arrive(actor: AuthUser, id: string, dto: AppointmentStatusReasonDto) {
    return this.changeStatus(actor, id, AppointmentStatus.ARRIVED, dto.reason ?? "arrived");
  }

  async start(actor: AuthUser, id: string, dto: AppointmentStatusReasonDto) {
    return this.changeStatus(actor, id, AppointmentStatus.IN_PROGRESS, dto.reason ?? "started");
  }

  async complete(actor: AuthUser, id: string, dto: AppointmentStatusReasonDto) {
    return this.changeStatus(actor, id, AppointmentStatus.COMPLETED, dto.reason ?? "completed");
  }

  async noShow(actor: AuthUser, id: string, dto: AppointmentStatusReasonDto) {
    return this.changeStatus(actor, id, AppointmentStatus.NO_SHOW, dto.reason ?? "no show");
  }

  async waitingRoom(actor: AuthUser, id: string, dto: AppointmentStatusReasonDto) {
    return this.changeStatus(actor, id, AppointmentStatus.WAITING_ROOM, dto.reason ?? "waiting room");
  }

  async availability(actor: AuthUser, query: AvailabilityQueryDto) {
    assertBranchAccess(actor, query.branchId);
    const date = this.parseClinicDate(query.date);
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Invalid date");

    const agendaConfig = await this.resolveAgendaConfig(actor, query.branchId, query.professionalId, date);
    const slotMinutes = agendaConfig.agendaSlotMinutes;
    const duration = query.durationMinutes ? Number(query.durationMinutes) : agendaConfig.defaultAppointmentDurationMinutes;
    if (!Number.isInteger(duration) || duration < 5) throw new BadRequestException("Invalid durationMinutes");
    if (duration % slotMinutes !== 0) {
      throw new BadRequestException(`durationMinutes must be a multiple of slot granularity (${slotMinutes} minutes)`);
    }

    await this.validateReferences(actor, {
      branchId: query.branchId,
      professionalId: query.professionalId,
      chairId: query.chairId,
      status: AppointmentStatus.SCHEDULED,
      requirePatient: false,
      startAt: date
    });

    const dayOfWeek = date.getDay();
    const schedule = await this.prisma.professionalSchedule.findFirst({
      where: {
        professionalId: query.professionalId,
        branchId: query.branchId,
        dayOfWeek,
        isActive: true,
        professional: { organizationId: actor.organizationId }
      }
    });

    if (!schedule) return { slots: [] };

    const scheduleStart = this.atTime(date, schedule.startTime);
    const scheduleEnd = this.atTime(date, schedule.endTime);
    const branchStart = this.atTime(date, `${String(agendaConfig.agendaStartHour).padStart(2, "0")}:00`);
    const branchEnd = this.atTime(date, `${String(agendaConfig.agendaEndHour).padStart(2, "0")}:00`);
    const dayStart = new Date(Math.max(scheduleStart.getTime(), branchStart.getTime()));
    const dayEnd = new Date(Math.min(scheduleEnd.getTime(), branchEnd.getTime()));
    if (dayStart >= dayEnd) return { slots: [] };
    const busy = await this.busyAppointments(actor, {
      professionalId: query.professionalId,
      chairId: query.chairId,
      startAt: dayStart,
      endAt: dayEnd
    });

    const slots: { startAt: Date; endAt: Date; available: boolean }[] = [];
    for (let cursor = new Date(dayStart); cursor.getTime() + duration * 60000 <= dayEnd.getTime(); cursor = new Date(cursor.getTime() + slotMinutes * 60000)) {
      const endAt = new Date(cursor.getTime() + duration * 60000);
      const inBreak = this.isInsideBreak(cursor, endAt, date, schedule.breakStartTime, schedule.breakEndTime);
      const overlaps = busy.some((item) => this.overlaps(cursor, endAt, item.startAt, item.endAt));
      slots.push({ startAt: new Date(cursor), endAt, available: !inBreak && !overlaps });
    }

    return { slots };
  }

  async listNotes(actor: AuthUser, id: string) {
    await this.ensureAppointmentAccess(actor, id);

    return this.prisma.appointmentNote.findMany({
      where: { appointmentId: id },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  async addNote(actor: AuthUser, id: string, dto: CreateAppointmentNoteDto) {
    await this.ensureAppointmentAccess(actor, id);
    const noteText = dto.note.trim();
    if (!noteText) throw new BadRequestException("note is required");

    const created = await this.prisma.$transaction(async (tx) => {
      const note = await tx.appointmentNote.create({
        data: {
          appointmentId: id,
          userId: actor.id,
          note: noteText,
          isPrivate: dto.isPrivate ?? false
        },
        include: { user: { select: { id: true, firstName: true, lastName: true } } }
      });

      await this.audit(tx, actor, id, "add_note", { noteId: note.id, isPrivate: note.isPrivate });
      return note;
    });

    return created;
  }

  async listReminders(actor: AuthUser, id: string) {
    await this.ensureAppointmentAccess(actor, id);

    return this.prisma.appointmentReminder.findMany({
      where: { appointmentId: id },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }]
    });
  }

  async createReminder(actor: AuthUser, id: string, dto: CreateAppointmentReminderDto) {
    await this.ensureAppointmentAccess(actor, id);
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException("Invalid scheduledAt");

    const created = await this.prisma.$transaction(async (tx) => {
      const reminder = await tx.appointmentReminder.create({
        data: {
          appointmentId: id,
          channel: dto.channel,
          scheduledAt,
          status: dto.status ?? "PENDING"
        }
      });

      await this.audit(tx, actor, id, "create_reminder", {
        reminderId: reminder.id,
        channel: reminder.channel,
        scheduledAt: reminder.scheduledAt.toISOString(),
        status: reminder.status
      });
      return reminder;
    });

    return created;
  }

  async updateReminder(actor: AuthUser, id: string, reminderId: string, dto: UpdateAppointmentReminderDto) {
    await this.ensureAppointmentAccess(actor, id);
    const current = await this.prisma.appointmentReminder.findFirst({ where: { id: reminderId, appointmentId: id } });
    if (!current) throw new NotFoundException("Appointment reminder not found");

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : undefined;
    const sentAt = dto.sentAt ? new Date(dto.sentAt) : dto.status === "SENT" && !current.sentAt ? new Date() : undefined;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) throw new BadRequestException("Invalid scheduledAt");
    if (sentAt && Number.isNaN(sentAt.getTime())) throw new BadRequestException("Invalid sentAt");

    const updated = await this.prisma.$transaction(async (tx) => {
      const reminder = await tx.appointmentReminder.update({
        where: { id: reminderId },
        data: {
          channel: dto.channel,
          scheduledAt,
          status: dto.status,
          sentAt,
          errorMessage: dto.errorMessage
        }
      });

      await this.audit(tx, actor, id, "update_reminder", {
        reminderId: reminder.id,
        channel: reminder.channel,
        scheduledAt: reminder.scheduledAt.toISOString(),
        status: reminder.status,
        sentAt: reminder.sentAt?.toISOString() ?? null
      });
      return reminder;
    });

    return updated;
  }

  private async changeStatus(
    actor: AuthUser,
    id: string,
    newStatus: AppointmentStatus,
    reason: string,
    extra?: Pick<Prisma.AppointmentUpdateInput, "cancellationReason">
  ) {
    const current = await this.findOne(actor, id);
    if (current.status === newStatus) return current;
    this.assertStatusTransition(current.status, newStatus);
    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: {
          status: newStatus,
          updatedById: actor.id,
          ...extra
        }
      });
      await this.createStatusHistory(tx, id, current.status, newStatus, actor.id, reason);
      await this.audit(tx, actor, id, "status_change", { previousStatus: current.status, newStatus, reason });
    });
    return this.findOne(actor, id);
  }

  private assertStatusTransition(currentStatus: AppointmentStatus, newStatus: AppointmentStatus) {
    if (currentStatus === newStatus) return;

    const allowedStatuses = APPOINTMENT_STATUS_TRANSITIONS[currentStatus] ?? [];
    if (allowedStatuses.includes(newStatus)) return;

    const from = APPOINTMENT_STATUS_LABELS[currentStatus] ?? currentStatus;
    const to = APPOINTMENT_STATUS_LABELS[newStatus] ?? newStatus;
    throw new BadRequestException(`Cambio de estado inválido: ${from} no puede pasar a ${to}`);
  }

  private isCancellationStatus(status: AppointmentStatus) {
    return status === AppointmentStatus.CANCELLED_BY_PATIENT || status === AppointmentStatus.CANCELLED_BY_CLINIC;
  }

  private async ensureAppointmentAccess(actor: AuthUser, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: { in: actor.branchIds } },
      select: { id: true }
    });

    if (!appointment) throw new NotFoundException("Appointment not found");
    return appointment;
  }

  private async validateReferences(
    actor: AuthUser,
    input: {
      branchId: string;
      patientId?: string;
      professionalId: string;
      chairId?: string;
      specialtyId?: string;
      status: AppointmentStatus;
      requirePatient?: boolean;
      startAt?: Date;
    }
  ) {
    if (input.requirePatient !== false && input.status !== AppointmentStatus.BLOCKED && !input.patientId) {
      throw new BadRequestException("patientId is required for clinical appointments");
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, organizationId: actor.organizationId, status: "ACTIVE", deletedAt: null }
    });
    if (!branch) throw new BadRequestException("Invalid branchId");

    const professional = await this.prisma.professional.findFirst({
      where: {
        id: input.professionalId,
        organizationId: actor.organizationId,
        isActive: true,
        branches: {
          some: {
            branchId: input.branchId,
            status: ProfessionalBranchStatus.ACTIVE,
            ...(input.startAt
              ? {
                  startsAt: { lte: input.startAt },
                  OR: [{ endsAt: null }, { endsAt: { gt: input.startAt } }]
                }
              : {})
          }
        }
      }
    });
    if (!professional) throw new BadRequestException("Invalid professionalId for selected branch");

    if (input.patientId) {
      const patient = await this.prisma.patient.findFirst({
        where: { id: input.patientId, organizationId: actor.organizationId, branchId: input.branchId, deletedAt: null }
      });
      if (!patient) throw new BadRequestException("Invalid patientId for selected branch");
    }

    if (input.chairId) {
      const chair = await this.prisma.chair.findFirst({
        where: { id: input.chairId, organizationId: actor.organizationId, branchId: input.branchId, isActive: true }
      });
      if (!chair) throw new BadRequestException("Invalid chairId for selected branch");
    }

    if (input.specialtyId) {
      const specialty = await this.prisma.specialty.findFirst({
        where: { id: input.specialtyId, organizationId: actor.organizationId }
      });
      if (!specialty || !isAllowedSpecialtyName(specialty.name)) throw new BadRequestException("Invalid specialtyId");
    }
  }

  private async enforceSchedulingRules(
    actor: AuthUser,
    input: {
      branchId: string;
      professionalId: string;
      chairId?: string;
      startAt: Date;
      endAt: Date;
      status: AppointmentStatus;
    },
    excludeId?: string
  ) {
    if (FREE_STATUSES.includes(input.status)) return;

    const canOverbook = actor.permissions.includes("appointments.overbook") || actor.permissions.includes("system.manage_all");
    if (!canOverbook) {
      await this.ensureInsideProfessionalSchedule(actor, input);
      const professionalOverlap = await this.prisma.appointment.findFirst({
        where: {
          professionalId: input.professionalId,
          organizationId: actor.organizationId,
          status: { notIn: FREE_STATUSES },
          ...(excludeId ? { id: { not: excludeId } } : {}),
          startAt: { lt: input.endAt },
          endAt: { gt: input.startAt }
        }
      });
      if (professionalOverlap) throw new BadRequestException("Overlapping appointment for professional");
    }

    if (input.chairId) {
      const chairOverlap = await this.prisma.appointment.findFirst({
        where: {
          chairId: input.chairId,
          organizationId: actor.organizationId,
          status: { notIn: FREE_STATUSES },
          ...(excludeId ? { id: { not: excludeId } } : {}),
          startAt: { lt: input.endAt },
          endAt: { gt: input.startAt }
        }
      });
      if (chairOverlap) throw new BadRequestException("Overlapping appointment for chair");
    }
  }

  private async ensureInsideProfessionalSchedule(
    actor: AuthUser,
    input: { branchId: string; professionalId: string; startAt: Date; endAt: Date }
  ) {
    if (input.startAt.toDateString() !== input.endAt.toDateString()) {
      throw new BadRequestException("Appointment must start and end on the same day");
    }

    const schedule = await this.prisma.professionalSchedule.findFirst({
      where: {
        professionalId: input.professionalId,
        branchId: input.branchId,
        dayOfWeek: input.startAt.getDay(),
        isActive: true,
        professional: { organizationId: actor.organizationId }
      }
    });
    if (!schedule) throw new BadRequestException("Professional has no active schedule for this day and branch");

    const scheduleStart = this.atTime(input.startAt, schedule.startTime);
    const scheduleEnd = this.atTime(input.startAt, schedule.endTime);
    const agendaConfig = await this.resolveAgendaConfig(actor, input.branchId, input.professionalId, input.startAt);
    const branchStart = this.atTime(input.startAt, `${String(agendaConfig.agendaStartHour).padStart(2, "0")}:00`);
    const branchEnd = this.atTime(input.startAt, `${String(agendaConfig.agendaEndHour).padStart(2, "0")}:00`);
    if (input.startAt < branchStart || input.endAt > branchEnd) {
      throw new BadRequestException("Appointment is outside branch agenda hours");
    }

    if (input.startAt < scheduleStart || input.endAt > scheduleEnd) {
      throw new BadRequestException("Appointment is outside professional schedule");
    }

    if (this.isInsideBreak(input.startAt, input.endAt, input.startAt, schedule.breakStartTime, schedule.breakEndTime)) {
      throw new BadRequestException("Appointment overlaps professional break");
    }

    const minutesFromScheduleStart = this.diffMinutes(scheduleStart, input.startAt);
    if (minutesFromScheduleStart % agendaConfig.agendaSlotMinutes !== 0) {
      throw new BadRequestException(`Appointment startAt must align to professional slot minutes (${agendaConfig.agendaSlotMinutes} minutes)`);
    }
  }

  private async busyAppointments(
    actor: AuthUser,
    input: { professionalId: string; chairId?: string; startAt: Date; endAt: Date }
  ) {
    return this.prisma.appointment.findMany({
      where: {
        organizationId: actor.organizationId,
        status: { notIn: FREE_STATUSES },
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt },
        OR: [{ professionalId: input.professionalId }, ...(input.chairId ? [{ chairId: input.chairId }] : [])]
      },
      select: { startAt: true, endAt: true }
    });
  }

  private async createStatusHistory(
    tx: Prisma.TransactionClient,
    appointmentId: string,
    previousStatus: AppointmentStatus | null,
    newStatus: AppointmentStatus,
    changedById: string,
    reason?: string
  ) {
    await tx.appointmentStatusHistory.create({
      data: { appointmentId, previousStatus, newStatus, changedById, reason }
    });
  }

  private async audit(tx: Prisma.TransactionClient, actor: AuthUser, entityId: string, action: string, after: Prisma.InputJsonValue) {
    await tx.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "Appointment",
        entityId,
        action,
        after
      }
    });
  }

  private validateDates(startAt: Date, endAt: Date, durationMinutes: number) {
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) throw new BadRequestException("Invalid appointment date");
    if (startAt >= endAt) throw new BadRequestException("startAt must be before endAt");
    if (durationMinutes !== this.diffMinutes(startAt, endAt)) {
      throw new BadRequestException("durationMinutes must match startAt/endAt");
    }
  }

  private resolveRange(query: AppointmentQueryDto) {
    if (query.patientId && !query.start && !query.end && !query.date && !query.view) return null;
    if (query.start && query.end) return { start: new Date(query.start), end: new Date(query.end) };

    const base = query.date ? this.parseClinicDate(query.date) : new Date();
    if (Number.isNaN(base.getTime())) throw new BadRequestException("Invalid date");

    const start = new Date(base);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    const view = query.view ?? "day";
    if (view === "week") end.setDate(start.getDate() + 7);
    else if (view === "month") end.setMonth(start.getMonth() + 1);
    else end.setDate(start.getDate() + 1);
    return { start, end };
  }

  private include() {
    return {
      branch: true,
      patient: true,
      professional: true,
      chair: true,
      specialty: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { appointmentNotes: true } }
    } satisfies Prisma.AppointmentInclude;
  }

  private withCanonicalSpecialty<T extends { specialty?: { name: string } | null }>(appointment: T): T {
    if (!appointment.specialty) return appointment;
    return {
      ...appointment,
      specialty: withAllowedSpecialtyName(appointment.specialty)
    } as T;
  }

  private async resolveEquivalentSpecialtyIds(actor: AuthUser, specialtyId: string) {
    const selected = await this.prisma.specialty.findFirst({
      where: { id: specialtyId, organizationId: actor.organizationId }
    });
    if (!selected) throw new BadRequestException("Invalid specialtyId");

    const selectedName = resolveAllowedSpecialtyName(selected.name);
    if (!selectedName) throw new BadRequestException("Invalid specialtyId");

    const specialties = await this.prisma.specialty.findMany({
      where: { organizationId: actor.organizationId },
      select: { id: true, name: true }
    });

    return specialties
      .filter((specialty) => resolveAllowedSpecialtyName(specialty.name) === selectedName)
      .map((specialty) => specialty.id);
  }

  private normalizeReasonKey(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  private async defaultChairForSchedule(actor: AuthUser, branchId: string, professionalId: string, startAt: Date) {
    const schedule = await this.prisma.professionalSchedule.findFirst({
      where: {
        professionalId,
        branchId,
        dayOfWeek: startAt.getDay(),
        isActive: true,
        professional: { organizationId: actor.organizationId }
      },
      select: { chairId: true }
    });

    return schedule?.chairId ?? undefined;
  }

  private diffMinutes(startAt: Date, endAt: Date) {
    return Math.round((endAt.getTime() - startAt.getTime()) / 60000);
  }

  private atTime(date: Date, value: string) {
    const [hours, minutes] = value.split(":").map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  private parseClinicDate(value: string) {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!dateOnly) return new Date(value);
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
  }

  private isInsideBreak(startAt: Date, endAt: Date, date: Date, breakStartTime?: string | null, breakEndTime?: string | null) {
    if (!breakStartTime || !breakEndTime) return false;
    return this.overlaps(startAt, endAt, this.atTime(date, breakStartTime), this.atTime(date, breakEndTime));
  }

  private overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
    return startA < endB && endA > startB;
  }

  private async validateDurationSlotEnforcement(
    actor: AuthUser,
    branchId: string,
    professionalId: string,
    durationMinutes: number,
    at?: Date
  ) {
    const agendaConfig = await this.resolveAgendaConfig(actor, branchId, professionalId, at);
    if (durationMinutes % agendaConfig.agendaSlotMinutes !== 0) {
      throw new BadRequestException(`Appointment duration must be a multiple of professional slot minutes (${agendaConfig.agendaSlotMinutes} minutes)`);
    }
  }

  private async resolveAgendaConfig(actor: AuthUser, branchId: string, professionalId: string, at = new Date()) {
    assertBranchAccess(actor, branchId);

    const assignment = await this.prisma.professionalBranch.findFirst({
      where: {
        professionalId,
        branchId,
        status: ProfessionalBranchStatus.ACTIVE,
        startsAt: { lte: at },
        OR: [{ endsAt: null }, { endsAt: { gt: at } }],
        professional: { organizationId: actor.organizationId, isActive: true },
        branch: { organizationId: actor.organizationId, status: "ACTIVE", deletedAt: null }
      },
      select: {
        agendaSlotMinutes: true,
        defaultAppointmentDurationMinutes: true,
        branch: { select: { agendaSlotMinutes: true, agendaStartHour: true, agendaEndHour: true } }
      }
    });

    if (!assignment) throw new BadRequestException("Invalid professionalId for selected branch");

    const agendaSlotMinutes = assignment.agendaSlotMinutes ?? assignment.branch.agendaSlotMinutes;
    return {
      agendaSlotMinutes,
      defaultAppointmentDurationMinutes: assignment.defaultAppointmentDurationMinutes ?? agendaSlotMinutes,
      agendaStartHour: assignment.branch.agendaStartHour,
      agendaEndHour: assignment.branch.agendaEndHour
    };
  }
}
