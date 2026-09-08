import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentReminderStage, Prisma } from "@prisma/client";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { EmailService } from "../notifications/email.service";
import {
  AppointmentReminderOperationsQueryDto,
  AppointmentReminderResolution,
  ResolveAppointmentReminderDto,
  UpdateAppointmentReminderBranchPolicyDto,
  UpdateAppointmentReminderPolicyDto
} from "./dto/appointment-reminder-operations.dto";

export type EffectiveAppointmentReminderPolicy = {
  enabled: boolean;
  firstOffsetHours: number;
  finalOffsetHours: number;
  sendWindowStartMinutes: number;
  sendWindowEndMinutes: number;
  retryDelaysMinutes: number[];
  maxAttempts: number;
};

const DEFAULT_POLICY: EffectiveAppointmentReminderPolicy = {
  enabled: false,
  firstOffsetHours: 48,
  finalOffsetHours: 24,
  sendWindowStartMinutes: 8 * 60,
  sendWindowEndMinutes: 20 * 60,
  retryDelaysMinutes: [15, 60, 240],
  maxAttempts: 3
};

@Injectable()
export class AppointmentReminderOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService
  ) {}

  async getEffectivePolicy(
    organizationId: string,
    branchId: string
  ): Promise<EffectiveAppointmentReminderPolicy> {
    const [organization, branch] = await Promise.all([
      this.prisma.appointmentReminderPolicy.findUnique({ where: { organizationId } }),
      this.prisma.appointmentReminderBranchPolicy.findUnique({ where: { branchId } })
    ]);
    const base = organization ?? DEFAULT_POLICY;
    return {
      enabled: branch?.enabled ?? base.enabled,
      firstOffsetHours: branch?.firstOffsetHours ?? base.firstOffsetHours,
      finalOffsetHours: branch?.finalOffsetHours ?? base.finalOffsetHours,
      sendWindowStartMinutes: branch?.sendWindowStartMinutes ?? base.sendWindowStartMinutes,
      sendWindowEndMinutes: branch?.sendWindowEndMinutes ?? base.sendWindowEndMinutes,
      retryDelaysMinutes: [...base.retryDelaysMinutes],
      maxAttempts: base.maxAttempts
    };
  }

  async list(user: AuthUser, query: AppointmentReminderOperationsQueryDto) {
    this.assertBranchAccess(user, query.branchId);
    const allowedBranchIds = query.branchId ? [query.branchId] : user.branchIds;
    const where: Prisma.AppointmentReminderWhereInput = {
      automationStage: query.stage as AppointmentReminderStage | undefined,
      status: query.status || undefined,
      appointment: {
        organizationId: user.organizationId,
        branchId: allowedBranchIds.length ? { in: allowedBranchIds } : undefined,
        patient: query.patient
          ? {
              OR: [
                { firstName: { contains: query.patient, mode: "insensitive" } },
                { lastName: { contains: query.patient, mode: "insensitive" } }
              ]
            }
          : undefined
      }
    };
    const rows = await this.prisma.appointmentReminder.findMany({
      where,
      include: {
        appointment: {
          select: {
            status: true,
            branch: { select: { id: true, name: true, timezone: true } },
            patient: { select: { id: true, firstName: true, lastName: true } }
          }
        }
      },
      orderBy: [{ appointmentStartAt: "asc" }, { createdAt: "asc" }],
      take: 1000
    });
    const eligibleAppointments = await this.prisma.appointment.findMany({
      where: {
        organizationId: user.organizationId,
        branchId: allowedBranchIds.length ? { in: allowedBranchIds } : undefined,
        status: { in: ["SCHEDULED", "PENDING_CONFIRMATION", "NOTIFIED_BY_EMAIL"] },
        patient: { email: { not: null } }
      },
      select: { startAt: true, patient: { select: { email: true } }, branch: { select: { timezone: true } } },
      take: 2000
    });
    const date = query.date;
    const dated = date
      ? rows.filter(
          (row) =>
            this.localDate(row.appointmentStartAt ?? row.scheduledAt, row.appointment.branch.timezone) ===
            date
        )
      : rows;
    const total = dated.length;
    const start = (query.page - 1) * query.pageSize;
    const items = dated.slice(start, start + query.pageSize).map((row) => ({
      id: row.id,
      appointmentId: row.appointmentId,
      appointmentStartAt: row.appointmentStartAt,
      stage: row.automationStage,
      status: row.status,
      attempts: row.attempts,
      nextAttemptAt: row.nextAttemptAt,
      sentAt: row.sentAt,
      failureCode: row.failureCode,
      errorMessage: this.sanitizeError(row.errorMessage),
      appointmentStatus: row.appointment.status,
      branch: row.appointment.branch,
      patient: row.appointment.patient
    }));
    const summary = dated.reduce<Record<string, number>>((acc, row) => {
      acc.total = (acc.total ?? 0) + 1;
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      if (row.automationStage) acc[row.automationStage] = (acc[row.automationStage] ?? 0) + 1;
      if (row.status === "SENT" && row.automationStage) {
        const sentKey = `SENT_${row.automationStage}`;
        acc[sentKey] = (acc[sentKey] ?? 0) + 1;
      }
      if (row.status === "SENT" && ["SCHEDULED", "PENDING_CONFIRMATION", "NOTIFIED_BY_EMAIL"].includes(row.appointment.status)) {
        acc.pendingResponse = (acc.pendingResponse ?? 0) + 1;
      }
      if (row.status === "SENT" && ["CONFIRMED", "CONFIRMED_BY_EMAIL", "CONFIRMED_BY_PHONE", "CONFIRMED_BY_WHATSAPP"].includes(row.appointment.status)) {
        acc.confirmedAfterEmail = (acc.confirmedAfterEmail ?? 0) + 1;
      }
      return acc;
    }, {});
    summary.eligible = eligibleAppointments.filter((appointment) => {
      const email = appointment.patient?.email?.trim().toLowerCase();
      return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith(".local") && (!date || this.localDate(appointment.startAt, appointment.branch.timezone) === date));
    }).length;
    return { items, total, page: query.page, pageSize: query.pageSize, summary };
  }

  async getSettings(user: AuthUser) {
    const policy = await this.prisma.appointmentReminderPolicy.findUnique({
      where: { organizationId: user.organizationId }
    });
    const branches = await this.prisma.branch.findMany({
      where: {
        organizationId: user.organizationId,
        id: user.branchIds.length ? { in: user.branchIds } : undefined,
        deletedAt: null
      },
      select: { id: true, name: true, timezone: true, appointmentReminderPolicy: true },
      orderBy: { name: "asc" }
    });
    return { policy: policy ?? DEFAULT_POLICY, branches };
  }

  async updateSettings(user: AuthUser, dto: UpdateAppointmentReminderPolicyDto) {
    this.validatePolicy(dto);
    const policy = await this.prisma.appointmentReminderPolicy.upsert({
      where: { organizationId: user.organizationId },
      create: { organizationId: user.organizationId, ...dto },
      update: dto
    });
    await this.audit(user, "appointment_reminders.policy_updated", policy.id, { ...dto });
    return policy;
  }

  async updateBranchSettings(
    user: AuthUser,
    branchId: string,
    dto: UpdateAppointmentReminderBranchPolicyDto
  ) {
    this.assertBranchAccess(user, branchId);
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: user.organizationId, deletedAt: null }
    });
    if (!branch) throw new NotFoundException("Sucursal no encontrada");
    const concreteOverrides = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== null && value !== undefined)
    );
    const merged = {
      ...(await this.getEffectivePolicy(user.organizationId, branchId)),
      ...concreteOverrides
    } as EffectiveAppointmentReminderPolicy;
    this.validatePolicy(merged);
    const policy = await this.prisma.appointmentReminderBranchPolicy.upsert({
      where: { branchId },
      create: { organizationId: user.organizationId, branchId, ...dto },
      update: dto
    });
    await this.audit(user, "appointment_reminders.branch_policy_updated", policy.id, { branchId, ...dto });
    return policy;
  }

  async retry(user: AuthUser, id: string) {
    const reminder = await this.findAuthorized(user, id);
    if (reminder.status !== "FAILED")
      throw new BadRequestException("Solo se pueden reintentar operaciones FAILED");
    const updated = await this.prisma.appointmentReminder.update({
      where: { id },
      data: { status: "PENDING", nextAttemptAt: new Date(), failureCode: "MANUAL_RETRY", errorMessage: null }
    });
    await this.audit(user, "appointment_reminders.retry_requested", id, { previousStatus: reminder.status });
    return updated;
  }

  async resolve(user: AuthUser, id: string, dto: ResolveAppointmentReminderDto) {
    const reminder = await this.findAuthorized(user, id);
    if (reminder.status !== "UNCERTAIN")
      throw new BadRequestException("Solo se pueden resolver operaciones UNCERTAIN");
    const data =
      dto.resolution === AppointmentReminderResolution.MARK_SENT
        ? {
            status: "SENT",
            sentAt: reminder.sentAt ?? new Date(),
            nextAttemptAt: null,
            failureCode: "MANUALLY_RESOLVED_SENT",
            errorMessage: dto.reason
          }
        : {
            status: "FAILED",
            nextAttemptAt: new Date(),
            failureCode: "MANUALLY_CONFIRMED_NOT_SENT",
            errorMessage: dto.reason
          };
    const updated = await this.prisma.appointmentReminder.update({ where: { id }, data });
    await this.audit(user, "appointment_reminders.uncertain_resolved", id, {
      resolution: dto.resolution,
      reason: dto.reason
    });
    return updated;
  }

  async testEmail(user: AuthUser, to?: string) {
    const recipient = to?.trim() || user.email;
    const result = await this.email.sendPatientEmail({
      to: recipient,
      subject: "Prueba de recordatorios automáticos Dentalink",
      text: "La configuración SMTP para recordatorios de citas funciona correctamente.",
      html: "<p>La configuración SMTP para recordatorios de citas funciona correctamente.</p>",
      idempotencyKey: `appointment-reminder-test:${user.organizationId}:${user.id}:${Date.now()}`
    });
    await this.audit(user, "appointment_reminders.test_email_sent", null, {
      recipient: "authenticated-or-explicit"
    });
    return { success: true, providerMessageId: result.providerMessageId };
  }

  private async findAuthorized(user: AuthUser, id: string) {
    const reminder = await this.prisma.appointmentReminder.findFirst({
      where: {
        id,
        appointment: {
          organizationId: user.organizationId,
          branchId: user.branchIds.length ? { in: user.branchIds } : undefined
        }
      }
    });
    if (!reminder) throw new NotFoundException("Operación de recordatorio no encontrada");
    return reminder;
  }

  private assertBranchAccess(user: AuthUser, branchId?: string) {
    if (branchId && user.branchIds.length && !user.branchIds.includes(branchId))
      throw new ForbiddenException("Sucursal no autorizada");
  }

  private validatePolicy(policy: EffectiveAppointmentReminderPolicy) {
    if (policy.firstOffsetHours <= policy.finalOffsetHours)
      throw new BadRequestException("El primer umbral debe ser mayor al final");
    if (policy.sendWindowStartMinutes >= policy.sendWindowEndMinutes)
      throw new BadRequestException("La ventana de envío no es válida");
    if (!policy.retryDelaysMinutes.length || policy.retryDelaysMinutes.length < policy.maxAttempts) {
      throw new BadRequestException("Debe existir un retraso de reintento por cada intento permitido");
    }
  }

  private audit(user: AuthUser, action: string, entityId: string | null, after: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action,
        entity: "AppointmentReminder",
        entityId,
        after
      }
    });
  }

  private sanitizeError(value: string | null) {
    return (
      value
        ?.replace(/[\r\n]+/g, " ")
        .replace(/(?:password|token|auth)=?\S*/gi, "[redacted]")
        .slice(0, 300) ?? null
    );
  }

  private localDate(value: Date, timezone: string | null) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone || "America/Mexico_City",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(value);
    } catch {
      return "INVALID_TIMEZONE";
    }
  }
}
