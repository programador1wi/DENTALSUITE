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
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly surveys: CrmSurveysService,
    private readonly config: ConfigService
  ) {}

  onModuleInit() {
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
      const invitation = await this.prisma.surveyInvitation.findFirst({
        where: {
          scheduledAt: { lte: new Date() },
          tokenExpiresAt: { gt: new Date() },
          status: { in: [SurveyInvitationStatus.CREATED, SurveyInvitationStatus.FAILED] },
          survey: { sendConfiguration: { isActive: true } }
        },
        orderBy: { scheduledAt: "asc" },
        include: {
          survey: { include: { sendConfiguration: true } },
          surveyVersion: true
        }
      });
      if (invitation) await this.process(invitation);
    } catch (error) {
      this.logger.error("Survey worker tick failed", error);
    } finally {
      this.running = false;
    }
  }

  private async process(invitation: Awaited<ReturnType<CrmSurveysWorker["nextInvitationShape"]>>) {
    const sendConfiguration = invitation.survey.sendConfiguration;
    if (!sendConfiguration || !sendConfiguration.isActive || invitation.attempts >= sendConfiguration.maxRetries) return;
    const [patient, appointment, professional, branch, organization] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: invitation.patientId, organizationId: invitation.organizationId } }),
      this.prisma.appointment.findFirst({ where: { id: invitation.appointmentId, organizationId: invitation.organizationId } }),
      this.prisma.professional.findFirst({ where: { id: invitation.professionalId, organizationId: invitation.organizationId } }),
      this.prisma.branch.findFirst({ where: { id: invitation.branchId, organizationId: invitation.organizationId }, include: { brand: true } }),
      this.prisma.organization.findUnique({ where: { id: invitation.organizationId } })
    ]);
    if (!patient || !appointment || !professional || !branch || !organization) {
      await this.fail(invitation.id, invitation.attempts + 1, "La referencia clínica de la invitación ya no está disponible");
      return;
    }
    if (!this.insideSendWindow(sendConfiguration.sendWindowStart, sendConfiguration.sendWindowEnd, branch.timezone || "America/Mexico_City")) return;

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
    const attempt = invitation.attempts + 1;
    const now = new Date();
    const claimed = await this.prisma.surveyInvitation.updateMany({
      where: { id: invitation.id, status: invitation.status },
      data: {
        tokenHash,
        status: SurveyInvitationStatus.QUEUED,
        queuedAt: now,
        attempts: attempt,
        lastError: null
      }
    });
    if (!claimed.count) return;
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
        text: this.toPlainText(`${header}\n\nResponder encuesta: ${responseUrl}\n\n${footer}`)
      });
      const sentAt = new Date();
      await this.prisma.$transaction([
        this.prisma.surveyInvitation.update({
          where: { id: invitation.id },
          data: {
            status: SurveyInvitationStatus.SENT,
            sentAt,
            provider: "smtp",
            providerMessageId: sent.providerMessageId,
            lastError: null
          }
        }),
        this.prisma.surveyDeliveryEvent.create({
          data: {
            invitationId: invitation.id,
            type: SurveyDeliveryEventType.ACCEPTED,
            provider: "smtp",
            providerMessageId: sent.providerMessageId,
            payloadJson: { source: "SMTP_ACCEPTED" }
          }
        }),
        this.prisma.auditLog.create({
          data: {
            organizationId: invitation.organizationId,
            branchId: invitation.branchId,
            action: "survey.email_sent",
            entity: "SurveyInvitation",
            entityId: invitation.id,
            after: { provider: "smtp", providerMessageId: sent.providerMessageId },
            correlationId: randomUUID()
          }
        })
      ]);
    } catch (error) {
      await this.fail(invitation.id, attempt, error instanceof Error ? error.message : "No fue posible enviar el correo");
    }
  }

  private nextInvitationShape() {
    return this.prisma.surveyInvitation.findFirstOrThrow({
      include: { survey: { include: { sendConfiguration: true } }, surveyVersion: true }
    });
  }

  private async fail(id: string, attempt: number, error: string) {
    await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.surveyInvitation.update({
        where: { id },
        data: { status: SurveyInvitationStatus.FAILED, attempts: attempt, lastError: error.slice(0, 500) }
      });
      await tx.surveyDeliveryEvent.create({
        data: {
          invitationId: id,
          type: SurveyDeliveryEventType.FAILED,
          provider: "smtp",
          payloadJson: { message: error.slice(0, 500) }
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: invitation.organizationId,
          branchId: invitation.branchId,
          action: "survey.email_failed",
          entity: "SurveyInvitation",
          entityId: id,
          after: { attempt, error: error.slice(0, 500) },
          correlationId: randomUUID()
        }
      });
    });
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
