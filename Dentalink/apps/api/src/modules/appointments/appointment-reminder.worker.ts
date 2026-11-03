import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppointmentReminderStage, AppointmentStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { PrismaService } from "../../database/prisma.service";
import { AppMetricsService } from "../metrics/app-metrics.service";
import { RedisService } from "../redis/redis.service";
import {
  AppointmentReminderOperationsService,
  EffectiveAppointmentReminderPolicy
} from "./appointment-reminder-operations.service";
import type { AppointmentsService } from "./appointments.service";

export const CHANNEL_EMAIL_48H = "EMAIL_CONFIRMATION_48H";
export const CHANNEL_EMAIL_24H = "EMAIL_CONFIRMATION_24H";
export const APPOINTMENT_EMAIL_DISPATCHER = "APPOINTMENT_EMAIL_DISPATCHER";
const ELIGIBLE_STATUSES = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.PENDING_CONFIRMATION,
  AppointmentStatus.NOTIFIED_BY_EMAIL
];
const CIRCUIT_KEY = "appointment-reminders:smtp-circuit-open-until";

@Injectable()
export class AppointmentReminderWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentReminderWorker.name);
  private readonly ownerId = `${hostname()}:${process.pid}:${randomUUID()}`;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APPOINTMENT_EMAIL_DISPATCHER)
    private readonly appointments: Pick<AppointmentsService, "dispatchEmailNotification">,
    private readonly operations: AppointmentReminderOperationsService,
    private readonly redis: RedisService,
    private readonly metrics: AppMetricsService,
    private readonly config: ConfigService
  ) {}

  onModuleInit() {
    if (this.config.get<string>("APPOINTMENT_REMINDER_WORKER_ENABLED") !== "true") {
      this.logger.log("Worker de recordatorios automáticos deshabilitado");
      return;
    }
    const interval = Math.max(
      5_000,
      Number(this.config.get<string>("APPOINTMENT_REMINDER_WORKER_INTERVAL_MS")) || 60_000
    );
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.recoverExpiredLeases();
      await this.materializeUpcomingJobs();
      if (!(await this.redis.ping())) {
        this.logger.error("Redis no disponible; recordatorios fail-closed sin tocar SMTP");
        this.metrics.setAppointmentReminderCircuit("redis_unavailable");
        return;
      }
      if (await this.isCircuitOpen()) {
        this.metrics.setAppointmentReminderCircuit("open");
        return;
      }
      this.metrics.setAppointmentReminderCircuit("closed");
      for (let count = 0; count < 100; count += 1) {
        const job = await this.claimNextJob();
        if (!job) break;
        await this.deliver(job.id);
      }
      await this.refreshBacklogMetrics();
    } catch (error) {
      this.logger.error("Error al procesar recordatorios automáticos de citas", error);
    } finally {
      this.running = false;
    }
  }

  async materializeUpcomingJobs(now = new Date()) {
    const candidates = await this.prisma.appointment.findMany({
      where: {
        startAt: { gt: now, lte: new Date(now.getTime() + 168 * 3_600_000) },
        status: { in: ELIGIBLE_STATUSES }
      },
      select: {
        id: true,
        organizationId: true,
        branchId: true,
        startAt: true,
        patient: { select: { email: true } },
        branch: { select: { timezone: true } }
      },
      orderBy: { startAt: "asc" },
      take: 1000
    });
    for (const appointment of candidates) {
      const policy = await this.operations.getEffectivePolicy(
        appointment.organizationId,
        appointment.branchId
      );
      if (!policy.enabled) continue;
      const hours = (appointment.startAt.getTime() - now.getTime()) / 3_600_000;
      if (hours > policy.firstOffsetHours) continue;
      if (hours <= policy.finalOffsetHours) {
        await this.prisma.appointmentReminder.updateMany({
          where: {
            appointmentId: appointment.id,
            appointmentStartAt: appointment.startAt,
            automationStage: AppointmentReminderStage.FIRST_48H,
            status: { in: ["PENDING", "FAILED"] }
          },
          data: { status: "STALE", failureCode: "ADAPTIVE_FINAL_ONLY", nextAttemptAt: null }
        });
        await this.materialize(appointment, AppointmentReminderStage.FINAL_24H, now);
      } else {
        await this.materialize(appointment, AppointmentReminderStage.FIRST_48H, now);
        await this.materialize(
          appointment,
          AppointmentReminderStage.FINAL_24H,
          new Date(appointment.startAt.getTime() - policy.finalOffsetHours * 3_600_000)
        );
      }
    }
    await this.prisma.appointmentReminder.updateMany({
      where: {
        automationStage: { not: null },
        status: { in: ["PENDING", "FAILED"] },
        appointment: { OR: [{ status: { notIn: ELIGIBLE_STATUSES } }, { startAt: { lte: now } }] }
      },
      data: { status: "STALE", failureCode: "APPOINTMENT_NOT_ELIGIBLE", nextAttemptAt: null }
    });
  }

  private async materialize(
    appointment: {
      id: string;
      startAt: Date;
      patient: { email: string | null } | null;
      branch: { timezone: string | null };
    },
    stage: AppointmentReminderStage,
    scheduledAt: Date
  ) {
    const email = appointment.patient?.email?.trim().toLowerCase();
    const failureCode = !email
      ? "MISSING_EMAIL"
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? "INVALID_EMAIL"
        : email.endsWith(".local")
          ? "RESERVED_EMAIL"
          : this.localMinute(appointment.branch.timezone, new Date()) === null
            ? "INVALID_TIMEZONE"
            : null;
    const status = failureCode ? "SKIPPED" : "PENDING";
    if (!failureCode) {
      await this.prisma.appointmentReminder.updateMany({
        where: {
          appointmentId: appointment.id,
          automationStage: stage,
          appointmentStartAt: appointment.startAt,
          status: "SKIPPED",
          failureCode: {
            in: ["MISSING_EMAIL", "INVALID_EMAIL", "RESERVED_EMAIL", "INVALID_TIMEZONE", "POLICY_DISABLED"]
          }
        },
        data: {
          status: "PENDING",
          scheduledAt,
          nextAttemptAt: scheduledAt,
          failureCode: null,
          errorMessage: null
        }
      });
    }
    await this.prisma.appointmentReminder.upsert({
      where: {
        appointmentId_automationStage_appointmentStartAt: {
          appointmentId: appointment.id,
          automationStage: stage,
          appointmentStartAt: appointment.startAt
        }
      },
      create: {
        appointmentId: appointment.id,
        channel: stage === AppointmentReminderStage.FIRST_48H ? CHANNEL_EMAIL_48H : CHANNEL_EMAIL_24H,
        automationStage: stage,
        appointmentStartAt: appointment.startAt,
        scheduledAt,
        nextAttemptAt: status === "PENDING" ? scheduledAt : null,
        status,
        failureCode,
        errorMessage: failureCode ? "Operación omitida por elegibilidad o configuración" : null
      },
      update: {}
    });
    if (failureCode) this.metrics.recordAppointmentReminder(stage, "SKIPPED");
  }

  private async claimNextJob() {
    const owner = this.ownerId;
    const lease = new Date(Date.now() + this.leaseMs());
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "AppointmentReminder"
      SET status = 'PROCESSING', attempts = attempts + 1, "leaseOwner" = ${owner},
          "leaseExpiresAt" = ${lease}, "heartbeatAt" = NOW(), "failureCode" = NULL, "updatedAt" = NOW()
      WHERE id = (
        SELECT id FROM "AppointmentReminder"
        WHERE "automationStage" IS NOT NULL AND status IN ('PENDING', 'FAILED')
          AND "failureCode" IS DISTINCT FROM 'MAX_ATTEMPTS_EXCEEDED'
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW()) AND "scheduledAt" <= NOW()
        ORDER BY "scheduledAt" ASC, "createdAt" ASC
        FOR UPDATE SKIP LOCKED LIMIT 1
      ) RETURNING id
    `;
    return rows[0] ?? null;
  }

  private async deliver(id: string) {
    const reminder = await this.prisma.appointmentReminder.findFirst({
      where: { id, status: "PROCESSING", leaseOwner: this.ownerId },
      include: { appointment: { include: { patient: true, branch: true } } }
    });
    if (!reminder?.automationStage || !reminder.appointmentStartAt) return;
    const heartbeat = this.startHeartbeat(id);
    let providerAccepted = false;
    try {
      const appointment = reminder.appointment;
      const policy = await this.operations.getEffectivePolicy(
        appointment.organizationId,
        appointment.branchId
      );
      if (!policy.enabled) return void (await this.finish(id, "SKIPPED", "POLICY_DISABLED"));
      if (!ELIGIBLE_STATUSES.some((status) => status === appointment.status))
        return void (await this.finish(id, "STALE", "APPOINTMENT_NOT_ELIGIBLE"));
      if (appointment.startAt.getTime() !== reminder.appointmentStartAt.getTime())
        return void (await this.finish(id, "STALE", "APPOINTMENT_RESCHEDULED"));
      if (appointment.startAt <= new Date())
        return void (await this.finish(id, "EXPIRED", "APPOINTMENT_STARTED"));
      const minute = this.localMinute(appointment.branch.timezone, new Date());
      if (minute === null) return void (await this.finish(id, "SKIPPED", "INVALID_TIMEZONE"));
      if (minute < policy.sendWindowStartMinutes || minute >= policy.sendWindowEndMinutes) {
        const next = this.nextAllowedTime(appointment.branch.timezone, policy, new Date());
        if (!next || next >= appointment.startAt)
          return void (await this.finish(id, "EXPIRED", "NEXT_WINDOW_AFTER_APPOINTMENT"));
        await this.release(id, "PENDING", next, "OUTSIDE_SEND_WINDOW", null);
        return;
      }
      const email = appointment.patient?.email?.trim().toLowerCase();
      if (!email || email.endsWith(".local"))
        return void (await this.finish(id, "SKIPPED", "EMAIL_NOT_DELIVERABLE"));
      if (!(await this.redis.ping())) throw new ServiceUnavailableException("REDIS_UNAVAILABLE_FAIL_CLOSED");
      const result = await this.appointments.dispatchEmailNotification(appointment.id, "CONFIRMATION", {
        stage: reminder.automationStage === AppointmentReminderStage.FIRST_48H ? "48H" : "24H",
        idempotencyKey: `appointment:${appointment.id}:${reminder.appointmentStartAt.toISOString()}:${reminder.automationStage}`
      });
      providerAccepted = true;
      const sentAt = new Date();
      await this.prisma.$transaction(async (tx) => {
        const completed = await tx.appointmentReminder.updateMany({
          where: { id, status: "PROCESSING", leaseOwner: this.ownerId },
          data: {
            status: "SENT",
            sentAt,
            providerMessageId: result?.providerMessageId,
            errorMessage: null,
            failureCode: null,
            leaseOwner: null,
            leaseExpiresAt: null,
            heartbeatAt: sentAt,
            nextAttemptAt: null
          }
        });
        if (completed.count !== 1) throw new Error("REMINDER_LEASE_LOST");
        if (
          appointment.status === AppointmentStatus.SCHEDULED ||
          appointment.status === AppointmentStatus.PENDING_CONFIRMATION
        ) {
          await tx.appointment.update({
            where: { id: appointment.id },
            data: { status: AppointmentStatus.NOTIFIED_BY_EMAIL }
          });
          await tx.auditLog.create({
            data: {
              organizationId: appointment.organizationId,
              branchId: appointment.branchId,
              action: "appointment_reminder.status_notified",
              entity: "Appointment",
              entityId: appointment.id,
              before: { status: appointment.status },
              after: { status: AppointmentStatus.NOTIFIED_BY_EMAIL, stage: reminder.automationStage }
            }
          });
        }
      });
      this.metrics.recordAppointmentReminder(reminder.automationStage, "SENT");
    } catch (error) {
      const message = this.errorMessage(error);
      if (providerAccepted) {
        await this.release(id, "UNCERTAIN", null, "PROVIDER_ACCEPTED_PERSISTENCE_FAILED", message).catch(
          () => undefined
        );
        this.metrics.recordAppointmentReminder(reminder.automationStage, "UNCERTAIN");
      } else {
        const policy = await this.operations.getEffectivePolicy(
          reminder.appointment.organizationId,
          reminder.appointment.branchId
        );
        const systemic = this.isSystemicProviderError(error);
        if (systemic) await this.openCircuit();
        const retryIndex = Math.max(0, reminder.attempts - 1);
        const delay =
          policy.retryDelaysMinutes[Math.min(retryIndex, policy.retryDelaysMinutes.length - 1)] ?? 240;
        const canRetry = reminder.attempts < policy.maxAttempts;
        await this.release(
          id,
          "FAILED",
          canRetry ? new Date(Date.now() + delay * 60_000) : null,
          canRetry ? (systemic ? "SMTP_SYSTEMIC_FAILURE" : "SMTP_SEND_FAILED") : "MAX_ATTEMPTS_EXCEEDED",
          message
        );
        this.metrics.recordAppointmentReminder(reminder.automationStage, "FAILED");
      }
    } finally {
      heartbeat.stop();
    }
  }

  private finish(id: string, status: string, failureCode: string) {
    return this.release(id, status, null, failureCode, null);
  }
  private release(
    id: string,
    status: string,
    nextAttemptAt: Date | null,
    failureCode: string,
    errorMessage: string | null
  ) {
    return this.prisma.appointmentReminder.updateMany({
      where: { id, status: "PROCESSING", leaseOwner: this.ownerId },
      data: {
        status,
        nextAttemptAt,
        failureCode,
        errorMessage,
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: new Date()
      }
    });
  }

  private recoverExpiredLeases() {
    return this.prisma.appointmentReminder.updateMany({
      where: { automationStage: { not: null }, status: "PROCESSING", leaseExpiresAt: { lt: new Date() } },
      data: {
        status: "UNCERTAIN",
        failureCode: "LEASE_EXPIRED_DELIVERY_UNKNOWN",
        errorMessage: "El lease venció durante el envío; requiere resolución manual",
        leaseOwner: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        heartbeatAt: new Date()
      }
    });
  }

  private startHeartbeat(id: string) {
    const timer = setInterval(
      () => {
        void this.prisma.appointmentReminder
          .updateMany({
            where: { id, status: "PROCESSING", leaseOwner: this.ownerId },
            data: { heartbeatAt: new Date(), leaseExpiresAt: new Date(Date.now() + this.leaseMs()) }
          })
          .then(({ count }) => {
            if (count !== 1) clearInterval(timer);
          })
          .catch(() => clearInterval(timer));
      },
      Math.max(1_000, Math.min(this.leaseMs() / 3, 30_000))
    );
    timer.unref();
    return { stop: () => clearInterval(timer) };
  }

  private async isCircuitOpen() {
    return Number((await this.redis.getClient().get(CIRCUIT_KEY)) || 0) > Date.now();
  }
  private async openCircuit() {
    const cooldown = Math.max(
      60_000,
      Number(this.config.get<string>("APPOINTMENT_REMINDER_PROVIDER_COOLDOWN_MS")) || 900_000
    );
    await this.redis.getClient().set(CIRCUIT_KEY, String(Date.now() + cooldown), "PX", cooldown);
  }

  private isSystemicProviderError(error: unknown) {
    let current: unknown = error;
    for (let depth = 0; depth < 5 && current; depth += 1) {
      const value = current as { message?: string; code?: string; responseCode?: number; cause?: unknown };
      if (
        /\b454\b|EAUTH|INVALID LOGIN|ECONNECTION|ETIMEDOUT|ECONNREFUSED/.test(
          `${value.code ?? ""} ${value.responseCode ?? ""} ${value.message ?? ""}`.toUpperCase()
        )
      )
        return true;
      current = value.cause;
    }
    return false;
  }

  private localMinute(timezone: string | null, date: Date) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone || "America/Mexico_City",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).formatToParts(date);
      const hour = Number(parts.find((part) => part.type === "hour")?.value);
      const minute = Number(parts.find((part) => part.type === "minute")?.value);
      return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
    } catch {
      return null;
    }
  }

  private nextAllowedTime(timezone: string | null, policy: EffectiveAppointmentReminderPolicy, from: Date) {
    for (let step = 1; step <= 2880; step += 1) {
      const candidate = new Date(from.getTime() + step * 60_000);
      const minute = this.localMinute(timezone, candidate);
      if (minute !== null && minute >= policy.sendWindowStartMinutes && minute < policy.sendWindowEndMinutes)
        return candidate;
    }
    return null;
  }

  private async refreshBacklogMetrics() {
    const [count, oldest] = await Promise.all([
      this.prisma.appointmentReminder.count({
        where: { automationStage: { not: null }, status: { in: ["PENDING", "FAILED"] } }
      }),
      this.prisma.appointmentReminder.findFirst({
        where: { automationStage: { not: null }, status: { in: ["PENDING", "FAILED"] } },
        orderBy: { scheduledAt: "asc" },
        select: { scheduledAt: true }
      })
    ]);
    this.metrics.setAppointmentReminderBacklog(
      count,
      oldest ? Math.max(0, (Date.now() - oldest.scheduledAt.getTime()) / 1000) : 0
    );
  }

  private leaseMs() {
    return Math.max(15_000, Number(this.config.get<string>("APPOINTMENT_REMINDER_LEASE_MS")) || 120_000);
  }
  private errorMessage(error: unknown) {
    return (error instanceof Error ? error.message : "Error desconocido")
      .replace(/[\r\n]+/g, " ")
      .slice(0, 500);
  }
  isInsideAllowedSendHours(timezone: string, date: Date, startMinutes = 480, endMinutes = 1200) {
    const minute = this.localMinute(timezone, date);
    return minute !== null && minute >= startMinutes && minute < endMinutes;
  }
}
