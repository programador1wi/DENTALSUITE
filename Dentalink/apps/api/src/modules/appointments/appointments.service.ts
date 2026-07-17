import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { AppointmentStatus, AttendanceMode, Prisma, ProfessionalBranchStatus, TreatmentPlanStatus } from "@prisma/client";
import { EmailService, AppointmentEmailData } from "../notifications/email.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
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
import { CreateAppointmentDto, CreateAppointmentsBatchDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";

const INITIAL_TREATMENT_PLAN_NAME = "Plan de Tratamiento Inicial";
const PATIENT_DAILY_LIMIT_MESSAGE =
  'Sólo puede agendar una cita por día para el mismo paciente. Si desea darle mas duración, hágalo desde el menu "Duración" al lado izquierdo de esta agenda.';

const FREE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_BY_CLINIC,
  AppointmentStatus.CANCELLED_CONFLICT,
  AppointmentStatus.CANCELLED_RESCHEDULED,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.RESCHEDULED
];

const CANCELLATION_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_BY_CLINIC,
  AppointmentStatus.CANCELLED_CONFLICT,
  AppointmentStatus.CANCELLED_RESCHEDULED
];

const APPOINTMENT_STATUS_TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  [AppointmentStatus.SCHEDULED]: [
    AppointmentStatus.PENDING_CONFIRMATION,
    AppointmentStatus.NOTIFIED_BY_WHATSAPP,
    AppointmentStatus.NOTIFIED_BY_EMAIL,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CONFIRMED_BY_WHATSAPP,
    AppointmentStatus.CONFIRMED_BY_PHONE,
    AppointmentStatus.CONFIRMED_BY_EMAIL,
    AppointmentStatus.ARRIVED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_CONFLICT,
    AppointmentStatus.CANCELLED_RESCHEDULED
  ],
  [AppointmentStatus.PENDING_CONFIRMATION]: [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.NOTIFIED_BY_WHATSAPP,
    AppointmentStatus.NOTIFIED_BY_EMAIL,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CONFIRMED_BY_WHATSAPP,
    AppointmentStatus.CONFIRMED_BY_PHONE,
    AppointmentStatus.CONFIRMED_BY_EMAIL,
    AppointmentStatus.ARRIVED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_CONFLICT,
    AppointmentStatus.CANCELLED_RESCHEDULED
  ],
  [AppointmentStatus.NOTIFIED_BY_WHATSAPP]: [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.PENDING_CONFIRMATION,
    AppointmentStatus.NOTIFIED_BY_EMAIL,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CONFIRMED_BY_WHATSAPP,
    AppointmentStatus.CONFIRMED_BY_PHONE,
    AppointmentStatus.CONFIRMED_BY_EMAIL,
    AppointmentStatus.ARRIVED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_CONFLICT,
    AppointmentStatus.CANCELLED_RESCHEDULED
  ],
  [AppointmentStatus.NOTIFIED_BY_EMAIL]: [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.PENDING_CONFIRMATION,
    AppointmentStatus.NOTIFIED_BY_WHATSAPP,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CONFIRMED_BY_WHATSAPP,
    AppointmentStatus.CONFIRMED_BY_PHONE,
    AppointmentStatus.CONFIRMED_BY_EMAIL,
    AppointmentStatus.ARRIVED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_CONFLICT,
    AppointmentStatus.CANCELLED_RESCHEDULED
  ],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.ARRIVED,
    AppointmentStatus.WAITING_ROOM,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_CONFLICT,
    AppointmentStatus.CANCELLED_RESCHEDULED
  ],
  [AppointmentStatus.CONFIRMED_BY_WHATSAPP]: [
    AppointmentStatus.ARRIVED,
    AppointmentStatus.WAITING_ROOM,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_CONFLICT,
    AppointmentStatus.CANCELLED_RESCHEDULED
  ],
  [AppointmentStatus.CONFIRMED_BY_PHONE]: [
    AppointmentStatus.ARRIVED,
    AppointmentStatus.WAITING_ROOM,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_CONFLICT,
    AppointmentStatus.CANCELLED_RESCHEDULED
  ],
  [AppointmentStatus.CONFIRMED_BY_EMAIL]: [
    AppointmentStatus.ARRIVED,
    AppointmentStatus.WAITING_ROOM,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_CONFLICT,
    AppointmentStatus.CANCELLED_RESCHEDULED
  ],
  [AppointmentStatus.ARRIVED]: [
    AppointmentStatus.WAITING_ROOM,
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_CONFLICT,
    AppointmentStatus.CANCELLED_RESCHEDULED
  ],
  [AppointmentStatus.WAITING_ROOM]: [
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_CONFLICT,
    AppointmentStatus.CANCELLED_RESCHEDULED
  ],
  [AppointmentStatus.IN_PROGRESS]: [AppointmentStatus.WAITING_ROOM, AppointmentStatus.COMPLETED],
  [AppointmentStatus.RESCHEDULED]: [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.PENDING_CONFIRMATION,
    AppointmentStatus.NOTIFIED_BY_WHATSAPP,
    AppointmentStatus.NOTIFIED_BY_EMAIL,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CONFIRMED_BY_WHATSAPP,
    AppointmentStatus.CONFIRMED_BY_PHONE,
    AppointmentStatus.CONFIRMED_BY_EMAIL,
    AppointmentStatus.ARRIVED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_CONFLICT,
    AppointmentStatus.CANCELLED_RESCHEDULED
  ]
};

const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: "Agendada",
  [AppointmentStatus.CONFIRMED]: "Confirmada",
  [AppointmentStatus.CONFIRMED_BY_WHATSAPP]: "Confirmada por WhatsApp",
  [AppointmentStatus.CONFIRMED_BY_PHONE]: "Confirmada por teléfono",
  [AppointmentStatus.CONFIRMED_BY_EMAIL]: "Confirmada por email",
  [AppointmentStatus.PENDING_CONFIRMATION]: "Por confirmar",
  [AppointmentStatus.NOTIFIED_BY_WHATSAPP]: "Notificada por WhatsApp",
  [AppointmentStatus.NOTIFIED_BY_EMAIL]: "Notificada por email",
  [AppointmentStatus.ARRIVED]: "Llegó a clínica",
  [AppointmentStatus.WAITING_ROOM]: "Sala de espera",
  [AppointmentStatus.IN_PROGRESS]: "En atención",
  [AppointmentStatus.COMPLETED]: "Atendida",
  [AppointmentStatus.CANCELLED_BY_PATIENT]: "Cancelada por paciente",
  [AppointmentStatus.CANCELLED_BY_CLINIC]: "Cancelada por clínica",
  [AppointmentStatus.CANCELLED_CONFLICT]: "Cancelada conflicto",
  [AppointmentStatus.CANCELLED_RESCHEDULED]: "Anulada reprogramación",
  [AppointmentStatus.NO_SHOW]: "No asistió",
  [AppointmentStatus.RESCHEDULED]: "Reagendada",
  [AppointmentStatus.BLOCKED]: "Bloqueada"
};

type PreparedAppointmentCreate = {
  dto: CreateAppointmentDto;
  status: AppointmentStatus;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  chairId?: string;
  chairIndex: number;
  isOverbooking: boolean;
  attendanceMode: AttendanceMode;
};

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async dispatchEmailNotification(appointmentId: string, type: "SCHEDULED" | "CONFIRMATION") {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        professional: true,
        organization: true,
        branch: { include: { brand: true } }
      }
    });
    
    if (!appointment) {
      if (type === "CONFIRMATION") throw new NotFoundException("Appointment not found");
      return;
    }

    const patientEmail = appointment.patient?.email?.trim();
    if (!appointment.patient || !patientEmail) {
      if (type === "CONFIRMATION") throw new BadRequestException("El paciente no tiene correo electronico registrado");
      return;
    }

    const tz = appointment.branch.timezone || "America/Mexico_City";
    const organization = appointment.organization;
    const branchBrand = appointment.branch.brand;
    const data: AppointmentEmailData = {
      patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim(),
      professionalName: `${appointment.professional.firstName} ${appointment.professional.lastName}`.trim(),
      dateStr: new Intl.DateTimeFormat("es-MX", { month: "long", day: "numeric", timeZone: tz }).format(appointment.startAt),

      timeStr: new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(appointment.startAt) + " hrs",
      address: [appointment.branch.address, appointment.branch.city, appointment.branch.state].filter(Boolean).join(", "),
      clinicPhone: appointment.branch.phone || branchBrand?.phone || organization?.phone || "+525555555555",
      brandName: branchBrand?.name || organization?.name || "Dental+",
      logoUrl: branchBrand?.logoUrl || organization?.logoUrl || undefined,
      primaryColor: branchBrand?.primaryColor || undefined,
      replyToEmail:
        appointment.branch.replyToEmail ||
        appointment.branch.email ||
        branchBrand?.replyToEmail ||
        branchBrand?.senderEmail ||
        organization?.email ||
        undefined
    };

    if (type === "SCHEDULED") {
      const secret = this.configService.get<string>("JWT_ACCESS_SECRET") || "secret";
      const frontendUrl = this.resolveConfirmationFrontendUrl();
      const expSeconds = Math.floor(appointment.startAt.getTime() / 1000) - Math.floor(Date.now() / 1000);
      
      if (expSeconds > 0) {
        const token = this.jwtService.sign(
          { sub: appointment.id, purpose: "PATIENT_PROFILE_UPDATE" }, 
          { secret, expiresIn: expSeconds }
        );
        data.completeProfileUrl = this.buildCompleteProfileUrl(frontendUrl, appointment.id, token);
      }

      await this.emailService.sendAppointmentScheduled(patientEmail, data);
    } else if (type === "CONFIRMATION") {
      const secret = this.configService.get<string>("JWT_ACCESS_SECRET") || "secret";
      const frontendUrl = this.resolveConfirmationFrontendUrl();
      if (Math.floor(appointment.startAt.getTime() / 1000) - Math.floor(Date.now() / 1000) <= 0) {
        throw new BadRequestException("No se puede enviar confirmacion por email para una cita pasada");
      }
      const expSeconds = Math.floor(appointment.startAt.getTime() / 1000) - Math.floor(Date.now() / 1000);
      
      if (expSeconds <= 0) return; // Ya pasó la cita
      
      const token = this.jwtService.sign({ sub: appointment.id }, { secret, expiresIn: expSeconds });
      data.confirmUrl = this.buildConfirmationUrl(frontendUrl, appointment.id, token);
      await this.emailService.sendAppointmentConfirmationRequired(patientEmail, data);
    }
  }

  private resolveConfirmationFrontendUrl() {
    const value = this.configService.get<string>("FRONTEND_URL")?.trim();
    if (!value) {
      throw new ServiceUnavailableException("FRONTEND_URL no esta configurado para generar enlaces de confirmacion");
    }

    try {
      return new URL(value);
    } catch {
      throw new ServiceUnavailableException("FRONTEND_URL no es una URL valida");
    }
  }

  private buildConfirmationUrl(frontendUrl: URL, appointmentId: string, token: string) {
    const url = new URL("/confirm-appointment", frontendUrl);
    url.searchParams.set("id", appointmentId);
    url.searchParams.set("token", token);
    return url.toString();
  }

  private buildCompleteProfileUrl(frontendUrl: URL, appointmentId: string, token: string) {
    const url = new URL("/complete-patient-profile", frontendUrl);
    url.searchParams.set("id", appointmentId);
    url.searchParams.set("token", token);
    return url.toString();
  }

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
      ...(query.chairIndex ? { chairIndex: Number(query.chairIndex) } : {}),
      ...(query.overbooking !== undefined ? { isOverbooking: query.overbooking === "true" } : {}),
      ...(query.status
        ? { status: query.status as AppointmentStatus }
        : query.patientId
          ? {}
          : { status: { notIn: [
              AppointmentStatus.CANCELLED_BY_PATIENT,
              AppointmentStatus.CANCELLED_BY_CLINIC,
              AppointmentStatus.CANCELLED_CONFLICT,
              AppointmentStatus.CANCELLED_RESCHEDULED
            ] } }),
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

    const mapped = appointments.map((appointment) => this.withCanonicalSpecialty(appointment));
    return this.attachPatientBalances(actor, mapped);
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
    const mapped = this.withCanonicalSpecialty(appointment);
    const [result] = await this.attachPatientBalances(actor, [mapped]);
    return result;
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
    const prepared = await this.prepareAppointmentForCreate(actor, dto);
    await this.enforcePatientDailyLimit(actor, this.toPatientDailyLimitInput(prepared));

    const created = await this.prisma.$transaction(async (tx) => {
      return this.createAppointmentInTransaction(tx, actor, prepared, dto.treatmentPlanId);
    });

    await this.dispatchEmailNotification(created.id, "SCHEDULED");

    return this.findOne(actor, created.id);
  }

  async createBatch(actor: AuthUser, dto: CreateAppointmentsBatchDto) {
    const preparedAppointments: PreparedAppointmentCreate[] = [];

    for (const appointmentDto of dto.appointments) {
      preparedAppointments.push(await this.prepareAppointmentForCreate(actor, appointmentDto));
    }

    const normalizedAppointments = this.mergeContiguousBatchAppointments(preparedAppointments);

    this.enforceBatchSchedulingRules(actor, normalizedAppointments);
    this.enforceBatchPatientDailyLimit(normalizedAppointments);

    for (const prepared of normalizedAppointments) {
      await this.enforcePatientDailyLimit(actor, this.toPatientDailyLimitInput(prepared));
    }

    const createdIds = await this.prisma.$transaction(async (tx) => {
      const treatmentPlanId = dto.autoCreateInitialTreatmentPlan
        ? await this.createInitialTreatmentPlanForBatch(tx, actor, normalizedAppointments)
        : undefined;
      const ids: string[] = [];

      for (const prepared of normalizedAppointments) {
        const appointment = await this.createAppointmentInTransaction(
          tx,
          actor,
          prepared,
          prepared.dto.treatmentPlanId ?? treatmentPlanId
        );
        ids.push(appointment.id);
      }

      return ids;
    });

    const appointments = await this.prisma.appointment.findMany({
      where: { id: { in: createdIds }, organizationId: actor.organizationId, branchId: { in: actor.branchIds } },
      include: this.include()
    });
    const byId = new Map(appointments.map((appointment) => [appointment.id, this.withCanonicalSpecialty(appointment)]));
    const orderedAppointments = createdIds.flatMap((id) => {
      const appointment = byId.get(id);
      return appointment ? [appointment] : [];
    });
    return this.attachPatientBalances(actor, orderedAppointments);
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
    const chairIndex = dto.chairIndex ?? current.chairIndex;
    const isOverbooking = dto.allowOverbooking ?? current.isOverbooking;
    const attendanceMode = dto.attendanceMode ?? current.attendanceMode;
    assertBranchAccess(actor, branchId);
    if (status !== current.status && this.isCancellationStatus(status)) {
      throw new BadRequestException("Usa el flujo de cancelación para cancelar una cita");
    }
    if (status !== current.status && status === AppointmentStatus.RESCHEDULED) {
      throw new BadRequestException("Usa el flujo de reagendado para reagendar una cita");
    }
    this.assertStatusTransition(current.status, status);

    this.validateDates(startAt, endAt, durationMinutes);
    this.validateChairIndex(chairIndex);
    await this.validateDurationSlotEnforcement(actor, branchId, professionalId, durationMinutes, startAt);
    await this.validateReferences(actor, {
      branchId,
      patientId: dto.patientId ?? current.patientId ?? undefined,
      professionalId,
      chairId,
      specialtyId: dto.specialtyId ?? current.specialtyId ?? undefined,
      treatmentPlanId: dto.treatmentPlanId ?? current.treatmentPlanId ?? undefined,
      status,
      startAt
    });
    await this.enforceSchedulingRules(
      actor,
      {
        branchId,
        professionalId,
        chairId,
        chairIndex,
        allowOverbooking: isOverbooking,
        attendanceMode,
        startAt,
        endAt,
        status
      },
      id
    );
    await this.enforcePatientDailyLimit(
      actor,
      {
        patientId: dto.patientId ?? current.patientId ?? undefined,
        status,
        startAt
      },
      id
    );

    if (status !== current.status && status === AppointmentStatus.NOTIFIED_BY_EMAIL) {
      await this.dispatchStatusSideEffects(id, status);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: {
          branchId: dto.branchId,
          patientId: dto.patientId,
          professionalId: dto.professionalId,
          chairId,
          chairIndex,
          isOverbooking,
          attendanceMode,
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
        await this.createStatusHistory(tx, id, current.status, status, actor.id, "Actualización manual");
      }

      await this.audit(tx, actor, id, "update", { status, startAt, endAt });
    });

    if (status !== current.status && status !== AppointmentStatus.NOTIFIED_BY_EMAIL) {
      await this.dispatchStatusSideEffects(id, status);
    }

    return this.findOne(actor, id);
  }

  async remove(actor: AuthUser, id: string) {
    return this.changeStatus(actor, id, AppointmentStatus.CANCELLED_BY_CLINIC, "Eliminado vía API", {
      cancellationReason: "Cancelada por la clínica"
    });
  }

  async confirm(actor: AuthUser, id: string) {
    return this.changeStatus(actor, id, AppointmentStatus.CONFIRMED, "Confirmado");
  }

  async changeAppointmentStatus(actor: AuthUser, id: string, status: AppointmentStatus, reason?: string) {
    if (this.isCancellationStatus(status)) {
      throw new BadRequestException("Usa el flujo de cancelacion para cancelar una cita");
    }
    if (status === AppointmentStatus.RESCHEDULED) {
      throw new BadRequestException("Usa el flujo de reagendado para reagendar una cita");
    }

    return this.changeStatus(actor, id, status, reason?.trim() || this.defaultStatusReason(status));
  }

  async confirmByEmail(actor: AuthUser, id: string) {
    return this.changeStatus(actor, id, AppointmentStatus.CONFIRMED_BY_EMAIL, "Confirmado por el paciente via enlace publico de email");
  }

  async cancel(actor: AuthUser, id: string, dto: CancelAppointmentDto) {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException("El motivo de la cancelación es obligatorio");
    }
    let status: AppointmentStatus = AppointmentStatus.CANCELLED_BY_CLINIC;
    if (dto.cancelledBy === "patient") {
      status = AppointmentStatus.CANCELLED_BY_PATIENT;
    } else if (dto.cancelledBy === "conflict") {
      status = AppointmentStatus.CANCELLED_CONFLICT;
    } else if (dto.cancelledBy === "rescheduled") {
      status = AppointmentStatus.CANCELLED_RESCHEDULED;
    }
    return this.changeStatus(actor, id, status, reason, { cancellationReason: reason });
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
    const chairIndex = dto.chairIndex ?? current.chairIndex;
    const isOverbooking = dto.allowOverbooking ?? current.isOverbooking;
    const attendanceMode = dto.attendanceMode ?? current.attendanceMode;
    const specialtyId = dto.specialtyId ?? current.specialtyId ?? undefined;

    assertBranchAccess(actor, branchId);
    this.assertStatusTransition(current.status, AppointmentStatus.RESCHEDULED);
    this.validateDates(startAt, endAt, durationMinutes);
    this.validateChairIndex(chairIndex);
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
        chairIndex,
        allowOverbooking: isOverbooking,
        attendanceMode,
        startAt,
        endAt,
        status: AppointmentStatus.SCHEDULED
      },
      id
    );
    await this.enforcePatientDailyLimit(
      actor,
      {
        patientId: current.patientId ?? undefined,
        status: AppointmentStatus.SCHEDULED,
        startAt
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
          chairIndex,
          isOverbooking,
          attendanceMode,
          specialtyId,
          startAt,
          endAt,
          durationMinutes,
          status: AppointmentStatus.RESCHEDULED,
          updatedById: actor.id
        }
      });
      await this.createStatusHistory(tx, id, current.status, AppointmentStatus.RESCHEDULED, actor.id, dto.reason ?? "Reagendado");
      await this.audit(tx, actor, id, "reschedule", { startAt, endAt });
    });

    return this.findOne(actor, id);
  }

  async arrive(actor: AuthUser, id: string, dto: AppointmentStatusReasonDto) {
    return this.changeStatus(actor, id, AppointmentStatus.ARRIVED, dto.reason ?? "Llegó");
  }

  async start(actor: AuthUser, id: string, dto: AppointmentStatusReasonDto) {
    return this.changeStatus(actor, id, AppointmentStatus.IN_PROGRESS, dto.reason ?? "En atención");
  }

  async complete(actor: AuthUser, id: string, dto: AppointmentStatusReasonDto) {
    return this.changeStatus(actor, id, AppointmentStatus.COMPLETED, dto.reason ?? "Atendido");
  }

  async noShow(actor: AuthUser, id: string, dto: AppointmentStatusReasonDto) {
    return this.changeStatus(actor, id, AppointmentStatus.NO_SHOW, dto.reason ?? "No asistió");
  }

  async waitingRoom(actor: AuthUser, id: string, dto: AppointmentStatusReasonDto) {
    return this.changeStatus(actor, id, AppointmentStatus.WAITING_ROOM, dto.reason ?? "Sala de espera");
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

    const chairIndex = query.chairIndex ? Number(query.chairIndex) : 1;
    this.validateChairIndex(chairIndex);
    const branchStart = this.atTime(date, `${String(agendaConfig.agendaStartHour).padStart(2, "0")}:00`);
    const branchEnd = this.atTime(date, `${String(agendaConfig.agendaEndHour).padStart(2, "0")}:00`);
    const schedules = await this.effectiveSchedulesForDate(actor, query.branchId, query.professionalId, date);

    const slots: { startAt: Date; endAt: Date; available: boolean; chairIndex: number }[] = [];
    for (const schedule of schedules) {
      if (chairIndex > (schedule.simultaneousChairs ?? 1)) continue;

      const scheduleStart = this.atTime(date, schedule.startTime);
      const scheduleEnd = this.atTime(date, schedule.endTime);
      const dayStart = new Date(Math.max(scheduleStart.getTime(), branchStart.getTime()));
      const dayEnd = new Date(Math.min(scheduleEnd.getTime(), branchEnd.getTime()));
      if (dayStart >= dayEnd) continue;
      const busy = await this.busyAppointments(actor, {
        professionalId: query.professionalId,
        chairId: query.chairId,
        chairIndex,
        startAt: dayStart,
        endAt: dayEnd,
        excludeId: query.excludeAppointmentId
      });

      for (let cursor = new Date(dayStart); cursor.getTime() + duration * 60000 <= dayEnd.getTime(); cursor = new Date(cursor.getTime() + slotMinutes * 60000)) {
        const endAt = new Date(cursor.getTime() + duration * 60000);
        const inBreak = this.isInsideBreak(cursor, endAt, date, schedule.breakStartTime, schedule.breakEndTime);
        const overlaps = busy.some((item) => this.overlaps(cursor, endAt, item.startAt, item.endAt));
        slots.push({ startAt: new Date(cursor), endAt, available: !inBreak && !overlaps, chairIndex });
      }
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

    if (newStatus === AppointmentStatus.NOTIFIED_BY_EMAIL) {
      await this.dispatchStatusSideEffects(id, newStatus);
    }

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

    if (newStatus !== AppointmentStatus.NOTIFIED_BY_EMAIL) {
      await this.dispatchStatusSideEffects(id, newStatus);
    }

    return this.findOne(actor, id);
  }

  private async dispatchStatusSideEffects(id: string, newStatus: AppointmentStatus) {
    if (newStatus === AppointmentStatus.NOTIFIED_BY_EMAIL) {
      await this.dispatchEmailNotification(id, "CONFIRMATION");
    }
  }

  private defaultStatusReason(status: AppointmentStatus) {
    if (status === AppointmentStatus.NOTIFIED_BY_EMAIL) return "Enviado para confirmacion por email";
    if (status === AppointmentStatus.CONFIRMED_BY_EMAIL) return "Marcado como confirmado por email";
    return "Actualizacion manual";
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
    return CANCELLATION_STATUSES.includes(status);
  }

  private async ensureAppointmentAccess(actor: AuthUser, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: { in: actor.branchIds } },
      select: { id: true }
    });

    if (!appointment) throw new NotFoundException("Appointment not found");
    return appointment;
  }

  private async prepareAppointmentForCreate(actor: AuthUser, dto: CreateAppointmentDto): Promise<PreparedAppointmentCreate> {
    assertBranchAccess(actor, dto.branchId);
    const status = (dto.status ?? "SCHEDULED") as AppointmentStatus;
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    const durationMinutes = dto.durationMinutes ?? this.diffMinutes(startAt, endAt);
    const chairId = dto.chairId ?? (await this.defaultChairForSchedule(actor, dto.branchId, dto.professionalId, startAt));
    const chairIndex = dto.chairIndex ?? 1;
    const isOverbooking = dto.allowOverbooking === true;
    const attendanceMode = dto.attendanceMode ?? AttendanceMode.PRESENTIAL;

    this.validateDates(startAt, endAt, durationMinutes);
    this.validateChairIndex(chairIndex);
    await this.validateDurationSlotEnforcement(actor, dto.branchId, dto.professionalId, durationMinutes, startAt);
    await this.validateReferences(actor, {
      branchId: dto.branchId,
      patientId: dto.patientId,
      professionalId: dto.professionalId,
      chairId,
      specialtyId: dto.specialtyId,
      treatmentPlanId: dto.treatmentPlanId,
      status,
      startAt
    });
    await this.enforceSchedulingRules(actor, {
      branchId: dto.branchId,
      professionalId: dto.professionalId,
      chairId,
      chairIndex,
      allowOverbooking: dto.allowOverbooking,
      attendanceMode,
      startAt,
      endAt,
      status
    });

    return { dto, status, startAt, endAt, durationMinutes, chairId, chairIndex, isOverbooking, attendanceMode };
  }

  private async createAppointmentInTransaction(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    prepared: PreparedAppointmentCreate,
    treatmentPlanId?: string
  ) {
    const { dto, status, startAt, endAt, durationMinutes, chairId, chairIndex, isOverbooking, attendanceMode } = prepared;
    const appointment = await tx.appointment.create({
      data: {
        organizationId: actor.organizationId,
        branchId: dto.branchId,
        patientId: dto.patientId,
        professionalId: dto.professionalId,
        chairId,
        chairIndex,
        isOverbooking,
        attendanceMode,
        specialtyId: dto.specialtyId,
        treatmentPlanId,
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
  }

  private enforceBatchSchedulingRules(actor: AuthUser, appointments: PreparedAppointmentCreate[]) {
    const canOverbook = actor.permissions.includes("appointments.overbook") || actor.permissions.includes("system.manage_all");

    for (let i = 0; i < appointments.length; i++) {
      const current = appointments[i];
      if (!current || FREE_STATUSES.includes(current.status)) continue;

      for (let j = i + 1; j < appointments.length; j++) {
        const next = appointments[j];
        if (!next || FREE_STATUSES.includes(next.status)) continue;
        const overlaps = this.overlaps(current.startAt, current.endAt, next.startAt, next.endAt);
        if (!overlaps) continue;

        if (current.dto.professionalId === next.dto.professionalId) {
          const currentOverbooking = this.isPreparedOverbooking(current);
          const nextOverbooking = this.isPreparedOverbooking(next);
          const sameNormalChair = (current.chairIndex ?? 1) === (next.chairIndex ?? 1) && !currentOverbooking && !nextOverbooking;
          const invalidOverbooking = (currentOverbooking || nextOverbooking) && (!currentOverbooking || !nextOverbooking || !canOverbook);
          if (sameNormalChair || invalidOverbooking) {
            throw new BadRequestException("La cita empalma con otra cita del profesional");
          }
        }

        if (
          current.chairId &&
          current.chairId === next.chairId &&
          this.requiresPhysicalChair(current.attendanceMode) &&
          this.requiresPhysicalChair(next.attendanceMode)
        ) {
          throw new BadRequestException("La cita empalma con otra cita en el box seleccionado");
        }
      }
    }
  }

  private mergeContiguousBatchAppointments(appointments: PreparedAppointmentCreate[]) {
    const sorted = [...appointments].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    const merged: PreparedAppointmentCreate[] = [];

    for (const appointment of sorted) {
      const mergeIndex = merged.findIndex((current) => this.canMergeBatchAppointments(current, appointment));
      if (mergeIndex > -1) {
        const previous = merged[mergeIndex]!;
        const startAt = previous.startAt <= appointment.startAt ? previous.startAt : appointment.startAt;
        const endAt = previous.endAt >= appointment.endAt ? previous.endAt : appointment.endAt;
        const durationMinutes = this.diffMinutes(startAt, endAt);

        merged[mergeIndex] = {
          ...previous,
          dto: {
            ...previous.dto,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            durationMinutes
          },
          startAt,
          endAt,
          durationMinutes
        };
      } else {
        merged.push(appointment);
      }
    }

    return merged.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }

  private canMergeBatchAppointments(left: PreparedAppointmentCreate, right: PreparedAppointmentCreate) {
    if (!this.countsAgainstPatientDailyLimit(left.dto.patientId, left.status)) return false;
    if (!this.countsAgainstPatientDailyLimit(right.dto.patientId, right.status)) return false;
    if (left.status !== right.status) return false;
    if (left.dto.branchId !== right.dto.branchId) return false;
    if (left.dto.patientId !== right.dto.patientId) return false;
    if (left.dto.professionalId !== right.dto.professionalId) return false;
    if ((left.chairId ?? "") !== (right.chairId ?? "")) return false;
    if ((left.chairIndex ?? 1) !== (right.chairIndex ?? 1)) return false;
    if (this.isPreparedOverbooking(left) !== this.isPreparedOverbooking(right)) return false;
    if (left.attendanceMode !== right.attendanceMode) return false;
    if ((left.dto.specialtyId ?? "") !== (right.dto.specialtyId ?? "")) return false;
    if ((left.dto.treatmentPlanId ?? "") !== (right.dto.treatmentPlanId ?? "")) return false;
    if ((left.dto.reason?.trim() ?? "") !== (right.dto.reason?.trim() ?? "")) return false;
    if ((left.dto.title?.trim() ?? "") !== (right.dto.title?.trim() ?? "")) return false;
    if ((left.dto.notes?.trim() ?? "") !== (right.dto.notes?.trim() ?? "")) return false;
    if (this.clinicDayKey(left.startAt) !== this.clinicDayKey(right.startAt)) return false;
    return right.startAt <= left.endAt && right.endAt >= left.startAt;
  }

  private isPreparedOverbooking(appointment: PreparedAppointmentCreate) {
    return appointment.isOverbooking === true || appointment.dto.allowOverbooking === true;
  }

  private enforceBatchPatientDailyLimit(appointments: PreparedAppointmentCreate[]) {
    const seen = new Set<string>();

    for (const appointment of appointments) {
      const patientId = appointment.dto.patientId;
      if (!this.countsAgainstPatientDailyLimit(patientId, appointment.status)) continue;

      const key = `${patientId}:${this.clinicDayKey(appointment.startAt)}`;
      if (seen.has(key)) throw new BadRequestException(PATIENT_DAILY_LIMIT_MESSAGE);
      seen.add(key);
    }
  }

  private async enforcePatientDailyLimit(
    actor: AuthUser,
    input: { patientId?: string | null; status: AppointmentStatus; startAt: Date },
    excludeId?: string
  ) {
    if (!this.countsAgainstPatientDailyLimit(input.patientId, input.status)) return;

    const range = this.clinicDayRange(input.startAt);
    const existing = await this.prisma.appointment.findFirst({
      where: {
        organizationId: actor.organizationId,
        patientId: input.patientId,
        status: { notIn: FREE_STATUSES },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        startAt: { gte: range.start, lt: range.end }
      },
      select: { id: true }
    });

    if (existing) throw new BadRequestException(PATIENT_DAILY_LIMIT_MESSAGE);
  }

  private toPatientDailyLimitInput(appointment: PreparedAppointmentCreate) {
    return {
      patientId: appointment.dto.patientId,
      status: appointment.status,
      startAt: appointment.startAt
    };
  }

  private countsAgainstPatientDailyLimit(patientId: string | null | undefined, status: AppointmentStatus) {
    return Boolean(patientId) && status !== AppointmentStatus.BLOCKED && !FREE_STATUSES.includes(status);
  }

  private clinicDayRange(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return { start, end };
  }

  private clinicDayKey(date: Date) {
    const { start } = this.clinicDayRange(date);
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  }

  private async createInitialTreatmentPlanForBatch(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    appointments: PreparedAppointmentCreate[]
  ) {
    if (appointments.some((appointment) => appointment.dto.treatmentPlanId)) return undefined;

    const clinicalAppointments = appointments.filter((appointment) =>
      this.countsAgainstPatientDailyLimit(appointment.dto.patientId, appointment.status)
    );
    const first = clinicalAppointments[0];
    if (!first) return undefined;

    const hasMixedContext = clinicalAppointments.some(
      (appointment) =>
        appointment.dto.branchId !== first.dto.branchId ||
        appointment.dto.patientId !== first.dto.patientId ||
        appointment.dto.professionalId !== first.dto.professionalId
    );
    if (hasMixedContext) {
      throw new BadRequestException("Initial treatment plan can only be created for one patient, branch and professional");
    }

    const plan = await tx.treatmentPlan.create({
      data: {
        organizationId: actor.organizationId,
        branchId: first.dto.branchId,
        patientId: first.dto.patientId!,
        professionalId: first.dto.professionalId,
        name: INITIAL_TREATMENT_PLAN_NAME,
        status: TreatmentPlanStatus.DRAFT
      }
    });

    return plan.id;
  }

  private async validateReferences(
    actor: AuthUser,
    input: {
      branchId: string;
      patientId?: string;
      professionalId: string;
      chairId?: string;
      specialtyId?: string;
      treatmentPlanId?: string;
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

    if (input.treatmentPlanId) {
      if (!input.patientId) {
        throw new BadRequestException("patientId is required when assigning treatmentPlanId");
      }

      const treatmentPlan = await this.prisma.treatmentPlan.findFirst({
        where: {
          id: input.treatmentPlanId,
          organizationId: actor.organizationId,
          patientId: input.patientId,
          branchId: { in: actor.branchIds }
        },
        select: { id: true }
      });
      if (!treatmentPlan) throw new BadRequestException("Invalid treatmentPlanId for selected patient");
    }
  }

  private async enforceSchedulingRules(
    actor: AuthUser,
    input: {
      branchId: string;
      professionalId: string;
      chairId?: string;
      chairIndex: number;
      allowOverbooking?: boolean;
      attendanceMode?: AttendanceMode;
      startAt: Date;
      endAt: Date;
      status: AppointmentStatus;
    },
    excludeId?: string
  ) {
    if (FREE_STATUSES.includes(input.status)) return;

    const hasOverbookingPermission = actor.permissions.includes("appointments.overbook") || actor.permissions.includes("system.manage_all");
    const canOverbook = input.allowOverbooking === true && hasOverbookingPermission;
    if (input.allowOverbooking && !hasOverbookingPermission) {
      throw new BadRequestException("Overbooking permission is required");
    }
    if (!canOverbook) {
      await this.ensureInsideProfessionalSchedule(actor, input);
      const professionalOverlap = await this.prisma.appointment.findFirst({
        where: {
          professionalId: input.professionalId,
          chairIndex: input.chairIndex,
          isOverbooking: false,
          organizationId: actor.organizationId,
          status: { notIn: FREE_STATUSES },
          ...(excludeId ? { id: { not: excludeId } } : {}),
          startAt: { lt: input.endAt },
          endAt: { gt: input.startAt }
        }
      });
      if (professionalOverlap) throw new BadRequestException("La cita empalma con otra cita del profesional");
    }

    if (input.chairId && this.requiresPhysicalChair(input.attendanceMode ?? AttendanceMode.PRESENTIAL)) {
      const chairOverlap = await this.prisma.appointment.findFirst({
        where: {
          chairId: input.chairId,
          attendanceMode: { in: [AttendanceMode.PRESENTIAL, AttendanceMode.BOTH] },
          organizationId: actor.organizationId,
          status: { notIn: FREE_STATUSES },
          ...(excludeId ? { id: { not: excludeId } } : {}),
          startAt: { lt: input.endAt },
          endAt: { gt: input.startAt }
        }
      });
      if (chairOverlap) throw new BadRequestException("La cita empalma con otra cita en el box seleccionado");
    }
  }

  private async ensureInsideProfessionalSchedule(
    actor: AuthUser,
    input: { branchId: string; professionalId: string; chairIndex?: number; allowOverbooking?: boolean; startAt: Date; endAt: Date; status?: AppointmentStatus }
  ) {
    if (input.startAt.toDateString() !== input.endAt.toDateString()) {
      throw new BadRequestException("Appointment must start and end on the same day");
    }

    const schedules = await this.effectiveSchedulesForDate(actor, input.branchId, input.professionalId, input.startAt);
    if (!schedules.length) throw new BadRequestException("Professional has no active schedule for this day and branch");
    const agendaConfig = await this.resolveAgendaConfig(actor, input.branchId, input.professionalId, input.startAt);
    const branchStart = this.atTime(input.startAt, `${String(agendaConfig.agendaStartHour).padStart(2, "0")}:00`);
    const branchEnd = this.atTime(input.startAt, `${String(agendaConfig.agendaEndHour).padStart(2, "0")}:00`);
    if (input.startAt < branchStart || input.endAt > branchEnd) {
      throw new BadRequestException("Appointment is outside branch agenda hours");
    }

    const chairIndex = input.chairIndex ?? 1;
    const matchingSchedule = schedules.find((schedule) => {
      const scheduleStart = this.atTime(input.startAt, schedule.startTime);
      const scheduleEnd = this.atTime(input.startAt, schedule.endTime);
      return input.startAt >= scheduleStart && input.endAt <= scheduleEnd;
    });
    if (!matchingSchedule) throw new BadRequestException("Appointment is outside professional schedule");
    if (!input.allowOverbooking && chairIndex > (matchingSchedule.simultaneousChairs ?? 1)) {
      throw new BadRequestException("chairIndex exceeds configured simultaneous chairs for this day");
    }

    if (
      input.status !== AppointmentStatus.BLOCKED &&
      this.isInsideBreak(input.startAt, input.endAt, input.startAt, matchingSchedule.breakStartTime, matchingSchedule.breakEndTime)
    ) {
      throw new BadRequestException("La cita se superpone con el horario de descanso del profesional");
    }

    const minutesFromScheduleStart = this.diffMinutes(this.atTime(input.startAt, matchingSchedule.startTime), input.startAt);
    if (minutesFromScheduleStart % agendaConfig.agendaSlotMinutes !== 0) {
      throw new BadRequestException(`Appointment startAt must align to professional slot minutes (${agendaConfig.agendaSlotMinutes} minutes)`);
    }
  }

  private async busyAppointments(
    actor: AuthUser,
    input: { professionalId: string; chairId?: string; chairIndex?: number; startAt: Date; endAt: Date; excludeId?: string }
  ) {
    return this.prisma.appointment.findMany({
      where: {
        organizationId: actor.organizationId,
        status: { notIn: FREE_STATUSES },
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt },
        OR: [
          { professionalId: input.professionalId, chairIndex: input.chairIndex ?? 1, isOverbooking: false },
          ...(input.chairId ? [{ chairId: input.chairId, attendanceMode: { in: [AttendanceMode.PRESENTIAL, AttendanceMode.BOTH] } }] : [])
        ]
      },
      select: { startAt: true, endAt: true }
    });
  }

  private async effectiveSchedulesForDate(actor: AuthUser, branchId: string, professionalId: string, date: Date) {
    const dateKey = this.clinicDayKey(date);
    const specialSchedules = await this.prisma.professionalSpecialSchedule.findMany({
      where: {
        professionalId,
        branchId,
        date: dateKey,
        isActive: true,
        professional: { organizationId: actor.organizationId }
      }
    });
    if (specialSchedules.length) return specialSchedules;

    return this.prisma.professionalSchedule.findMany({
      where: {
        professionalId,
        branchId,
        dayOfWeek: date.getDay(),
        isActive: true,
        professional: { organizationId: actor.organizationId }
      }
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

  private validateChairIndex(value: number) {
    if (!Number.isInteger(value) || value < 1) {
      throw new BadRequestException("chairIndex must be a positive integer");
    }
  }

  private requiresPhysicalChair(mode: AttendanceMode) {
    return mode === AttendanceMode.PRESENTIAL || mode === AttendanceMode.BOTH;
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
      treatmentPlan: { select: { id: true, name: true, status: true } },
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

  private async attachPatientBalances(actor: AuthUser, appointments: any[]) {
    const patientIds = appointments
      .map((a) => a.patientId)
      .filter(Boolean) as string[];

    if (patientIds.length === 0) return appointments;

    const patientsWithDebt = await this.prisma.patient.findMany({
      where: {
        id: { in: patientIds },
        organizationId: actor.organizationId
      },
      include: {
        treatmentPlans: {
          where: { isAlternative: false },
          include: {
            items: {
              where: { status: { not: "CANCELLED" } }
            }
          }
        },
        payments: {
          where: { status: { notIn: ["REFUNDED", "VOIDED"] } }
        }
      }
    });

    const balances = patientsWithDebt.reduce((acc: Record<string, number>, p: any) => {
      const planned = p.treatmentPlans.reduce(
        (sum: number, tp: any) => sum + tp.items.reduce((s: number, item: any) => s + Number(item.total), 0),
        0
      );
      const paid = p.payments.reduce((sum: number, pay: any) => sum + Number(pay.amount), 0);
      acc[p.id] = planned - paid;
      return acc;
    }, {});

    for (const app of appointments) {
      if (app.patient) {
        const debt = balances[app.patient.id] ?? 0;
        app.patient.hasDebt = debt > 0;
        app.patient.outstandingBalance = debt;
      }
    }

    return appointments;
  }
}
