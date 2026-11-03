import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SurveyDeliveryEventType, SurveyInvitationStatus } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { EmailService } from "../notifications/email.service";
import { CrmSurveysService } from "./crm-surveys.service";

@Injectable()
export class CrmSurveysWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrmSurveysWorker.name);
  private readonly ownerId = randomUUID();
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly surveys: CrmSurveysService,
    private readonly config: ConfigService
  ) {}

  onModuleInit() {
    if (this.config.get<string>("SURVEY_WORKER_ENABLED") !== "true") {
      this.logger.log("Survey worker disabled");
      return;
    }
    const interval = Number(this.config.get<string>("SURVEY_WORKER_INTERVAL_MS") || 10_000);
    this.timer = setInterval(() => void this.tick(), Math.max(2_000, interval));
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.expireTokens();
      await this.reconcileExpiredLeases();
      const batchSize = Math.min(50, Math.max(1, Number(this.config.get<string>("SURVEY_WORKER_BATCH_SIZE")) || 10));
      for (let processed = 0; processed < batchSize; processed += 1) {
        const claimed = await this.claimNextInvitation();
        if (!claimed) break;
        await this.process(claimed.id);
      }
    } catch (error) {
      this.logger.error("Survey worker tick failed", error);
    } finally {
      this.running = false;
    }
  }

  private async claimNextInvitation(): Promise<{ id: string } | null> {
    const now = new Date();
    const candidates = await this.prisma.surveyInvitation.findMany({
      where: {
        scheduledAt: { lte: now },
        tokenExpiresAt: { gt: now },
        terminalAt: null,
        status: { in: [SurveyInvitationStatus.CREATED, SurveyInvitationStatus.FAILED] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        survey: { sendConfiguration: { isActive: true } }
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      take: 25,
      include: { survey: { include: { sendConfiguration: true } } }
    });
    if (!candidates.length) return null;
    const branches = await this.prisma.branch.findMany({
      where: {
        id: { in: [...new Set(candidates.map((candidate) => candidate.branchId))] },
        organizationId: { in: [...new Set(candidates.map((candidate) => candidate.organizationId))] }
      },
      select: { id: true, organizationId: true, timezone: true }
    });
    const branchByScope = new Map(
      branches.map((branch) => [`${branch.organizationId}:${branch.id}`, branch])
    );

    for (const candidate of candidates) {
      const sendConfiguration = candidate.survey.sendConfiguration;
      if (!sendConfiguration) continue;
      if (candidate.attempts >= sendConfiguration.maxRetries) {
        await this.prisma.surveyInvitation.updateMany({
          where: { id: candidate.id, status: candidate.status, terminalAt: null },
          data: {
            status: SurveyInvitationStatus.FAILED,
            terminalAt: now,
            nextAttemptAt: null,
            lastError: candidate.lastError ?? "Se agotaron los intentos de envío"
          }
        });
        continue;
      }
      const branch = branchByScope.get(`${candidate.organizationId}:${candidate.branchId}`);
      if (
        !branch ||
        !this.insideSendWindow(
          sendConfiguration.sendWindowStart,
          sendConfiguration.sendWindowEnd,
          branch.timezone || "America/Mexico_City"
        )
      ) {
        await this.prisma.surveyInvitation.updateMany({
          where: { id: candidate.id, status: candidate.status, terminalAt: null },
          data: { nextAttemptAt: new Date(Date.now() + 5 * 60_000) }
        });
        continue;
      }
      const leaseExpiresAt = new Date(Date.now() + this.leaseMs());
      const claimed = await this.prisma.surveyInvitation.updateMany({
        where: { id: candidate.id, status: candidate.status, terminalAt: null },
        data: {
          status: SurveyInvitationStatus.PROCESSING,
          attempts: { increment: 1 },
          leaseOwner: this.ownerId,
          leaseExpiresAt,
          heartbeatAt: now,
          nextAttemptAt: null,
          lastError: null
        }
      });
      if (claimed.count === 1) return { id: candidate.id };
    }
    return null;
  }

  private async process(id: string) {
    const invitation = await this.prisma.surveyInvitation.findFirst({
      where: { id, status: SurveyInvitationStatus.PROCESSING, leaseOwner: this.ownerId },
      include: {
        survey: { include: { sendConfiguration: true } },
        surveyVersion: true
      }
    });
    if (!invitation) return;
    const heartbeat = this.startHeartbeat(invitation.id);
    let providerAccepted = false;
    const sendConfiguration = invitation.survey.sendConfiguration;
    if (!sendConfiguration || !sendConfiguration.isActive) {
      heartbeat.stop();
      await this.finishFailure(invitation, "La configuración de envío está desactivada", false);
      return;
    }
    try {
    const [patient, appointment, professional, branch, organization] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: invitation.patientId, organizationId: invitation.organizationId } }),
      this.prisma.appointment.findFirst({ where: { id: invitation.appointmentId, organizationId: invitation.organizationId } }),
      this.prisma.professional.findFirst({ where: { id: invitation.professionalId, organizationId: invitation.organizationId } }),
      this.prisma.branch.findFirst({ where: { id: invitation.branchId, organizationId: invitation.organizationId }, include: { brand: true } }),
      this.prisma.organization.findUnique({ where: { id: invitation.organizationId } })
    ]);
    if (!patient || !appointment || !professional || !branch || !organization) {
      await this.finishFailure(invitation, "La referencia clínica de la invitación ya no está disponible", false);
      return;
    }
    if (!this.insideSendWindow(sendConfiguration.sendWindowStart, sendConfiguration.sendWindowEnd, branch.timezone || "America/Mexico_City")) {
      await this.releaseForRetry(invitation.id, new Date(Date.now() + 5 * 60_000), "Fuera de la ventana de envío");
      return;
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = this.surveys.hashToken(rawToken);
    const responseUrl = `${this.frontendUrl()}/public/surveys/respond/${encodeURIComponent(rawToken)}`;
    const appointmentDate = this.formatAppointment(appointment.startAt, branch.timezone || "America/Mexico_City");
    const values = {
      nombrePaciente: patient.firstName,
      apellidosPaciente: patient.lastName,
      fechaAtencion: appointmentDate.date,
      horaAtencion: appointmentDate.time,
      nombreSucursal: branch.name,
      direccionSucursal: branch.address ?? "",
      telefonoSucursal: branch.phone ?? "",
      nombreProfesional: `${professional.firstName} ${professional.lastName}`.trim(),
      nombreOrganizacion: organization.name,
      enlaceEncuesta: responseUrl
    };
    const subject = this.surveys.renderVariables(invitation.surveyVersion.emailSubject, values);
    const header = this.surveys.renderVariables(invitation.surveyVersion.emailHeaderHtml, values);
    const footer = this.surveys.renderVariables(invitation.surveyVersion.emailFooterHtml, values);
    const html = this.emailHtml({
      organizationName: organization.name,
      branchName: branch.name,
      branchAddress: branch.address ?? "",
      branchPhone: branch.phone ?? "",
      logoUrl: branch.brand?.logoUrl,
      primaryColor: branch.brand?.primaryColor,
      header,
      footer,
      responseUrl
    });
    const attempt = invitation.attempts;
    const now = new Date();
    const queued = await this.prisma.surveyInvitation.updateMany({
      where: { id: invitation.id, status: SurveyInvitationStatus.PROCESSING, leaseOwner: this.ownerId },
      data: {
        tokenHash,
        queuedAt: now,
        lastError: null
      }
    });
    if (!queued.count) return;
    await this.prisma.$transaction([
      this.prisma.surveyDeliveryEvent.create({
        data: { invitationId: invitation.id, type: SurveyDeliveryEventType.QUEUED, provider: "smtp" }
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId: invitation.organizationId,
          branchId: invitation.branchId,
          action: "survey.email_queued",
          entity: "SurveyInvitation",
          entityId: invitation.id,
          after: { attempt },
          correlationId: randomUUID()
        }
      })
    ]);

    try {
      const sent = await this.email.sendPatientEmail({
        to: invitation.recipientEmail,
        replyTo: branch.replyToEmail ?? branch.email ?? undefined,
        subject: this.toPlainText(subject),
        html,
        text: this.toPlainText(`${header}\n\nResponder encuesta: ${responseUrl}\n\n${footer}`),
        idempotencyKey: `survey-invitation:${invitation.id}`
      });
      providerAccepted = true;
      const sentAt = new Date();
      await this.prisma.$transaction(async (tx) => {
        const completed = await tx.surveyInvitation.updateMany({
          where: { id: invitation.id, status: SurveyInvitationStatus.PROCESSING, leaseOwner: this.ownerId },
          data: {
            status: SurveyInvitationStatus.SENT,
            sentAt,
            provider: "smtp",
            providerMessageId: sent.providerMessageId,
            lastError: null,
            leaseOwner: null,
            leaseExpiresAt: null,
            heartbeatAt: sentAt,
            nextAttemptAt: null,
            terminalAt: sentAt
          }
        });
        if (completed.count !== 1) throw new Error("SURVEY_LEASE_LOST_AFTER_PROVIDER_ACCEPTED");
        await tx.surveyDeliveryEvent.create({
          data: {
            invitationId: invitation.id,
            type: SurveyDeliveryEventType.ACCEPTED,
            provider: "smtp",
            providerMessageId: sent.providerMessageId,
            payloadJson: { source: "SMTP_ACCEPTED" }
          }
        });
        await tx.auditLog.create({
          data: {
            organizationId: invitation.organizationId,
            branchId: invitation.branchId,
            action: "survey.email_sent",
            entity: "SurveyInvitation",
            entityId: invitation.id,
            after: { provider: "smtp", providerMessageId: sent.providerMessageId },
            correlationId: randomUUID()
          }
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible enviar el correo";
      if (providerAccepted || this.isDeliveryUncertain(error)) {
        await this.finishUncertain(invitation, message);
      } else {
        await this.finishFailure(invitation, message, invitation.attempts < sendConfiguration.maxRetries);
      }
    }
    } finally {
      heartbeat.stop();
    }
  }

  private nextInvitationShape() {
    return this.prisma.surveyInvitation.findFirstOrThrow({
      include: { survey: { include: { sendConfiguration: true } }, surveyVersion: true }
    });
  }

  private async finishFailure(
    source: Awaited<ReturnType<CrmSurveysWorker["nextInvitationShape"]>>,
    error: string,
    retry: boolean
  ) {
    const nextAttemptAt = retry
      ? new Date(Date.now() + Math.min(360, 5 * 2 ** Math.max(0, source.attempts - 1)) * 60_000)
      : null;
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.surveyInvitation.updateMany({
        where: { id: source.id, status: SurveyInvitationStatus.PROCESSING, leaseOwner: this.ownerId },
        data: {
          status: SurveyInvitationStatus.FAILED,
          lastError: error.slice(0, 500),
          nextAttemptAt,
          terminalAt: retry ? null : new Date(),
          leaseOwner: null,
          leaseExpiresAt: null,
          heartbeatAt: new Date()
        }
      });
      if (updated.count !== 1) return;
      await tx.surveyDeliveryEvent.create({
        data: {
          invitationId: source.id,
          type: SurveyDeliveryEventType.FAILED,
          provider: "smtp",
          payloadJson: { message: error.slice(0, 500) }
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: source.organizationId,
          branchId: source.branchId,
          action: "survey.email_failed",
          entity: "SurveyInvitation",
          entityId: source.id,
          after: { attempt: source.attempts, retry, nextAttemptAt, error: error.slice(0, 500) },
          correlationId: randomUUID()
        }
      });
    });
  }

  private async finishUncertain(
    source: Awaited<ReturnType<CrmSurveysWorker["nextInvitationShape"]>>,
    error: string
  ) {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.surveyInvitation.updateMany({
        where: { id: source.id, status: SurveyInvitationStatus.PROCESSING, leaseOwner: this.ownerId },
        data: {
          status: SurveyInvitationStatus.UNCERTAIN,
          lastError: error.slice(0, 500),
          terminalAt: now,
          nextAttemptAt: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          heartbeatAt: now
        }
      });
      if (updated.count !== 1) return;
      await tx.surveyDeliveryEvent.create({
        data: {
          invitationId: source.id,
          type: SurveyDeliveryEventType.UNCERTAIN,
          provider: "smtp",
          payloadJson: { message: error.slice(0, 500), retry: false }
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: source.organizationId,
          branchId: source.branchId,
          action: "survey.email_uncertain",
          entity: "SurveyInvitation",
          entityId: source.id,
          after: { attempt: source.attempts, error: error.slice(0, 500), retry: false },
          correlationId: randomUUID()
        }
      });
    });
  }

  private releaseForRetry(id: string, nextAttemptAt: Date, error: string) {
    return this.prisma.surveyInvitation.updateMany({
      where: { id, status: SurveyInvitationStatus.PROCESSING, leaseOwner: this.ownerId },
      data: {
        status: SurveyInvitationStatus.FAILED,
        nextAttemptAt,
        lastError: error,
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: new Date()
      }
    });
  }

  private async reconcileExpiredLeases() {
    const now = new Date();
    const rows = await this.prisma.surveyInvitation.findMany({
      where: {
        status: SurveyInvitationStatus.PROCESSING,
        leaseExpiresAt: { lte: now },
        terminalAt: null
      },
      orderBy: { leaseExpiresAt: "asc" },
      take: 25
    });
    for (const row of rows) {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.surveyInvitation.updateMany({
          where: {
            id: row.id,
            status: SurveyInvitationStatus.PROCESSING,
            leaseExpiresAt: { lte: now },
            terminalAt: null
          },
          data: {
            status: SurveyInvitationStatus.UNCERTAIN,
            terminalAt: now,
            nextAttemptAt: null,
            leaseOwner: null,
            leaseExpiresAt: null,
            heartbeatAt: now,
            lastError: "El propietario perdió el lease durante el envío; requiere conciliación"
          }
        });
        if (updated.count !== 1) return;
        await tx.surveyDeliveryEvent.create({
          data: {
            invitationId: row.id,
            type: SurveyDeliveryEventType.UNCERTAIN,
            provider: "smtp",
            payloadJson: { reason: "LEASE_EXPIRED", retry: false }
          }
        });
        await tx.auditLog.create({
          data: {
            organizationId: row.organizationId,
            branchId: row.branchId,
            action: "survey.email_uncertain",
            entity: "SurveyInvitation",
            entityId: row.id,
            after: { reason: "LEASE_EXPIRED", retry: false },
            correlationId: randomUUID()
          }
        });
      });
    }
  }

  private startHeartbeat(id: string) {
    const interval = Math.max(5_000, Math.floor(this.leaseMs() / 3));
    const timer = setInterval(() => {
      const now = new Date();
      void this.prisma.surveyInvitation.updateMany({
        where: { id, status: SurveyInvitationStatus.PROCESSING, leaseOwner: this.ownerId },
        data: { heartbeatAt: now, leaseExpiresAt: new Date(now.getTime() + this.leaseMs()) }
      }).catch(() => undefined);
    }, interval);
    timer.unref();
    return { stop: () => clearInterval(timer) };
  }

  private leaseMs() {
    return Math.max(15_000, Number(this.config.get<string>("SURVEY_WORKER_LEASE_MS")) || 120_000);
  }

  private isDeliveryUncertain(error: unknown) {
    let current: unknown = error;
    for (let depth = 0; current && depth < 5; depth += 1) {
      const value = current as { code?: string; responseCode?: number; cause?: unknown };
      if (typeof value.responseCode === "number") return false;
      if (["EAUTH", "EENVELOPE", "EMESSAGE"].includes(String(value.code ?? ""))) return false;
      if (["ETIMEDOUT", "ECONNRESET", "ESOCKET"].includes(String(value.code ?? ""))) return true;
      current = value.cause;
    }
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (/deshabilitado|no esta configurado|remitente.*no es valido/i.test(message)) return false;
    return true;
  }

  private expireTokens() {
    return this.prisma.surveyInvitation.updateMany({
      where: {
        tokenExpiresAt: { lte: new Date() },
        status: { notIn: [SurveyInvitationStatus.RESPONDED, SurveyInvitationStatus.EXPIRED] }
      },
      data: { status: SurveyInvitationStatus.EXPIRED }
    });
  }

  private insideSendWindow(start: string, end: string, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
    const current = hour * 60 + minute;
    const parse = (value: string) => {
      const [hours, minutes] = value.split(":").map(Number);
      return hours * 60 + minutes;
    };
    const from = parse(start);
    const to = parse(end);
    return from <= to ? current >= from && current <= to : current >= from || current <= to;
  }

  private formatAppointment(value: Date, timezone: string) {
    return {
      date: new Intl.DateTimeFormat("es-MX", { timeZone: timezone, dateStyle: "long" }).format(value),
      time: new Intl.DateTimeFormat("es-MX", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(value)
    };
  }

  private frontendUrl() {
    const value = this.config.get<string>("FRONTEND_URL")?.trim() || "http://localhost:3000";
    return value.replace(/\/$/, "");
  }

  private emailHtml(input: {
    organizationName: string;
    branchName: string;
    branchAddress: string;
    branchPhone: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
    header: string;
    footer: string;
    responseUrl: string;
  }) {
    const color = /^#[0-9a-f]{6}$/i.test(input.primaryColor ?? "") ? input.primaryColor : "#185FA5";
    const safeLogo = input.logoUrl && /^https:\/\//i.test(input.logoUrl) ? this.escapeAttribute(input.logoUrl) : null;
    const logo = safeLogo
      ? `<img src="${safeLogo}" alt="${this.escape(input.organizationName)}" style="max-height:64px;max-width:180px">`
      : `<div style="font-size:22px;font-weight:700;color:${color}">${this.escape(input.organizationName)}</div>`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#334155"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:auto;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="padding:28px 32px;border-bottom:1px solid #e2e8f0">${logo}<div style="margin-top:8px;color:#64748b">${this.escape(input.branchName)}</div></td></tr><tr><td style="padding:32px"><div style="font-size:16px;line-height:1.65">${input.header}</div><div style="text-align:center;margin:32px 0"><a href="${this.escapeAttribute(input.responseUrl)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:14px 24px;border-radius:7px;font-weight:700">Responder encuesta</a></div><div style="font-size:14px;line-height:1.6;color:#64748b">${input.footer}</div></td></tr><tr><td style="padding:20px 32px;background:#f8fafc;font-size:12px;color:#64748b;text-align:center">${this.escape(input.branchAddress)}${input.branchPhone ? ` · ${this.escape(input.branchPhone)}` : ""}</td></tr></table></td></tr></table></body></html>`;
  }

  private toPlainText(value: string) {
    return value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  private escape(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  private escapeAttribute(value: string) {
    return this.escape(value).replace(/`/g, "&#096;");
  }
}
