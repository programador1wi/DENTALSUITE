import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EmailCampaignStatus,
  EmailDomainStatus,
  EmailEventType,
  EmailRecipientEligibilityStatus,
  EmailRecipientStatus,
  EmailTemplateStatus,
  MarketingConsentStatus,
  Prisma
} from "@prisma/client";
import { randomUUID, timingSafeEqual } from "crypto";
import { resolveTxt } from "node:dns/promises";
import { AuthUser } from "../../common/types/auth-user";
import { assertBranchAccess } from "../../common/utils/branch-scope.util";
import { sanitizeRichTextHtml } from "../../common/utils/sanitize-rich-text.util";
import { createXlsxWorkbook } from "../../common/utils/xlsx.util";
import { PrismaService } from "../../database/prisma.service";
import { EmailService } from "../notifications/email.service";
import {
  CreateDomainVerificationDto,
  CreateEmailCampaignDto,
  CreateEmailTemplateDto,
  CreateSegmentDto,
  EmailWebhookDto,
  ExportMarketingReportDto,
  ScheduleEmailCampaignDto,
  TestEmailCampaignDto,
  UpdateEmailCampaignDto,
  UpdateMarketingSettingsDto
} from "./dto/email-marketing.dto";
import { EmailMarketingReportsService } from "./email-marketing-reports.service";
import { MarketingRecipientEligibilityService } from "./marketing-recipient-eligibility.service";

const editableCampaignStatuses: EmailCampaignStatus[] = [
  EmailCampaignStatus.DRAFT,
  EmailCampaignStatus.READY
];
@Injectable()
export class EmailMarketingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: EmailMarketingReportsService,
    private readonly eligibility: MarketingRecipientEligibilityService,
    private readonly email: EmailService,
    private readonly config: ConfigService
  ) {}

  catalog() {
    return this.reports.catalog();
  }

  eligibilityPolicy(reportCode?: string) {
    return this.reports.eligibilityPolicy(reportCode);
  }

  preview(actor: AuthUser, code: string, dto: Parameters<EmailMarketingReportsService["preview"]>[2]) {
    return this.reports.preview(actor, code, dto);
  }

  async createSegment(actor: AuthUser, dto: CreateSegmentDto) {
    const preview = await this.reports.preview(actor, dto.reportCode, {
      parameters: dto.parameters,
      page: 1,
      pageSize: 1
    });
    const branchId = this.optionalString(dto.parameters.branchId);
    assertBranchAccess(actor, branchId);
    const segment = await this.prisma.marketingSegment.create({
      data: {
        organizationId: actor.organizationId,
        branchId,
        reportCode: dto.reportCode,
        parametersJson: this.json(dto.parameters),
        name: dto.name.trim(),
        resultCount: preview.summary.results,
        eligibleCount: preview.summary.eligible,
        createdById: actor.id
      }
    });
    await this.audit(
      actor,
      "MarketingSegment",
      segment.id,
      "marketing.segment_generated",
      undefined,
      {
        reportCode: segment.reportCode,
        resultCount: segment.resultCount,
        eligibleCount: segment.eligibleCount
      },
      branchId
    );
    return segment;
  }

  async exportReport(actor: AuthUser, code: string, dto: ExportMarketingReportDto) {
    const rows = await this.reports.exportRows(actor, code, dto);
    const definition = this.reports.catalog().find((report) => report.code === code);
    if (!definition) throw new NotFoundException("Reporte de marketing no encontrado");
    const selected = new Set(dto.selectedPatientIds ?? []);
    const filtered = rows.filter((row) => {
      if (dto.scope === "ELIGIBLE") return row.eligible;
      if (dto.scope === "INELIGIBLE") return !row.eligible;
      if (dto.scope === "SELECTED") return row.eligible && selected.has(row.patientId);
      return true;
    });
    const branchId = this.optionalString(dto.parameters.branchId);
    const professionalId = this.optionalString(dto.parameters.professionalId);
    const agreementId = this.optionalString(dto.parameters.agreementId);
    const [organization, branch, professional, agreement] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: actor.organizationId },
        select: { name: true }
      }),
      branchId
        ? this.prisma.branch.findFirst({
            where: { id: branchId, organizationId: actor.organizationId },
            select: { name: true }
          })
        : null,
      professionalId
        ? this.prisma.professional.findFirst({
            where: { id: professionalId, organizationId: actor.organizationId },
            select: { firstName: true, lastName: true }
          })
        : null,
      agreementId
        ? this.prisma.agreement.findFirst({
            where: { id: agreementId, organizationId: actor.organizationId },
            select: { name: true }
          })
        : null
    ]);
    const parameterDefinitions = [...definition.requiredParameters, ...definition.optionalParameters];
    const parameterRows = parameterDefinitions
      .filter(
        (parameter) => dto.parameters[parameter.key] !== undefined && dto.parameters[parameter.key] !== ""
      )
      .map((parameter) => {
        const raw = dto.parameters[parameter.key];
        const option = parameter.options?.find((item) => String(item.value) === String(raw));
        let value = option?.label ?? String(raw ?? "");
        if (parameter.key === "branchId") value = branch?.name ?? value;
        if (parameter.key === "professionalId") {
          value = professional ? `${professional.firstName} ${professional.lastName}`.trim() : value;
        }
        if (parameter.key === "agreementId") value = agreement?.name ?? value;
        if (typeof raw === "boolean") value = raw ? "Sí" : "No";
        return { Parámetro: parameter.label, Valor: value };
      });
    if (!parameterRows.length) parameterRows.push({ Parámetro: "Filtros", Valor: "Sin filtros adicionales" });
    const scopeLabels = {
      ALL: "Todos los resultados",
      ELIGIBLE: "Solamente pacientes elegibles",
      SELECTED: "Solamente pacientes seleccionados",
      INELIGIBLE: "Pacientes no elegibles con motivo"
    } as const;
    const generatedAt = new Date();
    const includesMarketingEligibility = definition.eligibilityPolicy !== "REGISTERED_EMAIL_ONLY";
    const patientColumns = [
      "N.º",
      "ID paciente",
      "Documento",
      "Nombre paciente",
      "Apellidos paciente",
      "Correo electrónico",
      "Teléfono",
      "Sucursal",
      "Profesional",
      "Última atención",
      ...(includesMarketingEligibility ? ["Elegibilidad", "Motivo de exclusión"] : [])
    ];
    const patientRows = filtered.map((row, index) => ({
      "N.º": index + 1,
      "ID paciente": row.publicId,
      Documento: row.documentNumber,
      "Nombre paciente": row.firstName,
      "Apellidos paciente": row.lastName,
      "Correo electrónico": row.email,
      Teléfono: row.phone,
      Sucursal: row.branch,
      Profesional: row.professional,
      "Última atención": row.lastAttentionAt
        ? new Date(row.lastAttentionAt).toLocaleDateString("es-MX")
        : row.lastAppointment
          ? new Date(row.lastAppointment).toLocaleDateString("es-MX")
          : "",
      ...(includesMarketingEligibility
        ? {
            Elegibilidad: row.eligible ? "Elegible" : "No elegible",
            "Motivo de exclusión": row.eligibilityReasons.map((reason) => reason.label).join("; ")
          }
        : {})
    }));
    const summaryRows: Array<Record<string, string | number>> = [
      { Indicador: "Categoría", Detalle: definition.category },
      { Indicador: "Alcance exportado", Detalle: scopeLabels[dto.scope] },
      { Indicador: "Resultados del reporte", Detalle: rows.length },
      { Indicador: "Filas exportadas", Detalle: filtered.length },
      ...(includesMarketingEligibility
        ? [
            { Indicador: "Pacientes elegibles", Detalle: rows.filter((row) => row.eligible).length },
            { Indicador: "Pacientes no elegibles", Detalle: rows.filter((row) => !row.eligible).length }
          ]
        : [
            {
              Indicador: "Pacientes con correo registrado",
              Detalle: rows.filter((row) => Boolean(row.email?.trim())).length
            }
          ]),
      { Indicador: "Generado por", Detalle: `${actor.firstName} ${actor.lastName}`.trim() },
      { Indicador: "Fecha de generación", Detalle: generatedAt.toLocaleString("es-MX") },
      { Indicador: "Criterio del reporte", Detalle: definition.description }
    ];
    const workbook = createXlsxWorkbook([
      {
        name: "Pacientes",
        title: definition.name,
        subtitle: `${organization.name} · ${filtered.length} pacientes exportados`,
        columns: patientColumns,
        rows: patientRows
      },
      {
        name: "Resumen",
        title: "Resumen del reporte",
        subtitle: `${definition.name} · Email Marketing`,
        rows: summaryRows
      },
      {
        name: "Parámetros",
        title: "Parámetros aplicados",
        subtitle: `${definition.name} · ${scopeLabels[dto.scope]}`,
        rows: parameterRows
      }
    ]);
    await this.audit(
      actor,
      "MarketingReport",
      code,
      "marketing.segment_exported",
      undefined,
      {
        scope: dto.scope,
        rowCount: filtered.length,
        parameters: dto.parameters
      },
      this.optionalString(dto.parameters.branchId)
    );
    return {
      fileName: `reporte-email-marketing-${code.toLowerCase()}-${generatedAt.toISOString().slice(0, 10)}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: workbook.toString("base64"),
      rowCount: filtered.length
    };
  }

  async createCampaign(actor: AuthUser, dto: CreateEmailCampaignDto) {
    const existing = await this.prisma.emailCampaign.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: actor.organizationId,
          idempotencyKey: dto.idempotencyKey
        }
      },
      include: this.campaignInclude()
    });
    if (existing) return existing;
    assertBranchAccess(actor, dto.branchId);
    const settings = await this.getSettings(actor);
    const uniquePatientIds = [...new Set(dto.patientIds)];
    if (!uniquePatientIds.length) throw new BadRequestException("Selecciona al menos un paciente con correo");
    if (uniquePatientIds.length > settings.maxRecipientsPerCampaign) {
      throw new BadRequestException(
        `La campaña admite hasta ${settings.maxRecipientsPerCampaign} destinatarios`
      );
    }
    await this.assertMonthlyCampaignLimit(actor, settings.maxCampaignsPerMonth);
    const { patients, eligibility } = await this.reports.selectedPatients(actor, uniquePatientIds, {
      reportCode: dto.reportCode,
      parameters: dto.parameters
    });
    const resultByPatient = new Map(eligibility.map((item) => [item.patientId, item]));
    const eligiblePatients = patients.filter((patient) => resultByPatient.get(patient.id)?.eligible);
    const recipientPatients = eligiblePatients.filter((patient, index, all) => {
      const email = resultByPatient.get(patient.id)?.normalizedEmail;
      return (
        Boolean(email) &&
        all.findIndex((candidate) => resultByPatient.get(candidate.id)?.normalizedEmail === email) === index
      );
    });
    if (!recipientPatients.length)
      throw new BadRequestException("Ningún paciente seleccionado tiene un correo electrónico válido");

    const template = dto.templateId
      ? await this.prisma.emailTemplate.findFirst({
          where: {
            id: dto.templateId,
            organizationId: actor.organizationId,
            status: { not: EmailTemplateStatus.ARCHIVED }
          }
        })
      : null;
    if (dto.templateId && !template) throw new NotFoundException("Plantilla no encontrada");
    const sender = await this.resolveSender(actor.organizationId, dto.fromName, dto.replyTo);
    const contentHtml = this.ensureUnsubscribeLink(
      this.sanitizeHtml(dto.contentHtml ?? template?.html ?? this.defaultHtml())
    );
    const contentText = this.ensureUnsubscribeText(
      (dto.contentText ?? template?.text ?? this.defaultText()).trim()
    );
    const subject = dto.subject.trim() || template?.subject;
    if (!subject) throw new BadRequestException("El asunto es requerido");

    const campaign = await this.prisma.$transaction(async (tx) => {
      const segment = await tx.marketingSegment.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          reportCode: dto.reportCode,
          parametersJson: this.json(dto.parameters),
          name: `${dto.name.trim()} · segmento`,
          resultCount: uniquePatientIds.length,
          eligibleCount: recipientPatients.length,
          createdById: actor.id
        }
      });
      const created = await tx.emailCampaign.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          segmentId: segment.id,
          templateId: template?.id,
          name: dto.name.trim(),
          subject,
          preheader: dto.preheader?.trim() || template?.preheader,
          fromName: sender.fromName,
          fromAddress: sender.fromAddress,
          replyTo: sender.replyTo,
          domain: sender.domain,
          tags: (dto.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
          contentHtmlSnapshot: contentHtml,
          contentTextSnapshot: contentText,
          reportCodeSnapshot: dto.reportCode,
          reportParametersJson: this.json(dto.parameters),
          status: EmailCampaignStatus.DRAFT,
          idempotencyKey: dto.idempotencyKey,
          createdById: actor.id
        }
      });
      await tx.emailCampaignRecipient.createMany({
        data: recipientPatients.map((patient) => {
          const result = resultByPatient.get(patient.id)!;
          return {
            campaignId: created.id,
            patientId: patient.id,
            branchId: patient.branchId,
            emailSnapshot: patient.email!.trim(),
            normalizedEmail: result.normalizedEmail!,
            nameSnapshot: `${patient.firstName} ${patient.lastName}`.trim(),
            eligibilityStatus: EmailRecipientEligibilityStatus.ELIGIBLE,
            deliveryStatus: EmailRecipientStatus.PENDING,
            idempotencyKey: `${created.id}:${patient.id}:1`
          };
        })
      });
      await this.auditWith(
        tx,
        actor,
        "EmailCampaign",
        created.id,
        "marketing.campaign_created",
        undefined,
        {
          reportCode: dto.reportCode,
          requested: uniquePatientIds.length,
          eligible: recipientPatients.length,
          excluded: uniquePatientIds.length - recipientPatients.length
        },
        dto.branchId
      );
      return created;
    });
    return this.getCampaign(actor, campaign.id);
  }

  async listCampaigns(actor: AuthUser, status?: EmailCampaignStatus) {
    return this.prisma.emailCampaign.findMany({
      where: {
        organizationId: actor.organizationId,
        OR: [{ branchId: null }, { branchId: { in: actor.branchIds } }],
        ...(status ? { status } : {})
      },
      include: {
        _count: { select: { recipients: true } },
        segment: { select: { name: true, reportCode: true } },
        createdBy: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async getCampaign(actor: AuthUser, id: string) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        OR: [{ branchId: null }, { branchId: { in: actor.branchIds } }]
      },
      include: this.campaignInclude()
    });
    if (!campaign) throw new NotFoundException("Campaña no encontrada");
    const metrics = await this.campaignMetrics(actor, id);
    return { ...campaign, metrics };
  }

  async updateCampaign(actor: AuthUser, id: string, dto: UpdateEmailCampaignDto) {
    const campaign = await this.scopedCampaign(actor, id);
    if (!editableCampaignStatuses.includes(campaign.status))
      throw new ConflictException("La campaña ya no puede editarse");
    const before = this.campaignAuditValue(campaign);
    const updated = await this.prisma.emailCampaign.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        subject: dto.subject?.trim(),
        preheader: dto.preheader?.trim(),
        fromName: dto.fromName?.trim(),
        replyTo: dto.replyTo?.trim().toLowerCase(),
        tags: dto.tags?.map((tag) => tag.trim()).filter(Boolean),
        contentHtmlSnapshot: dto.contentHtml
          ? this.ensureUnsubscribeLink(this.sanitizeHtml(dto.contentHtml))
          : undefined,
        contentTextSnapshot: dto.contentText ? this.ensureUnsubscribeText(dto.contentText.trim()) : undefined,
        version: { increment: 1 }
      }
    });
    await this.audit(
      actor,
      "EmailCampaign",
      id,
      "marketing.campaign_updated",
      before,
      this.campaignAuditValue(updated),
      campaign.branchId ?? undefined
    );
    return this.getCampaign(actor, id);
  }

  async sendTest(actor: AuthUser, id: string, dto: TestEmailCampaignDto) {
    const campaign = await this.scopedCampaign(actor, id);
    const patient = dto.patientId
      ? await this.prisma.patient.findFirst({
          where: {
            id: dto.patientId,
            organizationId: actor.organizationId,
            branchId: { in: actor.branchIds }
          },
          include: { branch: true, organization: true }
        })
      : null;
    const html = this.renderContent(campaign.contentHtmlSnapshot, {
      firstName: patient?.firstName ?? "Paciente de prueba",
      lastName: patient?.lastName ?? "",
      branchName: patient?.branch.name ?? "Sucursal de prueba",
      branchPhone: patient?.branch.phone ?? "",
      branchAddress: patient?.branch.address ?? "",
      organizationName: patient?.organization.name ?? "DentalSuite",
      unsubscribeUrl: "#prueba-no-activa"
    });
    const text = this.renderContent(campaign.contentTextSnapshot, {
      firstName: patient?.firstName ?? "Paciente de prueba",
      lastName: patient?.lastName ?? "",
      branchName: patient?.branch.name ?? "Sucursal de prueba",
      branchPhone: patient?.branch.phone ?? "",
      branchAddress: patient?.branch.address ?? "",
      organizationName: patient?.organization.name ?? "DentalSuite",
      unsubscribeUrl: "#prueba-no-activa"
    });
    const result = await this.email.sendPatientEmail({
      to: dto.email.trim().toLowerCase(),
      replyTo: campaign.replyTo ?? undefined,
      fromAddress: campaign.fromAddress,
      fromName: campaign.fromName,
      subject: `[PRUEBA] ${campaign.subject}`,
      html,
      text
    });
    await this.audit(
      actor,
      "EmailCampaign",
      id,
      "marketing.campaign_test_sent",
      undefined,
      { recipient: dto.email, providerMessageId: result.providerMessageId },
      campaign.branchId ?? undefined
    );
    return { sent: true, providerMessageId: result.providerMessageId };
  }

  async schedule(actor: AuthUser, id: string, dto: ScheduleEmailCampaignDto) {
    const campaign = await this.scopedCampaign(actor, id);
    if (!editableCampaignStatuses.includes(campaign.status))
      throw new ConflictException("La campaña no se puede programar en su estado actual");
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date())
      throw new BadRequestException("La fecha programada debe estar en el futuro");
    await this.assertCampaignReady(actor, campaign);
    const updated = await this.prisma.emailCampaign.update({
      where: { id },
      data: { status: EmailCampaignStatus.SCHEDULED, scheduledAt }
    });
    await this.audit(
      actor,
      "EmailCampaign",
      id,
      "marketing.campaign_scheduled",
      { status: campaign.status },
      { status: updated.status, scheduledAt },
      campaign.branchId ?? undefined
    );
    return this.getCampaign(actor, id);
  }

  async sendNow(actor: AuthUser, id: string) {
    const campaign = await this.scopedCampaign(actor, id);
    if (
      !editableCampaignStatuses.includes(campaign.status) &&
      campaign.status !== EmailCampaignStatus.SCHEDULED
    ) {
      throw new ConflictException("La campaña no se puede encolar en su estado actual");
    }
    await this.assertCampaignReady(actor, campaign);
    const updated = await this.prisma.emailCampaign.update({
      where: { id },
      data: { status: EmailCampaignStatus.QUEUED, scheduledAt: null }
    });
    await this.audit(
      actor,
      "EmailCampaign",
      id,
      "marketing.campaign_started",
      { status: campaign.status },
      { status: updated.status },
      campaign.branchId ?? undefined
    );
    return this.getCampaign(actor, id);
  }

  async cancel(actor: AuthUser, id: string) {
    const campaign = await this.scopedCampaign(actor, id);
    if (
      (
        [
          EmailCampaignStatus.SENT,
          EmailCampaignStatus.ARCHIVED,
          EmailCampaignStatus.CANCELLED
        ] as EmailCampaignStatus[]
      ).includes(campaign.status)
    ) {
      throw new ConflictException("La campaña no se puede cancelar");
    }
    const updated = await this.prisma.emailCampaign.update({
      where: { id },
      data: { status: EmailCampaignStatus.CANCELLED, cancelledAt: new Date() }
    });
    await this.audit(
      actor,
      "EmailCampaign",
      id,
      "marketing.campaign_cancelled",
      { status: campaign.status },
      { status: updated.status },
      campaign.branchId ?? undefined
    );
    return updated;
  }

  async campaignMetrics(actor: AuthUser, id: string) {
    await this.scopedCampaign(actor, id);
    const grouped = await this.prisma.emailCampaignRecipient.groupBy({
      by: ["deliveryStatus"],
      where: { campaignId: id },
      _count: { _all: true }
    });
    const counts = Object.fromEntries(grouped.map((item) => [item.deliveryStatus, item._count._all]));
    return {
      selected: Object.values(counts).reduce((sum, value) => sum + value, 0),
      excluded: counts.ELIGIBILITY_REJECTED ?? 0,
      queued: counts.QUEUED ?? 0,
      sent: counts.SENT ?? 0,
      delivered: counts.DELIVERED ?? 0,
      opened: counts.OPENED ?? 0,
      clicked: counts.CLICKED ?? 0,
      bounced: counts.BOUNCED ?? 0,
      complained: counts.COMPLAINED ?? 0,
      unsubscribed: counts.UNSUBSCRIBED ?? 0,
      failed: counts.FAILED ?? 0,
      skipped: counts.SKIPPED ?? 0
    };
  }

  async listTemplates(actor: AuthUser, search?: string, category?: string) {
    return this.prisma.emailTemplate.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(category ? { category } : {}),
        ...(search?.trim()
          ? {
              OR: [
                { name: { contains: search.trim(), mode: "insensitive" } },
                { subject: { contains: search.trim(), mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });
  }

  async createTemplate(actor: AuthUser, dto: CreateEmailTemplateDto) {
    const html = this.ensureUnsubscribeLink(this.sanitizeHtml(dto.html));
    const template = await this.prisma.emailTemplate.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        category: dto.category.trim().toUpperCase(),
        subject: dto.subject.trim(),
        preheader: dto.preheader?.trim(),
        html,
        text: this.ensureUnsubscribeText(dto.text.trim()),
        status: EmailTemplateStatus.ACTIVE,
        createdById: actor.id
      }
    });
    await this.audit(actor, "EmailTemplate", template.id, "marketing.template_created", undefined, {
      name: template.name,
      version: template.version
    });
    return template;
  }

  async versionTemplate(actor: AuthUser, id: string, dto: CreateEmailTemplateDto) {
    const current = await this.prisma.emailTemplate.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!current) throw new NotFoundException("Plantilla no encontrada");
    const version = await this.prisma.$transaction(async (tx) => {
      await tx.emailTemplate.update({ where: { id }, data: { status: EmailTemplateStatus.ARCHIVED } });
      return tx.emailTemplate.create({
        data: {
          organizationId: actor.organizationId,
          name: dto.name.trim(),
          category: dto.category.trim().toUpperCase(),
          subject: dto.subject.trim(),
          preheader: dto.preheader?.trim(),
          html: this.ensureUnsubscribeLink(this.sanitizeHtml(dto.html)),
          text: this.ensureUnsubscribeText(dto.text.trim()),
          status: EmailTemplateStatus.ACTIVE,
          version: current.version + 1,
          createdById: actor.id
        }
      });
    });
    await this.audit(
      actor,
      "EmailTemplate",
      version.id,
      "marketing.template_updated",
      { id, version: current.version },
      { id: version.id, version: version.version }
    );
    return version;
  }

  async archiveTemplate(actor: AuthUser, id: string) {
    const current = await this.prisma.emailTemplate.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!current) throw new NotFoundException("Plantilla no encontrada");
    return this.prisma.emailTemplate.update({
      where: { id },
      data: { status: EmailTemplateStatus.ARCHIVED }
    });
  }

  getSettings(actor: AuthUser) {
    return this.prisma.marketingSettings.upsert({
      where: { organizationId: actor.organizationId },
      create: { organizationId: actor.organizationId },
      update: {}
    });
  }

  async updateSettings(actor: AuthUser, dto: UpdateMarketingSettingsDto) {
    this.assertTime(dto.sendWindowStart);
    this.assertTime(dto.sendWindowEnd);
    const before = await this.getSettings(actor);
    const updated = await this.prisma.marketingSettings.update({
      where: { organizationId: actor.organizationId },
      data: dto
    });
    await this.audit(actor, "MarketingSettings", updated.id, "marketing.settings_updated", before, updated);
    return updated;
  }

  async senderConfiguration(actor: AuthUser) {
    const [organization, domains, branches, professionals, agreements] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: actor.organizationId },
        select: { name: true, email: true }
      }),
      this.prisma.domainVerification.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.branch.findMany({
        where: {
          organizationId: actor.organizationId,
          id: { in: actor.branchIds },
          status: "ACTIVE",
          deletedAt: null
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      }),
      this.prisma.professional.findMany({
        where: {
          organizationId: actor.organizationId,
          isActive: true
        },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      }),
      this.prisma.agreement.findMany({
        where: { organizationId: actor.organizationId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      })
    ]);
    return {
      organization,
      defaultSender: this.email.getDefaultSender(),
      domains,
      branches,
      professionals,
      agreements
    };
  }

  async createDomain(actor: AuthUser, dto: CreateDomainVerificationDto) {
    const domain = this.normalizeDomain(dto.domain);
    const token = `dentalsuite-verification=${randomUUID()}`;
    const records = [
      { type: "TXT", name: `_dentalsuite-marketing.${domain}`, value: token, purpose: "Verificación" },
      {
        type: "TXT",
        name: domain,
        value: "v=spf1 include:proveedor-correo.example ~all",
        purpose: "SPF; sustituir include por el proveedor configurado"
      },
      {
        type: "TXT",
        name: `_dentalsuite._domainkey.${domain}`,
        value: "Valor DKIM entregado por el proveedor SMTP",
        purpose: "DKIM"
      },
      { type: "TXT", name: `_dmarc.${domain}`, value: "v=DMARC1; p=none;", purpose: "DMARC" }
    ];
    const item = await this.prisma.domainVerification.upsert({
      where: { organizationId_domain: { organizationId: actor.organizationId, domain } },
      create: {
        organizationId: actor.organizationId,
        domain,
        fromName: dto.fromName.trim(),
        fromLocalPart: dto.fromLocalPart?.trim().toLowerCase() || "notificaciones",
        replyTo: dto.replyTo?.trim().toLowerCase(),
        verificationToken: token,
        dnsRecordsJson: this.json(records)
      },
      update: {
        fromName: dto.fromName.trim(),
        fromLocalPart: dto.fromLocalPart?.trim().toLowerCase() || "notificaciones",
        replyTo: dto.replyTo?.trim().toLowerCase(),
        verificationToken: token,
        dnsRecordsJson: this.json(records),
        status: EmailDomainStatus.PENDING,
        verifiedAt: null,
        failureReason: null
      }
    });
    await this.audit(actor, "DomainVerification", item.id, "marketing.domain_created", undefined, { domain });
    return item;
  }

  async verifyDomain(actor: AuthUser, id: string) {
    const domain = await this.prisma.domainVerification.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!domain) throw new NotFoundException("Dominio no encontrado");
    const [verification, root, dkim, dmarc] = await Promise.all([
      this.safeTxt(`_dentalsuite-marketing.${domain.domain}`),
      this.safeTxt(domain.domain),
      this.safeTxt(`_dentalsuite._domainkey.${domain.domain}`),
      this.safeTxt(`_dmarc.${domain.domain}`)
    ]);
    const verified = verification.includes(domain.verificationToken);
    const spf = root.some((value) => value.toLowerCase().startsWith("v=spf1"));
    const hasDkim = dkim.length > 0;
    const hasDmarc = dmarc.some((value) => value.toLowerCase().startsWith("v=dmarc1"));
    const active = verified && spf && hasDkim && hasDmarc;
    const updated = await this.prisma.domainVerification.update({
      where: { id },
      data: {
        status: active ? EmailDomainStatus.VERIFIED : EmailDomainStatus.PENDING,
        spfStatus: spf ? "VERIFIED" : "PENDING",
        dkimStatus: hasDkim ? "VERIFIED" : "PENDING",
        dmarcStatus: hasDmarc ? "VERIFIED" : "PENDING",
        lastCheckedAt: new Date(),
        verifiedAt: active ? new Date() : null,
        failureReason: active ? null : "Faltan registros DNS requeridos o aún no se han propagado"
      }
    });
    await this.audit(
      actor,
      "DomainVerification",
      id,
      "marketing.domain_verified",
      { status: domain.status },
      { status: updated.status, spf: updated.spfStatus, dkim: updated.dkimStatus, dmarc: updated.dmarcStatus }
    );
    return updated;
  }

  async ingestWebhook(provider: string, secret: string | undefined, dto: EmailWebhookDto) {
    const expected = this.config.get<string>("MAIL_WEBHOOK_SECRET");
    if (!expected) throw new ServiceUnavailableException("Webhook de correo no configurado");
    if (!secret || !this.secretsEqual(secret, expected))
      throw new ForbiddenException("Firma de webhook inválida");
    const eventType = this.mapEvent(dto.eventType);
    const recipient = await this.prisma.emailCampaignRecipient.findFirst({
      where: { providerMessageId: dto.providerMessageId },
      include: { campaign: true }
    });
    if (!recipient) throw new NotFoundException("Mensaje del proveedor no reconocido");
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.emailEvent.create({
          data: {
            organizationId: recipient.campaign.organizationId,
            campaignId: recipient.campaignId,
            recipientId: recipient.id,
            providerEventId: `${provider}:${dto.providerEventId}`,
            providerMessageId: dto.providerMessageId,
            eventType,
            occurredAt,
            payloadJson: this.json(dto.payload),
            signatureValid: true
          }
        });
        await tx.emailCampaignRecipient.update({
          where: { id: recipient.id },
          data: this.recipientEventUpdate(eventType, occurredAt)
        });
        if (
          (
            [
              EmailEventType.HARD_BOUNCE,
              EmailEventType.COMPLAINED,
              EmailEventType.UNSUBSCRIBED
            ] as EmailEventType[]
          ).includes(eventType)
        ) {
          const reason =
            eventType === EmailEventType.HARD_BOUNCE
              ? "HARD_BOUNCE"
              : eventType === EmailEventType.COMPLAINED
                ? "SPAM_COMPLAINT"
                : "UNSUBSCRIBED";
          await tx.emailSuppression.upsert({
            where: {
              organizationId_normalizedEmail: {
                organizationId: recipient.campaign.organizationId,
                normalizedEmail: recipient.normalizedEmail
              }
            },
            create: {
              organizationId: recipient.campaign.organizationId,
              normalizedEmail: recipient.normalizedEmail,
              reason,
              source: `WEBHOOK_${provider.toUpperCase()}`
            },
            update: { reason, source: `WEBHOOK_${provider.toUpperCase()}`, expiresAt: null }
          });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return { processed: false, duplicate: true };
      throw error;
    }
    return { processed: true, eventType };
  }

  async unsubscribe(token: string) {
    const recipient = await this.prisma.emailCampaignRecipient.findUnique({
      where: { idempotencyKey: token },
      include: { campaign: true }
    });
    if (!recipient) throw new NotFoundException("Enlace de baja no válido");
    await this.prisma.$transaction(async (tx) => {
      await tx.emailSuppression.upsert({
        where: {
          organizationId_normalizedEmail: {
            organizationId: recipient.campaign.organizationId,
            normalizedEmail: recipient.normalizedEmail
          }
        },
        create: {
          organizationId: recipient.campaign.organizationId,
          normalizedEmail: recipient.normalizedEmail,
          reason: "UNSUBSCRIBED",
          source: "RECIPIENT_LINK"
        },
        update: { reason: "UNSUBSCRIBED", source: "RECIPIENT_LINK", expiresAt: null }
      });
      if (recipient.patientId) {
        await tx.patient.update({
          where: { id: recipient.patientId },
          data: { marketingConsent: MarketingConsentStatus.UNSUBSCRIBED, marketingUnsubscribedAt: new Date() }
        });
      }
      await tx.emailCampaignRecipient.update({
        where: { id: recipient.id },
        data: { deliveryStatus: EmailRecipientStatus.UNSUBSCRIBED, unsubscribedAt: new Date() }
      });
      await tx.auditLog.create({
        data: {
          organizationId: recipient.campaign.organizationId,
          branchId: recipient.branchId,
          action: "marketing.recipient_unsubscribed",
          entity: "EmailCampaignRecipient",
          entityId: recipient.id,
          after: { source: "RECIPIENT_LINK" }
        }
      });
    });
    return { unsubscribed: true };
  }

  renderContent(
    content: string,
    variables: {
      firstName: string;
      lastName: string;
      branchName: string;
      branchPhone: string;
      branchAddress: string;
      organizationName: string;
      unsubscribeUrl: string;
    }
  ) {
    const values: Record<string, string> = {
      "patient.firstName": variables.firstName,
      "patient.lastName": variables.lastName,
      "branch.name": variables.branchName,
      "branch.phone": variables.branchPhone,
      "branch.address": variables.branchAddress,
      "organization.name": variables.organizationName,
      unsubscribeUrl: variables.unsubscribeUrl
    };
    return content.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key: string) =>
      this.escapeVariable(values[key] ?? "")
    );
  }

  private async assertCampaignReady(
    actor: AuthUser,
    campaign: Awaited<ReturnType<EmailMarketingService["scopedCampaign"]>>
  ) {
    const settings = await this.getSettings(actor);
    if (settings.requireVerifiedDomain && campaign.domain) {
      const domain = await this.prisma.domainVerification.findFirst({
        where: {
          organizationId: actor.organizationId,
          domain: campaign.domain,
          status: EmailDomainStatus.VERIFIED
        }
      });
      if (!domain) throw new BadRequestException("El dominio remitente no está verificado");
    }
    if (!campaign.subject.trim() || !campaign.contentHtmlSnapshot.trim())
      throw new BadRequestException("La campaña no tiene asunto o contenido");
    const recipients = await this.prisma.emailCampaignRecipient.findMany({
      where: { campaignId: campaign.id, deliveryStatus: EmailRecipientStatus.PENDING },
      select: { patientId: true }
    });
    const patientIds = recipients.map((item) => item.patientId).filter((id): id is string => Boolean(id));
    const reevaluated = await this.reports.selectedPatients(actor, patientIds, {
      excludeCampaignId: campaign.id,
      reportCode: campaign.reportCodeSnapshot ?? undefined,
      parameters: this.record(campaign.reportParametersJson)
    });
    const eligibility = new Map(reevaluated.eligibility.map((item) => [item.patientId, item]));
    const rejected = recipients.filter(
      (recipient) => !recipient.patientId || !eligibility.get(recipient.patientId)?.eligible
    );
    if (rejected.length) {
      await Promise.all(
        rejected.map((recipient) =>
          recipient.patientId
            ? this.prisma.emailCampaignRecipient.updateMany({
                where: {
                  campaignId: campaign.id,
                  patientId: recipient.patientId,
                  deliveryStatus: EmailRecipientStatus.PENDING
                },
                data: {
                  deliveryStatus: EmailRecipientStatus.SKIPPED,
                  eligibilityStatus: EmailRecipientEligibilityStatus.REJECTED,
                  eligibilityReason:
                    eligibility
                      .get(recipient.patientId)
                      ?.reasons.map((reason) => reason.code)
                      .join(",") || "OUT_OF_SCOPE"
                }
              })
            : Promise.resolve()
        )
      );
    }
    const remaining = await this.prisma.emailCampaignRecipient.count({
      where: { campaignId: campaign.id, deliveryStatus: EmailRecipientStatus.PENDING }
    });
    if (!remaining) throw new BadRequestException("No quedan destinatarios elegibles para enviar");
  }

  private async resolveSender(organizationId: string, requestedName?: string, replyTo?: string) {
    const domain = await this.prisma.domainVerification.findFirst({
      where: { organizationId, status: EmailDomainStatus.VERIFIED },
      orderBy: { verifiedAt: "desc" }
    });
    if (domain)
      return {
        fromName: requestedName?.trim() || domain.fromName,
        fromAddress: `${domain.fromLocalPart}@${domain.domain}`,
        replyTo: replyTo?.trim().toLowerCase() || domain.replyTo,
        domain: domain.domain
      };
    const defaults = this.email.getDefaultSender();
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true, email: true }
    });
    return {
      fromName: requestedName?.trim() || organization.name || defaults.fromName,
      fromAddress: defaults.fromAddress,
      replyTo: replyTo?.trim().toLowerCase() || organization.email,
      domain: null
    };
  }

  private async assertMonthlyCampaignLimit(actor: AuthUser, maximum: number) {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const count = await this.prisma.emailCampaign.count({
      where: {
        organizationId: actor.organizationId,
        createdAt: { gte: start },
        status: { not: EmailCampaignStatus.CANCELLED }
      }
    });
    if (count >= maximum)
      throw new BadRequestException(`Se alcanzó el límite mensual de ${maximum} campañas`);
  }

  private async scopedCampaign(actor: AuthUser, id: string) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        OR: [{ branchId: null }, { branchId: { in: actor.branchIds } }]
      }
    });
    if (!campaign) throw new NotFoundException("Campaña no encontrada");
    return campaign;
  }

  private campaignInclude() {
    return {
      recipients: { orderBy: { selectedAt: "asc" as const }, take: 500 },
      segment: true,
      template: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } }
    };
  }

  private campaignAuditValue(campaign: {
    name: string;
    subject: string;
    preheader: string | null;
    fromName: string;
    replyTo: string | null;
    status: EmailCampaignStatus;
    version: number;
  }) {
    return {
      name: campaign.name,
      subject: campaign.subject,
      preheader: campaign.preheader,
      fromName: campaign.fromName,
      replyTo: campaign.replyTo,
      status: campaign.status,
      version: campaign.version
    };
  }

  private sanitizeHtml(value: string) {
    if (value.length > 500_000) throw new BadRequestException("El contenido HTML supera el tamaño permitido");
    return sanitizeRichTextHtml(value);
  }

  private ensureUnsubscribeLink(html: string) {
    if (html.includes("{{unsubscribeUrl}}")) return html;
    return `${html}<p style="font-size:12px;color:#64748b;text-align:center;margin-top:24px">Si no deseas recibir estos mensajes, <a href="{{unsubscribeUrl}}">date de baja aquí</a>.</p>`;
  }

  private ensureUnsubscribeText(text: string) {
    return text.includes("{{unsubscribeUrl}}")
      ? text
      : `${text}\n\nBaja de comunicaciones: {{unsubscribeUrl}}`;
  }

  private defaultHtml() {
    return "<h1>Hola {{patient.firstName}}</h1><p>Tenemos novedades de {{organization.name}} para ti.</p>";
  }

  private defaultText() {
    return "Hola {{patient.firstName}}, tenemos novedades de {{organization.name}} para ti.";
  }

  private normalizeDomain(value: string) {
    const domain = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain))
      throw new BadRequestException("Dominio no válido");
    return domain;
  }

  private secretsEqual(received: string, expected: string) {
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);
    return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
  }

  private async safeTxt(host: string) {
    try {
      return (await resolveTxt(host)).map((parts) => parts.join(""));
    } catch {
      return [];
    }
  }

  private mapEvent(value: string) {
    const normalized = value.trim().toUpperCase().replace(/-/g, "_");
    const aliases: Record<string, EmailEventType> = {
      BOUNCE: EmailEventType.SOFT_BOUNCE,
      HARD_BOUNCED: EmailEventType.HARD_BOUNCE,
      COMPLAINT: EmailEventType.COMPLAINED,
      UNSUBSCRIBE: EmailEventType.UNSUBSCRIBED
    };
    if (aliases[normalized]) return aliases[normalized];
    if (!Object.values(EmailEventType).includes(normalized as EmailEventType))
      throw new BadRequestException("Evento de correo no soportado");
    return normalized as EmailEventType;
  }

  private recipientEventUpdate(event: EmailEventType, at: Date): Prisma.EmailCampaignRecipientUpdateInput {
    if (event === EmailEventType.DELIVERED)
      return { deliveryStatus: EmailRecipientStatus.DELIVERED, deliveredAt: at };
    if (event === EmailEventType.OPENED) return { deliveryStatus: EmailRecipientStatus.OPENED, openedAt: at };
    if (event === EmailEventType.CLICKED)
      return { deliveryStatus: EmailRecipientStatus.CLICKED, clickedAt: at };
    if (([EmailEventType.SOFT_BOUNCE, EmailEventType.HARD_BOUNCE] as EmailEventType[]).includes(event))
      return { deliveryStatus: EmailRecipientStatus.BOUNCED, bouncedAt: at };
    if (event === EmailEventType.COMPLAINED) return { deliveryStatus: EmailRecipientStatus.COMPLAINED };
    if (event === EmailEventType.UNSUBSCRIBED)
      return { deliveryStatus: EmailRecipientStatus.UNSUBSCRIBED, unsubscribedAt: at };
    if (event === EmailEventType.FAILED)
      return { deliveryStatus: EmailRecipientStatus.FAILED, failureReason: "Proveedor reportó fallo" };
    if (event === EmailEventType.SENT || event === EmailEventType.ACCEPTED)
      return { deliveryStatus: EmailRecipientStatus.SENT, sentAt: at };
    return {};
  }

  private assertTime(value?: string) {
    if (value !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
      throw new BadRequestException("La hora debe usar formato HH:mm");
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private record(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
    if (!value || Array.isArray(value) || typeof value !== "object") return {};
    return value as Record<string, unknown>;
  }

  private optionalString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private escapeVariable(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private async audit(
    actor: AuthUser,
    entity: string,
    entityId: string,
    action: string,
    before?: unknown,
    after?: unknown,
    branchId?: string
  ) {
    return this.auditWith(this.prisma, actor, entity, entityId, action, before, after, branchId);
  }

  private async auditWith(
    client: Prisma.TransactionClient | PrismaService,
    actor: AuthUser,
    entity: string,
    entityId: string,
    action: string,
    before?: unknown,
    after?: unknown,
    branchId?: string
  ) {
    await client.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        branchId,
        userId: actor.id,
        actorUserId: actor.id,
        action,
        entity,
        entityId,
        before: before === undefined ? undefined : this.json(before),
        after: after === undefined ? undefined : this.json(after),
        correlationId: randomUUID()
      }
    });
  }
}
