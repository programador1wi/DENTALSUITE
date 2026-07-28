import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailCampaignStatus, EmailEventType, EmailRecipientStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { EmailService } from "../notifications/email.service";
import { EmailMarketingService } from "./email-marketing.service";
import { MarketingRecipientEligibilityService } from "./marketing-recipient-eligibility.service";

@Injectable()
export class EmailMarketingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailMarketingWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly marketing: EmailMarketingService,
    private readonly eligibility: MarketingRecipientEligibilityService,
    private readonly config: ConfigService
  ) {}

  onModuleInit() {
    const interval = Number(this.config.get<string>("MARKETING_WORKER_INTERVAL_MS") || 5000);
    this.timer = setInterval(() => void this.tick(), Math.max(1000, interval));
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.prisma.emailCampaign.updateMany({
        where: { status: EmailCampaignStatus.SCHEDULED, scheduledAt: { lte: new Date() } },
        data: { status: EmailCampaignStatus.QUEUED }
      });
      const campaign = await this.prisma.emailCampaign.findFirst({
        where: { status: { in: [EmailCampaignStatus.QUEUED, EmailCampaignStatus.SENDING] } },
        orderBy: { createdAt: "asc" },
        include: { organization: true, branch: true }
      });
      if (campaign) await this.processCampaign(campaign);
    } catch (error) {
      this.logger.error("Email marketing worker tick failed", error);
    } finally {
      this.running = false;
    }
  }

  private async processCampaign(campaign: Awaited<ReturnType<EmailMarketingWorker["nextCampaignShape"]>>) {
    const settings = await this.prisma.marketingSettings.findUnique({
      where: { organizationId: campaign.organizationId }
    });
    if (settings && !this.insideSendWindow(settings.sendWindowStart, settings.sendWindowEnd)) return;
    if (campaign.status === EmailCampaignStatus.QUEUED) {
      const claimed = await this.prisma.emailCampaign.updateMany({
        where: { id: campaign.id, status: EmailCampaignStatus.QUEUED },
        data: { status: EmailCampaignStatus.SENDING, startedAt: campaign.startedAt ?? new Date() }
      });
      if (!claimed.count) return;
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const dailySent = await this.prisma.emailCampaignRecipient.count({
      where: { campaign: { organizationId: campaign.organizationId }, sentAt: { gte: start } }
    });
    const remainingToday = Math.max(0, (settings?.maxDailyEmails ?? 2000) - dailySent);
    if (!remainingToday) return;
    const recipients = await this.prisma.emailCampaignRecipient.findMany({
      where: {
        campaignId: campaign.id,
        OR: [
          { deliveryStatus: EmailRecipientStatus.PENDING },
          { deliveryStatus: EmailRecipientStatus.FAILED, attempts: { lt: 3 } }
        ]
      },
      orderBy: { selectedAt: "asc" },
      take: Math.min(50, remainingToday),
      include: { patient: { include: { branch: true, organization: true } } }
    });

    for (const recipient of recipients) {
      const patient = recipient.patient;
      if (!patient) {
        await this.skip(recipient.id, "INACTIVE_PATIENT");
        continue;
      }
      const actor = {
        id: campaign.createdById,
        organizationId: campaign.organizationId,
        email: "worker@local",
        firstName: "Worker",
        lastName: "Marketing",
        roleIds: [],
        roleNames: [],
        permissions: ["system.manage_all"],
        branchIds: [patient.branchId]
      };
      const [check] = await this.eligibility.evaluateMany(
        actor,
        [patient],
        campaign.id,
        this.marketing.eligibilityPolicy(campaign.reportCodeSnapshot ?? undefined)
      );
      if (!check?.eligible) {
        await this.skip(recipient.id, check?.reasons.map((reason) => reason.code).join(",") || "SUPPRESSED");
        continue;
      }

      await this.prisma.emailCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          deliveryStatus: EmailRecipientStatus.QUEUED,
          queuedAt: new Date(),
          attempts: { increment: 1 }
        }
      });
      const unsubscribeUrl = `${this.apiBaseUrl()}/public/crm/email-marketing/unsubscribe/${encodeURIComponent(recipient.idempotencyKey)}`;
      const variables = {
        firstName: patient.firstName,
        lastName: patient.lastName,
        branchName: patient.branch.name,
        branchPhone: patient.branch.phone ?? "",
        branchAddress: patient.branch.address ?? "",
        organizationName: patient.organization.name,
        unsubscribeUrl
      };
      try {
        const result = await this.email.sendPatientEmail({
          to: recipient.emailSnapshot,
          replyTo: campaign.replyTo ?? undefined,
          fromAddress: campaign.fromAddress,
          fromName: campaign.fromName,
          subject: campaign.subject,
          html: this.marketing.renderContent(campaign.contentHtmlSnapshot, variables),
          text: this.marketing.renderContent(campaign.contentTextSnapshot, variables)
        });
        const sentAt = new Date();
        await this.prisma.$transaction([
          this.prisma.emailCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              deliveryStatus: EmailRecipientStatus.SENT,
              providerMessageId: result.providerMessageId,
              sentAt,
              failureReason: null
            }
          }),
          this.prisma.emailEvent.create({
            data: {
              organizationId: campaign.organizationId,
              campaignId: campaign.id,
              recipientId: recipient.id,
              providerMessageId: result.providerMessageId,
              eventType: EmailEventType.ACCEPTED,
              occurredAt: sentAt,
              signatureValid: true,
              payloadJson: { source: "SMTP_ACCEPTED" }
            }
          })
        ]);
      } catch (error) {
        await this.prisma.emailCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            deliveryStatus: EmailRecipientStatus.FAILED,
            failureReason: error instanceof Error ? error.message.slice(0, 500) : "Error de proveedor"
          }
        });
      }
    }
    await this.finishIfComplete(campaign.id, campaign.organizationId, campaign.branchId);
  }

  private nextCampaignShape() {
    return this.prisma.emailCampaign.findFirstOrThrow({ include: { organization: true, branch: true } });
  }

  private async finishIfComplete(campaignId: string, organizationId: string, branchId: string | null) {
    const pending = await this.prisma.emailCampaignRecipient.count({
      where: {
        campaignId,
        OR: [
          { deliveryStatus: EmailRecipientStatus.PENDING },
          { deliveryStatus: EmailRecipientStatus.QUEUED },
          { deliveryStatus: EmailRecipientStatus.FAILED, attempts: { lt: 3 } }
        ]
      }
    });
    if (pending) return;
    const [sent, failed] = await Promise.all([
      this.prisma.emailCampaignRecipient.count({
        where: {
          campaignId,
          deliveryStatus: {
            in: [
              EmailRecipientStatus.SENT,
              EmailRecipientStatus.DELIVERED,
              EmailRecipientStatus.OPENED,
              EmailRecipientStatus.CLICKED
            ]
          }
        }
      }),
      this.prisma.emailCampaignRecipient.count({
        where: { campaignId, deliveryStatus: EmailRecipientStatus.FAILED }
      })
    ]);
    const status =
      sent && failed
        ? EmailCampaignStatus.PARTIALLY_SENT
        : sent
          ? EmailCampaignStatus.SENT
          : EmailCampaignStatus.FAILED;
    await this.prisma.$transaction([
      this.prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { status, completedAt: new Date() }
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          branchId,
          action: "marketing.campaign_completed",
          entity: "EmailCampaign",
          entityId: campaignId,
          after: { status, sent, failed }
        }
      })
    ]);
  }

  private skip(id: string, reason: string) {
    return this.prisma.emailCampaignRecipient.update({
      where: { id },
      data: { deliveryStatus: EmailRecipientStatus.SKIPPED, failureReason: reason }
    });
  }

  private insideSendWindow(start: string, end: string) {
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const parse = (value: string) => {
      const [hours, minutes] = value.split(":").map(Number);
      return hours * 60 + minutes;
    };
    return current >= parse(start) && current <= parse(end);
  }

  private apiBaseUrl() {
    return (this.config.get<string>("API_PUBLIC_URL") || "http://127.0.0.1:3001/api/v1").replace(/\/$/, "");
  }
}
