import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AiRequestStatus,
  CommunicationJobStatus,
  DocumentRequirementStatus,
  ImportJobStatus,
  MessageDeliveryStatus,
  PaymentLinkStatus,
  PaymentWebhookEventStatus,
  Prisma,
  SurveyStatus,
  SurveyType,
  TelemedicineSessionStatus
} from "@prisma/client";
import { randomUUID } from "crypto";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { AuthUser } from "../../common/types/auth-user";
import { branchScope } from "../../common/utils/branch-scope.util";
import { resolvePagination } from "../../common/utils/pagination.util";
import { PrismaService } from "../../database/prisma.service";
import {
  CompleteAiRequestDto,
  CreateAiRequestDto,
  CreateChatMessageDto,
  CreateCommunicationJobDto,
  CreateDocumentRequirementDto,
  CreateImportJobDto,
  CreateSurveyDto,
  CreateTelemedicineSessionDto,
  IngestPaymentWebhookDto,
  ListAiRequestsQueryDto,
  ListChatMessagesQueryDto,
  ListCommunicationJobsQueryDto,
  ListDocumentRequirementsQueryDto,
  ListImportJobsQueryDto,
  ListPaymentWebhookEventsQueryDto,
  ListSurveysQueryDto,
  ListTelemedicineSessionsQueryDto,
  RecordMessageDeliveryDto,
  SatisfyDocumentRequirementDto,
  SubmitSurveyResponseDto,
  UpdateImportJobDto,
  UpdateTelemedicineStatusDto,
  WaiveDocumentRequirementDto
} from "./dto/integrations.dto";
import { ManualAiProvider, ManualNotificationProvider, ManualPaymentProvider } from "./providers/integration-providers";

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notificationProvider: ManualNotificationProvider,
    private readonly paymentProvider: ManualPaymentProvider,
    private readonly aiProvider: ManualAiProvider
  ) {}

  async listCommunicationJobs(actor: AuthUser, query: ListCommunicationJobsQueryDto) {
    const { skip, take, page, pageSize } = resolvePagination(query);
    const where: Prisma.CommunicationJobWhereInput = {
      organizationId: actor.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      OR: [
        { patientId: null, appointmentId: null },
        { patient: { branchId: branchScope(actor) } },
        { appointment: { branchId: branchScope(actor) } }
      ]
    };

    const [items, total] = await Promise.all([
      this.prisma.communicationJob.findMany({
        where,
        include: this.communicationJobInclude(),
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.communicationJob.count({ where })
    ]);

    return { items, total, page, pageSize };
  }

  async createCommunicationJob(actor: AuthUser, dto: CreateCommunicationJobDto) {
    const linkage = await this.resolveCommunicationLinkage(actor, dto);
    const job = await this.prisma.communicationJob.create({
      data: {
        organizationId: actor.organizationId,
        patientId: linkage.patientId,
        appointmentId: dto.appointmentId,
        paymentId: dto.paymentId,
        createdById: actor.id,
        channel: dto.channel,
        templateKey: dto.templateKey?.trim(),
        recipient: dto.recipient.trim(),
        subject: dto.subject?.trim(),
        body: dto.body.trim(),
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        metadata: this.toJson(dto.metadata)
      },
      include: this.communicationJobInclude()
    });

    await this.audit(this.prisma, actor, {
      entity: "CommunicationJob",
      entityId: job.id,
      action: "create",
      after: { channel: job.channel, patientId: job.patientId, appointmentId: job.appointmentId }
    });

    return job;
  }

  async queueCommunicationJob(actor: AuthUser, id: string) {
    const job = await this.getScopedCommunicationJob(actor, id);
    if (job.status !== CommunicationJobStatus.PENDING && job.status !== CommunicationJobStatus.FAILED) {
      throw new BadRequestException("Only pending or failed communication jobs can be queued");
    }

    const queued = await this.notificationProvider.queue({
      channel: job.channel,
      recipient: job.recipient,
      subject: job.subject ?? undefined,
      body: job.body
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.communicationJob.update({
        where: { id },
        data: {
          status: queued.status,
          provider: queued.provider,
          providerMessageId: queued.providerMessageId,
          queuedAt: new Date(),
          failedAt: null,
          errorMessage: null
        }
      });

      await tx.messageDelivery.create({
        data: {
          communicationJobId: id,
          status: MessageDeliveryStatus.QUEUED,
          provider: queued.provider,
          providerMessageId: queued.providerMessageId
        }
      });

      await this.audit(tx, actor, {
        entity: "CommunicationJob",
        entityId: id,
        action: "queue",
        before: { status: job.status },
        after: { status: row.status, provider: row.provider }
      });

      return row;
    });

    return this.prisma.communicationJob.findUniqueOrThrow({
      where: { id: updated.id },
      include: this.communicationJobInclude()
    });
  }

  async recordMessageDelivery(actor: AuthUser, id: string, dto: RecordMessageDeliveryDto) {
    const job = await this.getScopedCommunicationJob(actor, id);
    const now = new Date();
    const jobUpdate = this.deliveryStatusToJobUpdate(dto.status, dto.errorMessage, now);

    const delivery = await this.prisma.$transaction(async (tx) => {
      const created = await tx.messageDelivery.create({
        data: {
          communicationJobId: id,
          status: dto.status,
          provider: dto.provider?.trim() || job.provider,
          providerMessageId: dto.providerMessageId?.trim() || job.providerMessageId,
          rawPayload: this.toJson(dto.rawPayload),
          deliveredAt:
            dto.status === MessageDeliveryStatus.DELIVERED ||
            dto.status === MessageDeliveryStatus.READ ||
            dto.status === MessageDeliveryStatus.RESPONDED
              ? now
              : undefined,
          readAt:
            dto.status === MessageDeliveryStatus.READ || dto.status === MessageDeliveryStatus.RESPONDED
              ? now
              : undefined,
          respondedAt: dto.status === MessageDeliveryStatus.RESPONDED ? now : undefined,
          failedAt: dto.status === MessageDeliveryStatus.FAILED ? now : undefined,
          errorMessage: dto.errorMessage?.trim()
        }
      });

      await tx.communicationJob.update({ where: { id }, data: jobUpdate });
      await this.audit(tx, actor, {
        entity: "MessageDelivery",
        entityId: created.id,
        action: "record",
        after: { communicationJobId: id, status: created.status }
      });

      return created;
    });

    return delivery;
  }

  async listSurveys(actor: AuthUser, query: ListSurveysQueryDto) {
    const { skip, take, page, pageSize } = resolvePagination(query);
    const where: Prisma.SurveyWhereInput = {
      organizationId: actor.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      OR: [{ patientId: null, appointmentId: null }, { patient: { branchId: branchScope(actor) } }, { appointment: { branchId: branchScope(actor) } }]
    };

    const [items, total] = await Promise.all([
      this.prisma.survey.findMany({
        where,
        include: { patient: this.patientSummarySelect(), appointment: { select: { id: true, startAt: true } }, npsResponse: true },
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.survey.count({ where })
    ]);

    return { items, total, page, pageSize };
  }

  async createSurvey(actor: AuthUser, dto: CreateSurveyDto) {
    const linkage = await this.resolveSurveyLinkage(actor, dto.patientId, dto.appointmentId);
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : undefined;
    const survey = await this.prisma.survey.create({
      data: {
        organizationId: actor.organizationId,
        patientId: linkage.patientId,
        appointmentId: dto.appointmentId,
        type: dto.type,
        channel: dto.channel,
        title: dto.title.trim(),
        token: randomUUID(),
        status: scheduledAt ? SurveyStatus.SCHEDULED : SurveyStatus.DRAFT,
        scheduledAt,
        metadata: this.toJson(dto.metadata)
      }
    });

    await this.audit(this.prisma, actor, {
      entity: "Survey",
      entityId: survey.id,
      action: "create",
      after: { type: survey.type, patientId: survey.patientId, status: survey.status }
    });

    return survey;
  }

  async sendSurvey(actor: AuthUser, id: string) {
    const survey = await this.prisma.survey.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        OR: [{ patientId: null }, { patient: { branchId: branchScope(actor) } }]
      },
      include: { patient: true }
    });
    if (!survey) throw new NotFoundException("Survey not found");
    if (survey.status === SurveyStatus.COMPLETED || survey.status === SurveyStatus.CANCELLED) {
      throw new BadRequestException("Completed or cancelled surveys cannot be sent");
    }
    if (!survey.patient) throw new BadRequestException("Survey needs a patient before it can be sent");

    const recipient = this.resolveSurveyRecipient(survey.channel, survey.patient);
    if (!recipient) throw new BadRequestException("Patient does not have a valid recipient for this survey channel");

    const result = await this.prisma.$transaction(async (tx) => {
      const communicationJob = await tx.communicationJob.create({
        data: {
          organizationId: actor.organizationId,
          patientId: survey.patientId,
          appointmentId: survey.appointmentId,
          createdById: actor.id,
          channel: survey.channel,
          templateKey: `survey.${survey.type.toLowerCase()}`,
          recipient,
          subject: survey.title,
          body: `Encuesta: ${survey.title}. Token: ${survey.token}`
        }
      });

      const updatedSurvey = await tx.survey.update({
        where: { id },
        data: { status: SurveyStatus.SENT, sentAt: new Date() }
      });

      await this.audit(tx, actor, {
        entity: "Survey",
        entityId: id,
        action: "send",
        after: { communicationJobId: communicationJob.id, status: updatedSurvey.status }
      });

      return { survey: updatedSurvey, communicationJob };
    });

    return result;
  }

  async submitSurveyResponse(token: string, dto: SubmitSurveyResponseDto) {
    const survey = await this.prisma.survey.findUnique({ where: { token } });
    if (!survey) throw new NotFoundException("Survey not found");
    if (survey.status === SurveyStatus.CANCELLED) throw new BadRequestException("Survey is cancelled");

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.survey.update({
        where: { id: survey.id },
        data: {
          status: SurveyStatus.COMPLETED,
          completedAt: new Date(),
          score: dto.score,
          comment: dto.comment?.trim()
        }
      });

      const npsResponse =
        survey.type === SurveyType.NPS
          ? await tx.npsResponse.upsert({
              where: { surveyId: survey.id },
              create: {
                surveyId: survey.id,
                score: dto.score,
                category: this.npsCategory(dto.score),
                comment: dto.comment?.trim()
              },
              update: {
                score: dto.score,
                category: this.npsCategory(dto.score),
                comment: dto.comment?.trim(),
                respondedAt: new Date()
              }
            })
          : null;

      return { survey: updated, npsResponse };
    });
  }

  async listChatMessages(actor: AuthUser, query: ListChatMessagesQueryDto) {
    const { skip, take, page, pageSize } = resolvePagination(query);
    const where: Prisma.ChatMessageWhereInput = {
      organizationId: actor.organizationId,
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.threadKey ? { threadKey: query.threadKey } : {}),
      OR: [{ patientId: null }, { patient: { branchId: branchScope(actor) } }]
    };

    const [items, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where,
        include: {
          patient: this.patientSummarySelect(),
          senderUser: { select: { id: true, firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.chatMessage.count({ where })
    ]);

    return { items, total, page, pageSize };
  }

  async createChatMessage(actor: AuthUser, dto: CreateChatMessageDto) {
    if (dto.patientId) await this.ensurePatient(actor, dto.patientId);
    const message = await this.prisma.chatMessage.create({
      data: {
        organizationId: actor.organizationId,
        patientId: dto.patientId,
        senderUserId: actor.id,
        body: dto.body.trim(),
        threadKey: dto.threadKey?.trim() || (dto.patientId ? `patient:${dto.patientId}` : "organization"),
        metadata: this.toJson(dto.metadata)
      },
      include: {
        patient: this.patientSummarySelect(),
        senderUser: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    return message;
  }

  async createTelemedicineSession(actor: AuthUser, dto: CreateTelemedicineSessionDto) {
    await this.ensurePatient(actor, dto.patientId);
    if (dto.appointmentId) await this.ensureAppointment(actor, dto.appointmentId, dto.patientId);
    if (dto.professionalId) await this.ensureProfessional(actor, dto.professionalId);

    const session = await this.prisma.telemedicineSession.create({
      data: {
        organizationId: actor.organizationId,
        patientId: dto.patientId,
        appointmentId: dto.appointmentId,
        professionalId: dto.professionalId,
        provider: dto.provider?.trim() || "manual",
        joinUrl: dto.joinUrl?.trim(),
        startsAt: new Date(dto.startsAt),
        notes: dto.notes?.trim(),
        metadata: this.toJson(dto.metadata)
      }
    });

    await this.audit(this.prisma, actor, {
      entity: "TelemedicineSession",
      entityId: session.id,
      action: "create",
      after: { patientId: session.patientId, startsAt: session.startsAt.toISOString() }
    });

    return session;
  }

  async listTelemedicineSessions(actor: AuthUser, query: ListTelemedicineSessionsQueryDto) {
    const { skip, take, page, pageSize } = resolvePagination(query);
    const where: Prisma.TelemedicineSessionWhereInput = {
      organizationId: actor.organizationId,
      patient: { branchId: branchScope(actor) },
      ...(query.status ? { status: query.status } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {})
    };

    const [items, total] = await Promise.all([
      this.prisma.telemedicineSession.findMany({
        where,
        include: {
          patient: this.patientSummarySelect(),
          appointment: { select: { id: true, startAt: true, status: true } },
          professional: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { startsAt: "desc" },
        skip,
        take
      }),
      this.prisma.telemedicineSession.count({ where })
    ]);

    return { items, total, page, pageSize };
  }

  async updateTelemedicineStatus(actor: AuthUser, id: string, dto: UpdateTelemedicineStatusDto) {
    const session = await this.prisma.telemedicineSession.findFirst({
      where: { id, organizationId: actor.organizationId, patient: { branchId: branchScope(actor) } }
    });
    if (!session) throw new NotFoundException("Telemedicine session not found");

    const now = new Date();
    const updated = await this.prisma.telemedicineSession.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes?.trim() ?? undefined,
        startedAt: dto.status === TelemedicineSessionStatus.STARTED ? now : undefined,
        endedAt:
          dto.status === TelemedicineSessionStatus.COMPLETED || dto.status === TelemedicineSessionStatus.CANCELLED
            ? now
            : undefined
      }
    });

    await this.audit(this.prisma, actor, {
      entity: "TelemedicineSession",
      entityId: id,
      action: "status_update",
      before: { status: session.status },
      after: { status: updated.status }
    });

    return updated;
  }

  async listImportJobs(actor: AuthUser, query: ListImportJobsQueryDto) {
    const { skip, take, page, pageSize } = resolvePagination(query);
    const where: Prisma.ImportJobWhereInput = {
      organizationId: actor.organizationId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {})
    };

    const [items, total] = await Promise.all([
      this.prisma.importJob.findMany({
        where,
        include: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.importJob.count({ where })
    ]);

    return { items, total, page, pageSize };
  }

  async createImportJob(actor: AuthUser, dto: CreateImportJobDto) {
    return this.prisma.importJob.create({
      data: {
        organizationId: actor.organizationId,
        createdById: actor.id,
        type: dto.type,
        fileName: dto.fileName?.trim(),
        summary: this.toJson(dto.summary)
      }
    });
  }

  async updateImportJob(actor: AuthUser, id: string, dto: UpdateImportJobDto) {
    const current = await this.prisma.importJob.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!current) throw new NotFoundException("Import job not found");

    const totalRows = dto.totalRows ?? current.totalRows;
    const successRows = dto.successRows ?? current.successRows;
    const errorRows = dto.errorRows ?? current.errorRows;
    if (totalRows > 0 && successRows + errorRows > totalRows) {
      throw new BadRequestException("Successful and failed rows cannot exceed total rows");
    }

    const now = new Date();
    return this.prisma.importJob.update({
      where: { id },
      data: {
        status: dto.status,
        totalRows: dto.totalRows,
        successRows: dto.successRows,
        errorRows: dto.errorRows,
        summary: this.toJson(dto.summary),
        errors: this.toJson(dto.errors),
        startedAt: dto.status === ImportJobStatus.PROCESSING && !current.startedAt ? now : undefined,
        completedAt: this.isTerminalImportStatus(dto.status ?? current.status) ? now : undefined
      }
    });
  }

  async listDocumentRequirements(actor: AuthUser, query: ListDocumentRequirementsQueryDto) {
    const { skip, take, page, pageSize } = resolvePagination(query);
    const where: Prisma.DocumentRequirementWhereInput = {
      organizationId: actor.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.treatmentPlanId ? { treatmentPlanId: query.treatmentPlanId } : {}),
      OR: [{ patientId: null, treatmentPlanId: null }, { patient: { branchId: branchScope(actor) } }, { treatmentPlan: { branchId: branchScope(actor) } }]
    };

    const [items, total] = await Promise.all([
      this.prisma.documentRequirement.findMany({
        where,
        include: {
          patient: this.patientSummarySelect(),
          treatmentPlan: { select: { id: true, name: true, status: true } },
          procedure: { select: { id: true, code: true, name: true } },
          clinicalDocument: { select: { id: true, title: true, status: true } },
          consent: { select: { id: true, status: true, signedAt: true } },
          fileAttachment: { select: { id: true, originalName: true, category: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.documentRequirement.count({ where })
    ]);

    return { items, total, page, pageSize };
  }

  async createDocumentRequirement(actor: AuthUser, dto: CreateDocumentRequirementDto) {
    if (!dto.patientId && !dto.treatmentPlanId && !dto.procedureId) {
      throw new BadRequestException("A document requirement needs patient, treatment plan, or procedure scope");
    }

    const patientId = await this.resolveRequirementPatientId(actor, dto.patientId, dto.treatmentPlanId);
    if (dto.procedureId) await this.ensureProcedure(actor, dto.procedureId);

    const requirement = await this.prisma.documentRequirement.create({
      data: {
        organizationId: actor.organizationId,
        patientId,
        treatmentPlanId: dto.treatmentPlanId,
        procedureId: dto.procedureId,
        createdById: actor.id,
        scope: dto.scope,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        requiredBefore: dto.requiredBefore?.trim(),
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        metadata: this.toJson(dto.metadata)
      }
    });

    await this.audit(this.prisma, actor, {
      entity: "DocumentRequirement",
      entityId: requirement.id,
      action: "create",
      after: { patientId: requirement.patientId, treatmentPlanId: requirement.treatmentPlanId, status: requirement.status }
    });

    return requirement;
  }

  async satisfyDocumentRequirement(actor: AuthUser, id: string, dto: SatisfyDocumentRequirementDto) {
    const requirement = await this.getScopedDocumentRequirement(actor, id);
    if (
      requirement.status !== DocumentRequirementStatus.PENDING &&
      requirement.status !== DocumentRequirementStatus.WAIVED
    ) {
      throw new BadRequestException("Only pending or waived requirements can be satisfied");
    }
    if (!dto.clinicalDocumentId && !dto.consentId && !dto.fileAttachmentId) {
      throw new BadRequestException("A clinical document, consent, or file is required to satisfy this requirement");
    }

    await this.validateRequirementArtifacts(actor, requirement.patientId, dto);
    const updated = await this.prisma.documentRequirement.update({
      where: { id },
      data: {
        clinicalDocumentId: dto.clinicalDocumentId,
        consentId: dto.consentId,
        fileAttachmentId: dto.fileAttachmentId,
        status: DocumentRequirementStatus.SATISFIED,
        satisfiedAt: new Date(),
        waivedAt: null,
        waivedById: null,
        waiverReason: null
      }
    });

    await this.audit(this.prisma, actor, {
      entity: "DocumentRequirement",
      entityId: id,
      action: "satisfy",
      before: { status: requirement.status },
      after: { status: updated.status }
    });

    return updated;
  }

  async waiveDocumentRequirement(actor: AuthUser, id: string, dto: WaiveDocumentRequirementDto) {
    const requirement = await this.getScopedDocumentRequirement(actor, id);
    if (requirement.status === DocumentRequirementStatus.SATISFIED) {
      throw new BadRequestException("Satisfied requirements cannot be waived");
    }

    const updated = await this.prisma.documentRequirement.update({
      where: { id },
      data: {
        status: DocumentRequirementStatus.WAIVED,
        waivedAt: new Date(),
        waivedById: actor.id,
        waiverReason: dto.reason.trim()
      }
    });

    await this.audit(this.prisma, actor, {
      entity: "DocumentRequirement",
      entityId: id,
      action: "waive",
      before: { status: requirement.status },
      after: { status: updated.status, reason: updated.waiverReason }
    });

    return updated;
  }

  async ingestPaymentWebhook(provider: string, dto: IngestPaymentWebhookDto, providedSecret?: string) {
    const expectedSecret = this.config.get<string>("PAYMENT_WEBHOOK_SECRET");
    const isProduction = this.config.get<string>("NODE_ENV") === "production";
    if (isProduction && !expectedSecret) throw new UnauthorizedException("Payment webhook secret is required");
    if (!this.paymentProvider.validateWebhookSecret(expectedSecret, providedSecret)) {
      throw new UnauthorizedException("Invalid payment webhook secret");
    }

    const normalizedProvider = provider.trim().toLowerCase();
    const idempotencyKey = (dto.idempotencyKey || dto.eventId).trim();
    const duplicate = await this.prisma.paymentWebhookEvent.findUnique({
      where: { provider_idempotencyKey: { provider: normalizedProvider, idempotencyKey } }
    });
    if (duplicate) return { event: duplicate, duplicate: true };

    const paymentLink = dto.paymentLinkId
      ? await this.prisma.paymentLink.findUnique({ where: { id: dto.paymentLinkId } })
      : null;
    const payment = dto.paymentId ? await this.prisma.payment.findUnique({ where: { id: dto.paymentId } }) : null;
    const organizationId = paymentLink?.organizationId ?? payment?.organizationId;
    if (!organizationId) throw new BadRequestException("Webhook must reference a known payment link or payment");

    const shouldMarkLinkPaid =
      paymentLink &&
      (dto.linkStatus === PaymentLinkStatus.PAID ||
        ["payment.paid", "payment.succeeded", "checkout.session.completed"].includes(dto.eventType.toLowerCase()));

    const result = await this.prisma.$transaction(async (tx) => {
      if (shouldMarkLinkPaid && paymentLink.status !== PaymentLinkStatus.PAID) {
        await tx.paymentLink.update({
          where: { id: paymentLink.id },
          data: { status: PaymentLinkStatus.PAID, paidAt: new Date() }
        });
      }

      const event = await tx.paymentWebhookEvent.create({
        data: {
          organizationId,
          paymentLinkId: paymentLink?.id,
          paymentId: payment?.id,
          provider: normalizedProvider,
          eventId: dto.eventId.trim(),
          eventType: dto.eventType.trim(),
          idempotencyKey,
          status: shouldMarkLinkPaid ? PaymentWebhookEventStatus.PROCESSED : PaymentWebhookEventStatus.IGNORED,
          payload: this.toJson(dto.payload ?? {}) ?? {},
          processedAt: new Date()
        }
      });

      return event;
    });

    return { event: result, duplicate: false };
  }

  async listPaymentWebhookEvents(actor: AuthUser, query: ListPaymentWebhookEventsQueryDto) {
    const { skip, take, page, pageSize } = resolvePagination(query);
    const where: Prisma.PaymentWebhookEventWhereInput = {
      organizationId: actor.organizationId,
      ...(query.provider ? { provider: query.provider.trim().toLowerCase() } : {}),
      ...(query.paymentLinkId ? { paymentLinkId: query.paymentLinkId } : {}),
      OR: [{ paymentLink: { patient: { branchId: branchScope(actor) } } }, { payment: { branchId: branchScope(actor) } }]
    };

    const [items, total] = await Promise.all([
      this.prisma.paymentWebhookEvent.findMany({ where, orderBy: { receivedAt: "desc" }, skip, take }),
      this.prisma.paymentWebhookEvent.count({ where })
    ]);

    return { items, total, page, pageSize };
  }

  async listAiRequests(actor: AuthUser, query: ListAiRequestsQueryDto) {
    const { skip, take, page, pageSize } = resolvePagination(query);
    const where: Prisma.AiRequestWhereInput = {
      organizationId: actor.organizationId,
      ...(query.useCase ? { useCase: query.useCase } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      OR: [{ patientId: null }, { patient: { branchId: branchScope(actor) } }]
    };

    const [items, total] = await Promise.all([
      this.prisma.aiRequest.findMany({
        where,
        include: { patient: this.patientSummarySelect(), result: true },
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.aiRequest.count({ where })
    ]);

    return { items, total, page, pageSize };
  }

  async createAiRequest(actor: AuthUser, dto: CreateAiRequestDto) {
    if (dto.patientId) await this.ensurePatient(actor, dto.patientId);
    const providerStart = await this.aiProvider.start(dto.provider);

    const request = await this.prisma.aiRequest.create({
      data: {
        organizationId: actor.organizationId,
        patientId: dto.patientId,
        requestedById: actor.id,
        useCase: dto.useCase,
        provider: providerStart.provider,
        prompt: dto.prompt?.trim(),
        input: this.toJson(dto.input),
        status: providerStart.status
      }
    });

    await this.audit(this.prisma, actor, {
      entity: "AiRequest",
      entityId: request.id,
      action: "create",
      after: { useCase: request.useCase, status: request.status, provider: request.provider }
    });

    return request;
  }

  async completeAiRequest(actor: AuthUser, id: string, dto: CompleteAiRequestDto) {
    const request = await this.prisma.aiRequest.findFirst({
      where: { id, organizationId: actor.organizationId, OR: [{ patientId: null }, { patient: { branchId: branchScope(actor) } }] }
    });
    if (!request) throw new NotFoundException("AI request not found");
    if (request.status === AiRequestStatus.CANCELLED) throw new BadRequestException("Cancelled AI requests cannot be completed");

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.aiResult.upsert({
        where: { aiRequestId: id },
        create: {
          organizationId: actor.organizationId,
          aiRequestId: id,
          output: this.toJson(dto.output) ?? {},
          summary: dto.summary?.trim(),
          confidence: dto.confidence
        },
        update: {
          output: this.toJson(dto.output) ?? {},
          summary: dto.summary?.trim(),
          confidence: dto.confidence
        }
      });

      const updated = await tx.aiRequest.update({
        where: { id },
        data: { status: AiRequestStatus.COMPLETED, errorMessage: null }
      });

      await this.audit(tx, actor, {
        entity: "AiRequest",
        entityId: id,
        action: "complete",
        before: { status: request.status },
        after: { status: updated.status, aiResultId: result.id }
      });

      return { request: updated, result };
    });
  }

  private communicationJobInclude() {
    return {
      patient: this.patientSummarySelect(),
      appointment: { select: { id: true, startAt: true, status: true } },
      payment: { select: { id: true, amount: true, status: true } },
      deliveries: { orderBy: { createdAt: "desc" as const } }
    };
  }

  private patientSummarySelect() {
    return { select: { id: true, firstName: true, lastName: true, email: true, phone: true, branchId: true } };
  }

  private async resolveCommunicationLinkage(actor: AuthUser, dto: CreateCommunicationJobDto) {
    const patient = dto.patientId ? await this.ensurePatient(actor, dto.patientId) : null;
    const appointment = dto.appointmentId ? await this.ensureAppointment(actor, dto.appointmentId, dto.patientId) : null;
    if (dto.paymentId) await this.ensurePayment(actor, dto.paymentId);
    return { patientId: patient?.id ?? appointment?.patientId ?? undefined };
  }

  private async resolveSurveyLinkage(actor: AuthUser, patientId?: string, appointmentId?: string) {
    const patient = patientId ? await this.ensurePatient(actor, patientId) : null;
    const appointment = appointmentId ? await this.ensureAppointment(actor, appointmentId, patientId) : null;
    return { patientId: patient?.id ?? appointment?.patientId ?? undefined };
  }

  private async ensurePatient(actor: AuthUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: actor.organizationId, branchId: branchScope(actor), deletedAt: null }
    });
    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
  }

  private async ensureAppointment(actor: AuthUser, appointmentId: string, expectedPatientId?: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId: actor.organizationId, branchId: branchScope(actor) }
    });
    if (!appointment) throw new NotFoundException("Appointment not found");
    if (expectedPatientId && appointment.patientId && appointment.patientId !== expectedPatientId) {
      throw new BadRequestException("Appointment does not belong to the selected patient");
    }
    return appointment;
  }

  private async ensurePayment(actor: AuthUser, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId: actor.organizationId, branchId: branchScope(actor) }
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return payment;
  }

  private async ensureProfessional(actor: AuthUser, professionalId: string) {
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, organizationId: actor.organizationId, isActive: true }
    });
    if (!professional) throw new NotFoundException("Professional not found");
    return professional;
  }

  private async ensureProcedure(actor: AuthUser, procedureId: string) {
    const procedure = await this.prisma.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId, isActive: true }
    });
    if (!procedure) throw new NotFoundException("Procedure not found");
    return procedure;
  }

  private async resolveRequirementPatientId(actor: AuthUser, patientId?: string, treatmentPlanId?: string) {
    if (patientId) await this.ensurePatient(actor, patientId);
    if (!treatmentPlanId) return patientId;

    const treatmentPlan = await this.prisma.treatmentPlan.findFirst({
      where: { id: treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      select: { id: true, patientId: true }
    });
    if (!treatmentPlan) throw new NotFoundException("Treatment plan not found");
    if (patientId && treatmentPlan.patientId !== patientId) {
      throw new BadRequestException("Treatment plan does not belong to the selected patient");
    }
    return treatmentPlan.patientId;
  }

  private async getScopedCommunicationJob(actor: AuthUser, id: string) {
    const job = await this.prisma.communicationJob.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        OR: [
          { patientId: null, appointmentId: null },
          { patient: { branchId: branchScope(actor) } },
          { appointment: { branchId: branchScope(actor) } }
        ]
      }
    });
    if (!job) throw new NotFoundException("Communication job not found");
    return job;
  }

  private async getScopedDocumentRequirement(actor: AuthUser, id: string) {
    const requirement = await this.prisma.documentRequirement.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        OR: [
          { patientId: null, treatmentPlanId: null },
          { patient: { branchId: branchScope(actor) } },
          { treatmentPlan: { branchId: branchScope(actor) } }
        ]
      }
    });
    if (!requirement) throw new NotFoundException("Document requirement not found");
    return requirement;
  }

  private async validateRequirementArtifacts(
    actor: AuthUser,
    patientId: string | null,
    dto: SatisfyDocumentRequirementDto
  ) {
    if (dto.clinicalDocumentId) {
      const document = await this.prisma.clinicalDocument.findFirst({
        where: { id: dto.clinicalDocumentId, patient: { organizationId: actor.organizationId, branchId: branchScope(actor) } }
      });
      if (!document || (patientId && document.patientId !== patientId)) throw new BadRequestException("Invalid clinical document");
    }

    if (dto.consentId) {
      const consent = await this.prisma.consent.findFirst({
        where: { id: dto.consentId, patient: { organizationId: actor.organizationId, branchId: branchScope(actor) } }
      });
      if (!consent || (patientId && consent.patientId !== patientId)) throw new BadRequestException("Invalid consent");
    }

    if (dto.fileAttachmentId) {
      const file = await this.prisma.fileAttachment.findFirst({
        where: {
          id: dto.fileAttachmentId,
          organizationId: actor.organizationId,
          patient: { branchId: branchScope(actor) },
          deletedAt: null
        }
      });
      if (!file || (patientId && file.patientId !== patientId)) throw new BadRequestException("Invalid file attachment");
    }
  }

  private deliveryStatusToJobUpdate(
    status: MessageDeliveryStatus,
    errorMessage: string | undefined,
    now: Date
  ): Prisma.CommunicationJobUpdateInput {
    if (status === MessageDeliveryStatus.FAILED) {
      return { status: CommunicationJobStatus.FAILED, failedAt: now, errorMessage: errorMessage?.trim() };
    }
    if (status === MessageDeliveryStatus.QUEUED) {
      return { status: CommunicationJobStatus.QUEUED, queuedAt: now };
    }
    return { status: CommunicationJobStatus.SENT, sentAt: now, failedAt: null, errorMessage: null };
  }

  private resolveSurveyRecipient(channel: string, patient: { email: string | null; phone: string | null }) {
    if (channel === "EMAIL") return patient.email?.trim();
    if (["WHATSAPP", "SMS", "PHONE"].includes(channel)) return patient.phone?.trim();
    return patient.email?.trim() || patient.phone?.trim();
  }

  private npsCategory(score: number) {
    if (score >= 9) return "PROMOTER";
    if (score >= 7) return "PASSIVE";
    return "DETRACTOR";
  }

  private isTerminalImportStatus(status: ImportJobStatus) {
    return (
      status === ImportJobStatus.COMPLETED ||
      status === ImportJobStatus.FAILED ||
      status === ImportJobStatus.CANCELLED
    );
  }

  private toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
    return value === undefined ? undefined : (value as Prisma.InputJsonValue);
  }

  private async audit(
    tx: Prisma.TransactionClient | PrismaService,
    actor: AuthUser,
    payload: {
      entity: string;
      entityId?: string;
      action: string;
      before?: Prisma.InputJsonValue;
      after?: Prisma.InputJsonValue;
    }
  ) {
    await tx.auditLog.create({
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
