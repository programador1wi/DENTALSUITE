import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import {
  CommunicationChannel,
  MarketingConsentStatus,
  Prisma,
  SurveyDefinitionStatus,
  SurveyDeliveryEventType,
  SurveyInvitationStatus,
  SurveyQuestionType,
  SurveyResponseStatus,
  SurveyType,
  SurveyVersionStatus
} from "@prisma/client";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  CreateSurveyDefinitionDto,
  CreateSurveyQuestionDto,
  CreateSurveySectionDto,
  ListSurveyDefinitionsQueryDto,
  RecordSurveyDeliveryDto,
  ReorderSurveyItemsDto,
  SubmitPublicSurveyDto,
  SurveyPublicAnswerDto,
  SurveyResultsQueryDto,
  UpdateSurveyDefinitionDto,
  UpdateSurveyQuestionDto,
  UpdateSurveySectionDto,
  UpdateSurveySendConfigurationDto
} from "./dto/crm-surveys.dto";

const DEFAULT_NAME = "Encuesta sin nombre";
const ALLOWED_VARIABLES = new Set([
  "nombrePaciente",
  "apellidosPaciente",
  "fechaAtencion",
  "horaAtencion",
  "nombreSucursal",
  "direccionSucursal",
  "telefonoSucursal",
  "nombreProfesional",
  "nombreOrganizacion",
  "enlaceEncuesta"
]);

const OPTION_TYPES = new Set<SurveyQuestionType>([
  SurveyQuestionType.LIKERT_5,
  SurveyQuestionType.NPS_10,
  SurveyQuestionType.YES_NO,
  SurveyQuestionType.SINGLE_CHOICE,
  SurveyQuestionType.MULTIPLE_CHOICE,
  SurveyQuestionType.STAR_RATING
]);

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class CrmSurveysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async list(actor: AuthUser, query: ListSurveyDefinitionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    if (query.branchId) this.assertBranch(actor, query.branchId);
    const where: Prisma.SurveyDefinitionWhereInput = {
      ...this.scope(actor),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.search
        ? { name: { contains: query.search.trim(), mode: Prisma.QueryMode.insensitive } }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.surveyDefinition.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { invitations: true, responses: true } },
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { id: true, version: true, status: true, publishedAt: true }
          }
        }
      }),
      this.prisma.surveyDefinition.count({ where })
    ]);
    const creatorIds = [...new Set(items.map((item) => item.createdById))];
    const creators = await this.prisma.user.findMany({
      where: { id: { in: creatorIds }, organizationId: actor.organizationId },
      select: { id: true, firstName: true, lastName: true }
    });
    const creatorById = new Map(creators.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]));
    return {
      items: items.map((item) => ({
        ...item,
        createdByName: creatorById.get(item.createdById) ?? "Usuario",
        invitationCount: item._count.invitations,
        responseCount: item._count.responses,
        _count: undefined
      })),
      total,
      page,
      pageSize
    };
  }

  async create(actor: AuthUser, dto: CreateSurveyDefinitionDto) {
    if (dto.branchId) this.assertBranch(actor, dto.branchId);
    const created = await this.prisma.$transaction(async (tx) => {
      const survey = await tx.surveyDefinition.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          type: dto.type ?? SurveyType.SATISFACTION,
          name: DEFAULT_NAME,
          createdById: actor.id,
          updatedById: actor.id,
          versions: { create: { version: 1 } }
        }
      });
      await this.auditWith(tx, actor, "survey.created", "SurveyDefinition", survey.id, undefined, {
        type: survey.type,
        branchId: survey.branchId
      });
      return survey;
    });
    return this.get(actor, created.id);
  }

  async get(actor: AuthUser, id: string) {
    const survey = await this.prisma.surveyDefinition.findFirst({
      where: { id, ...this.scope(actor) },
      include: {
        versions: {
          orderBy: { version: "desc" },
          include: {
            sections: {
              orderBy: { position: "asc" },
              include: {
                questions: {
                  orderBy: { position: "asc" },
                  include: { options: { orderBy: { position: "asc" } } }
                }
              }
            }
          }
        },
        sendConfiguration: true,
        _count: { select: { invitations: true, responses: true } }
      }
    });
    if (!survey) throw new NotFoundException("Encuesta no encontrada");
    const draftVersion = survey.versions.find((version) => version.status === SurveyVersionStatus.DRAFT);
    const activeVersion = survey.versions.find((version) => version.id === survey.activeVersionId);
    return {
      ...survey,
      draftVersion: draftVersion ?? null,
      activeVersion: activeVersion ?? null,
      editorVersion: draftVersion ?? activeVersion ?? survey.versions[0] ?? null,
      invitationCount: survey._count.invitations,
      responseCount: survey._count.responses,
      _count: undefined
    };
  }

  async prepareDraft(actor: AuthUser, id: string) {
    const current = await this.get(actor, id);
    if (current.status === SurveyDefinitionStatus.ARCHIVED) {
      throw new ConflictException("Una encuesta archivada no se puede editar");
    }
    if (current.draftVersion) return current;
    const source = current.activeVersion ?? current.versions[0];
    if (!source) throw new ConflictException("La encuesta no tiene una versión base");
    await this.prisma.$transaction(async (tx) => {
      const version = await tx.surveyVersion.create({
        data: {
          surveyId: current.id,
          version: Math.max(...current.versions.map((item) => item.version), 0) + 1,
          emailSubject: source.emailSubject,
          emailHeaderHtml: source.emailHeaderHtml,
          emailFooterHtml: source.emailFooterHtml,
          sections: {
            create: source.sections.map((section) => ({
              name: section.name,
              description: section.description,
              position: section.position,
              questions: {
                create: section.questions.map((question) => ({
                  text: question.text,
                  description: question.description,
                  type: question.type,
                  isRequired: question.isRequired,
                  position: question.position,
                  validationJson: question.validationJson ?? undefined,
                  options: {
                    create: question.options.map((option) => ({
                      label: option.label,
                      value: option.value,
                      position: option.position
                    }))
                  }
                }))
              }
            }))
          }
        }
      });
      await tx.surveyDefinition.update({ where: { id }, data: { updatedById: actor.id } });
      await this.auditWith(tx, actor, "survey.version_created", "SurveyVersion", version.id, undefined, {
        surveyId: id,
        sourceVersionId: source.id,
        version: version.version
      });
    });
    return this.get(actor, id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateSurveyDefinitionDto) {
    const current = await this.get(actor, id);
    if (current.status === SurveyDefinitionStatus.ARCHIVED) {
      throw new ConflictException("Una encuesta archivada no se puede modificar");
    }
    if (dto.branchId) this.assertBranch(actor, dto.branchId);
    const versionFieldsChanged =
      dto.emailSubject !== undefined || dto.emailHeaderHtml !== undefined || dto.emailFooterHtml !== undefined;
    let draft = current.draftVersion;
    if (versionFieldsChanged && !draft) {
      const prepared = await this.prepareDraft(actor, id);
      draft = prepared.draftVersion;
    }
    if (versionFieldsChanged && !draft) throw new ConflictException("No fue posible preparar una versión editable");

    const before = {
      name: current.name,
      type: current.type,
      branchId: current.branchId,
      emailSubject: draft?.emailSubject,
      emailHeaderHtml: draft?.emailHeaderHtml,
      emailFooterHtml: draft?.emailFooterHtml
    };
    await this.prisma.$transaction(async (tx) => {
      const definitionData: Prisma.SurveyDefinitionUpdateInput = { updatedById: actor.id };
      if (dto.name !== undefined) definitionData.name = dto.name.trim().slice(0, 160);
      if (dto.type !== undefined) definitionData.type = dto.type;
      if (dto.branchId !== undefined) definitionData.branchId = dto.branchId || null;
      await tx.surveyDefinition.update({ where: { id }, data: definitionData });
      if (draft && versionFieldsChanged) {
        const versionData: Prisma.SurveyVersionUpdateInput = {};
        if (dto.emailSubject !== undefined) {
          const subject = this.sanitizePlain(dto.emailSubject).slice(0, 180);
          this.assertVariables(subject);
          versionData.emailSubject = subject;
        }
        if (dto.emailHeaderHtml !== undefined) {
          const html = this.sanitizeHtml(dto.emailHeaderHtml);
          this.assertVariables(html);
          versionData.emailHeaderHtml = html;
        }
        if (dto.emailFooterHtml !== undefined) {
          const html = this.sanitizeHtml(dto.emailFooterHtml);
          this.assertVariables(html);
          versionData.emailFooterHtml = html;
        }
        await tx.surveyVersion.update({ where: { id: draft.id }, data: versionData });
      }
      await this.auditWith(tx, actor, "survey.updated", "SurveyDefinition", id, before, dto);
    });
    return this.get(actor, id);
  }

  async duplicate(actor: AuthUser, id: string) {
    const source = await this.get(actor, id);
    const version = source.editorVersion;
    if (!version) throw new ConflictException("La encuesta no tiene contenido para duplicar");
    const created = await this.prisma.$transaction(async (tx) => {
      const copy = await tx.surveyDefinition.create({
        data: {
          organizationId: actor.organizationId,
          branchId: source.branchId,
          name: `${source.name} (copia)`.slice(0, 160),
          type: source.type,
          channel: source.channel,
          createdById: actor.id,
          updatedById: actor.id,
          versions: {
            create: {
              version: 1,
              emailSubject: version.emailSubject,
              emailHeaderHtml: version.emailHeaderHtml,
              emailFooterHtml: version.emailFooterHtml,
              sections: {
                create: version.sections.map((section) => ({
                  name: section.name,
                  description: section.description,
                  position: section.position,
                  questions: {
                    create: section.questions.map((question) => ({
                      text: question.text,
                      description: question.description,
                      type: question.type,
                      isRequired: question.isRequired,
                      position: question.position,
                      validationJson: question.validationJson ?? undefined,
                      options: {
                        create: question.options.map((option) => ({
                          label: option.label,
                          value: option.value,
                          position: option.position
                        }))
                      }
                    }))
                  }
                }))
              }
            }
          }
        }
      });
      await this.auditWith(tx, actor, "survey.created", "SurveyDefinition", copy.id, undefined, {
        duplicatedFrom: id
      });
      return copy;
    });
    return this.get(actor, created.id);
  }

  async activate(actor: AuthUser, id: string) {
    const current = await this.get(actor, id);
    if (!current.draftVersion) throw new ConflictException("No existe una versión borrador para publicar");
    const draftVersion = current.draftVersion;
    this.validateForActivation(current, draftVersion);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.surveyDefinition.updateMany({
        where: {
          organizationId: actor.organizationId,
          id: { not: id },
          branchId: current.branchId,
          type: current.type,
          channel: current.channel,
          status: SurveyDefinitionStatus.ACTIVE
        },
        data: { status: SurveyDefinitionStatus.INACTIVE, deactivatedAt: now, updatedById: actor.id }
      });
      if (current.activeVersionId) {
        await tx.surveyVersion.update({
          where: { id: current.activeVersionId },
          data: { status: SurveyVersionStatus.SUPERSEDED }
        });
      }
      await tx.surveyVersion.update({
        where: { id: draftVersion.id },
        data: { status: SurveyVersionStatus.PUBLISHED, publishedAt: now, publishedById: actor.id }
      });
      await tx.surveyDefinition.update({
        where: { id },
        data: {
          status: SurveyDefinitionStatus.ACTIVE,
          activeVersionId: draftVersion.id,
          activatedAt: now,
          deactivatedAt: null,
          updatedById: actor.id
        }
      });
      await this.auditWith(tx, actor, "survey.published", "SurveyVersion", draftVersion.id, undefined, {
        surveyId: id,
        version: draftVersion.version
      });
      await this.auditWith(tx, actor, "survey.activated", "SurveyDefinition", id, { status: current.status }, {
        status: SurveyDefinitionStatus.ACTIVE,
        activeVersionId: draftVersion.id
      });
    });
    return this.get(actor, id);
  }

  async deactivate(actor: AuthUser, id: string) {
    const current = await this.get(actor, id);
    if (current.status !== SurveyDefinitionStatus.ACTIVE) {
      throw new ConflictException("Sólo una encuesta activa se puede desactivar");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.surveyDefinition.update({
        where: { id },
        data: { status: SurveyDefinitionStatus.INACTIVE, deactivatedAt: new Date(), updatedById: actor.id }
      });
      await tx.surveySendConfiguration.updateMany({ where: { surveyId: id }, data: { isActive: false } });
      await this.auditWith(tx, actor, "survey.deactivated", "SurveyDefinition", id, { status: current.status }, {
        status: SurveyDefinitionStatus.INACTIVE
      });
    });
    return this.get(actor, id);
  }

  async archive(actor: AuthUser, id: string) {
    const current = await this.get(actor, id);
    if (current.status === SurveyDefinitionStatus.ACTIVE) {
      throw new ConflictException("Desactiva la encuesta antes de archivarla");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.surveyDefinition.update({
        where: { id },
        data: { status: SurveyDefinitionStatus.ARCHIVED, archivedAt: new Date(), updatedById: actor.id }
      });
      await tx.surveySendConfiguration.updateMany({ where: { surveyId: id }, data: { isActive: false } });
      await this.auditWith(tx, actor, "survey.archived", "SurveyDefinition", id, { status: current.status }, {
        status: SurveyDefinitionStatus.ARCHIVED
      });
    });
    return this.get(actor, id);
  }

  async addSection(actor: AuthUser, surveyId: string, dto: CreateSurveySectionDto) {
    const current = await this.prepareDraft(actor, surveyId);
    const version = current.draftVersion;
    if (!version) throw new ConflictException("No existe una versión editable");
    const position = await this.prisma.surveySection.count({ where: { versionId: version.id } });
    const section = await this.prisma.surveySection.create({
      data: {
        versionId: version.id,
        name: dto.name?.trim() || "Sección sin nombre",
        description: dto.description?.trim() || null,
        position
      }
    });
    await this.audit(actor, "survey.section_created", "SurveySection", section.id, undefined, {
      surveyId,
      versionId: version.id,
      position
    }, current.branchId ?? undefined);
    return this.get(actor, surveyId);
  }

  async updateSection(actor: AuthUser, id: string, dto: UpdateSurveySectionDto) {
    const section = await this.getEditableSection(actor, id);
    await this.prisma.surveySection.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() || "Sección sin nombre" } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {})
      }
    });
    await this.audit(actor, "survey.section_updated", "SurveySection", id, section, dto, section.version.survey.branchId ?? undefined);
    return this.get(actor, section.version.surveyId);
  }

  async deleteSection(actor: AuthUser, id: string) {
    const section = await this.getEditableSection(actor, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.surveySection.delete({ where: { id } });
      await this.normalizeSectionPositions(tx, section.versionId);
      await this.auditWith(tx, actor, "survey.section_deleted", "SurveySection", id, section, undefined, section.version.survey.branchId ?? undefined);
    });
    return this.get(actor, section.version.surveyId);
  }

  async reorderSections(actor: AuthUser, surveyId: string, dto: ReorderSurveyItemsDto) {
    const current = await this.get(actor, surveyId);
    const version = current.draftVersion;
    if (!version) throw new ConflictException("Prepara una versión borrador antes de reordenar");
    const existing = await this.prisma.surveySection.findMany({ where: { versionId: version.id }, select: { id: true } });
    this.assertExactIds(existing.map((item) => item.id), dto.ids);
    await this.prisma.$transaction(async (tx) => {
      await Promise.all(dto.ids.map((id, index) => tx.surveySection.update({ where: { id }, data: { position: index + 10_000 } })));
      await Promise.all(dto.ids.map((id, index) => tx.surveySection.update({ where: { id }, data: { position: index } })));
      await this.auditWith(tx, actor, "survey.sections_reordered", "SurveyDefinition", surveyId, undefined, { ids: dto.ids }, current.branchId ?? undefined);
    });
    return this.get(actor, surveyId);
  }

  async addQuestion(actor: AuthUser, sectionId: string, dto: CreateSurveyQuestionDto) {
    const section = await this.getEditableSection(actor, sectionId);
    const position = await this.prisma.surveyQuestion.count({ where: { sectionId } });
    const options = dto.options?.length ? dto.options : this.defaultOptions(dto.type);
    const question = await this.prisma.surveyQuestion.create({
      data: {
        sectionId,
        text: dto.text.trim() || "Edita esta pregunta",
        description: dto.description?.trim() || null,
        type: dto.type,
        isRequired: dto.isRequired ?? true,
        position,
        validationJson: dto.validationJson as Prisma.InputJsonValue | undefined,
        options: {
          create: options.map((option, index) => ({
            label: option.label.trim(),
            value: option.value?.trim() || String(index + 1),
            position: index
          }))
        }
      }
    });
    await this.audit(actor, "survey.question_created", "SurveyQuestion", question.id, undefined, {
      surveyId: section.version.surveyId,
      type: dto.type,
      position
    }, section.version.survey.branchId ?? undefined);
    return this.get(actor, section.version.surveyId);
  }

  async updateQuestion(actor: AuthUser, id: string, dto: UpdateSurveyQuestionDto) {
    const question = await this.getEditableQuestion(actor, id);
    await this.prisma.$transaction(async (tx) => {
      const type = dto.type ?? question.type;
      await tx.surveyQuestion.update({
        where: { id },
        data: {
          ...(dto.text !== undefined ? { text: dto.text.trim() || "Edita esta pregunta" } : {}),
          ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}),
          ...(dto.validationJson !== undefined
            ? { validationJson: dto.validationJson as Prisma.InputJsonValue }
            : {})
        }
      });
      if (dto.options !== undefined || (dto.type !== undefined && dto.type !== question.type)) {
        const options = dto.options?.length ? dto.options : this.defaultOptions(type);
        await tx.surveyQuestionOption.deleteMany({ where: { questionId: id } });
        if (options.length) {
          await tx.surveyQuestionOption.createMany({
            data: options.map((option, index) => ({
              questionId: id,
              label: option.label.trim(),
              value: option.value?.trim() || String(index + 1),
              position: index
            }))
          });
        }
      }
      await this.auditWith(tx, actor, "survey.question_updated", "SurveyQuestion", id, question, dto, question.section.version.survey.branchId ?? undefined);
    });
    return this.get(actor, question.section.version.surveyId);
  }

  async deleteQuestion(actor: AuthUser, id: string) {
    const question = await this.getEditableQuestion(actor, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.surveyQuestion.delete({ where: { id } });
      await this.normalizeQuestionPositions(tx, question.sectionId);
      await this.auditWith(tx, actor, "survey.question_deleted", "SurveyQuestion", id, question, undefined, question.section.version.survey.branchId ?? undefined);
    });
    return this.get(actor, question.section.version.surveyId);
  }

  async reorderQuestions(actor: AuthUser, sectionId: string, dto: ReorderSurveyItemsDto) {
    const section = await this.getEditableSection(actor, sectionId);
    const existing = await this.prisma.surveyQuestion.findMany({ where: { sectionId }, select: { id: true } });
    this.assertExactIds(existing.map((item) => item.id), dto.ids);
    await this.prisma.$transaction(async (tx) => {
      await Promise.all(dto.ids.map((id, index) => tx.surveyQuestion.update({ where: { id }, data: { position: index + 10_000 } })));
      await Promise.all(dto.ids.map((id, index) => tx.surveyQuestion.update({ where: { id }, data: { position: index } })));
      await this.auditWith(tx, actor, "survey.questions_reordered", "SurveySection", sectionId, undefined, { ids: dto.ids }, section.version.survey.branchId ?? undefined);
    });
    return this.get(actor, section.version.surveyId);
  }

  async listSendConfigurations(actor: AuthUser) {
    return this.prisma.surveySendConfiguration.findMany({
      where: { organizationId: actor.organizationId, survey: this.scope(actor) },
      orderBy: { updatedAt: "desc" },
      include: { survey: { select: { id: true, name: true, type: true, status: true, branchId: true } } }
    });
  }

  async updateSendConfiguration(actor: AuthUser, dto: UpdateSurveySendConfigurationDto) {
    const survey = await this.get(actor, dto.surveyId);
    for (const branchId of dto.branchIds ?? []) this.assertBranch(actor, branchId);
    if (dto.isActive && survey.status !== SurveyDefinitionStatus.ACTIVE) {
      throw new BadRequestException("Activa y publica la encuesta antes de habilitar el envío automático");
    }
    this.assertTime(dto.sendWindowStart);
    this.assertTime(dto.sendWindowEnd);
    const existing = await this.prisma.surveySendConfiguration.findUnique({ where: { surveyId: dto.surveyId } });
    const data = {
      organizationId: actor.organizationId,
      branchIds: this.jsonArray(dto.branchIds),
      professionalIds: this.jsonArray(dto.professionalIds),
      specialtyIds: this.jsonArray(dto.specialtyIds),
      appointmentTypes: this.jsonArray(dto.appointmentTypes),
      channel: dto.channel ?? CommunicationChannel.EMAIL,
      triggerEvent: dto.triggerEvent ?? "APPOINTMENT_COMPLETED",
      delayMinutes: dto.delayMinutes ?? 120,
      minimumFrequencyDays: dto.minimumFrequencyDays ?? 30,
      sendWindowStart: dto.sendWindowStart ?? "08:00",
      sendWindowEnd: dto.sendWindowEnd ?? "20:00",
      maxRetries: dto.maxRetries ?? 3,
      reminderEnabled: dto.reminderEnabled ?? false,
      reminderDelayMinutes: dto.reminderDelayMinutes ?? null,
      requireConsent: dto.requireConsent ?? true,
      isActive: dto.isActive ?? false,
      updatedById: actor.id
    };
    const updated = await this.prisma.$transaction(async (tx) => {
      const config = await tx.surveySendConfiguration.upsert({
        where: { surveyId: dto.surveyId },
        create: { surveyId: dto.surveyId, createdById: actor.id, ...data },
        update: data
      });
      await this.auditWith(tx, actor, "survey.send_configuration_updated", "SurveySendConfiguration", config.id, existing, config, survey.branchId ?? undefined);
      return config;
    });
    return updated;
  }

  async results(actor: AuthUser, query: SurveyResultsQueryDto) {
    if (query.branchId) this.assertBranch(actor, query.branchId);
    if (query.surveyId) await this.get(actor, query.surveyId);
    const dateFilter = this.dateFilter(query.from, query.to);
    const invitationWhere: Prisma.SurveyInvitationWhereInput = {
      organizationId: actor.organizationId,
      ...(this.isGlobal(actor) ? {} : { branchId: { in: actor.branchIds } }),
      ...(query.surveyId ? { surveyId: query.surveyId } : {}),
      ...(query.versionId ? { surveyVersionId: query.versionId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(dateFilter ? { createdAt: dateFilter } : {})
    };
    const responseWhere: Prisma.SurveyResponseWhereInput = {
      organizationId: actor.organizationId,
      ...(this.isGlobal(actor) ? {} : { branchId: { in: actor.branchIds } }),
      ...(query.surveyId ? { surveyId: query.surveyId } : {}),
      ...(query.versionId ? { surveyVersionId: query.versionId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      status: SurveyResponseStatus.SUBMITTED,
      ...(dateFilter ? { submittedAt: dateFilter } : {})
    };
    const [generated, queued, sent, delivered, opened, started, responded, expired, bounced, failed, numericAnswers, npsAnswers] =
      await Promise.all([
        this.prisma.surveyInvitation.count({ where: invitationWhere }),
        this.prisma.surveyInvitation.count({ where: { ...invitationWhere, queuedAt: { not: null } } }),
        this.prisma.surveyInvitation.count({ where: { ...invitationWhere, sentAt: { not: null } } }),
        this.prisma.surveyInvitation.count({ where: { ...invitationWhere, deliveredAt: { not: null } } }),
        this.prisma.surveyInvitation.count({ where: { ...invitationWhere, openedAt: { not: null } } }),
        this.prisma.surveyInvitation.count({ where: { ...invitationWhere, startedAt: { not: null } } }),
        this.prisma.surveyResponse.count({ where: responseWhere }),
        this.prisma.surveyInvitation.count({ where: { ...invitationWhere, status: SurveyInvitationStatus.EXPIRED } }),
        this.prisma.surveyInvitation.count({ where: { ...invitationWhere, status: SurveyInvitationStatus.BOUNCED } }),
        this.prisma.surveyInvitation.count({ where: { ...invitationWhere, status: SurveyInvitationStatus.FAILED } }),
        this.prisma.surveyAnswer.aggregate({ where: { response: responseWhere, valueNumber: { not: null } }, _avg: { valueNumber: true } }),
        this.prisma.surveyAnswer.findMany({
          where: { response: responseWhere, question: { type: SurveyQuestionType.NPS_10 }, valueNumber: { not: null } },
          select: { valueNumber: true }
        })
      ]);
    const scores = npsAnswers.map((item) => item.valueNumber).filter((value): value is number => value !== null);
    const promoters = scores.filter((score) => score >= 9).length;
    const passives = scores.filter((score) => score >= 7 && score <= 8).length;
    const detractors = scores.filter((score) => score <= 6).length;
    const nps = scores.length ? Math.round(((promoters - detractors) / scores.length) * 100) : null;

    const questionRows = await this.prisma.surveyQuestion.findMany({
      where: {
        section: {
          version: {
            ...(query.versionId ? { id: query.versionId } : {}),
            survey: {
              ...this.scope(actor),
              ...(query.surveyId ? { id: query.surveyId } : {})
            }
          }
        }
      },
      include: {
        options: { orderBy: { position: "asc" } },
        answers: {
          where: { response: responseWhere },
          select: { optionId: true, optionIdsJson: true, valueNumber: true, valueText: true, valueBoolean: true }
        }
      },
      orderBy: [{ sectionId: "asc" }, { position: "asc" }],
      take: 200
    });
    const questions = questionRows.map((question) => this.questionMetrics(question));
    return {
      metrics: {
        generated,
        queued,
        sent,
        delivered,
        opened,
        started,
        responded,
        expired,
        bounced,
        failed,
        responseRate: sent ? Math.round((responded / sent) * 10_000) / 100 : 0,
        average: numericAnswers._avg.valueNumber,
        nps,
        promoters,
        passives,
        detractors
      },
      questions
    };
  }

  async exportResults(actor: AuthUser, query: SurveyResultsQueryDto) {
    const report = await this.results(actor, query);
    const lines = [
      ["Indicador", "Valor"],
      ...Object.entries(report.metrics).map(([key, value]) => [key, value ?? ""]),
      [],
      ["Pregunta", "Tipo", "Respuestas", "Promedio"],
      ...report.questions.map((question) => [question.text, question.type, question.answerCount, question.average ?? ""])
    ];
    const content = lines.map((line) => line.map((cell) => this.csvCell(String(cell))).join(",")).join("\r\n");
    await this.audit(actor, "survey.results_exported", "SurveyResults", query.surveyId ?? actor.organizationId, undefined, query);
    return {
      fileName: `resultados-encuestas-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: "text/csv;charset=utf-8",
      contentBase64: Buffer.from(`\uFEFF${content}`, "utf8").toString("base64")
    };
  }

  async handleAppointmentCompleted(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        professional: { include: { specialties: true } },
        branch: true
      }
    });
    if (!appointment || appointment.status !== "COMPLETED" || !appointment.patient) return { created: 0, skipped: 0 };
    const configurations = await this.prisma.surveySendConfiguration.findMany({
      where: {
        organizationId: appointment.organizationId,
        isActive: true,
        triggerEvent: "APPOINTMENT_COMPLETED",
        survey: { status: SurveyDefinitionStatus.ACTIVE, activeVersionId: { not: null } }
      },
      include: { survey: true }
    });
    let created = 0;
    let skipped = 0;
    for (const configuration of configurations) {
      const survey = configuration.survey;
      if (survey.branchId && survey.branchId !== appointment.branchId) continue;
      if (!this.matchesFilter(configuration.branchIds, appointment.branchId)) continue;
      if (!this.matchesFilter(configuration.professionalIds, appointment.professionalId)) continue;
      const specialtyIds = appointment.professional.specialties.map((specialty) => specialty.specialtyId);
      if (!this.matchesAny(configuration.specialtyIds, specialtyIds)) continue;
      const email = appointment.patient.email?.trim().toLowerCase();
      if (!email) {
        skipped += 1;
        await this.systemAudit(appointment.organizationId, appointment.branchId, configuration.updatedById, "survey.invitation_skipped", appointmentId, { reason: "PATIENT_WITHOUT_EMAIL", surveyId: survey.id });
        continue;
      }
      if (configuration.requireConsent && appointment.patient.marketingConsent !== MarketingConsentStatus.GRANTED) {
        skipped += 1;
        await this.systemAudit(appointment.organizationId, appointment.branchId, configuration.updatedById, "survey.invitation_skipped", appointmentId, { reason: "CONSENT_NOT_GRANTED", surveyId: survey.id });
        continue;
      }
      const cutoff = new Date(Date.now() - configuration.minimumFrequencyDays * 86_400_000);
      const recent = await this.prisma.surveyInvitation.findFirst({
        where: {
          organizationId: appointment.organizationId,
          patientId: appointment.patient.id,
          surveyId: survey.id,
          createdAt: { gte: cutoff },
          status: { notIn: [SurveyInvitationStatus.FAILED, SurveyInvitationStatus.EXPIRED] }
        },
        select: { id: true }
      });
      if (recent) {
        skipped += 1;
        await this.systemAudit(appointment.organizationId, appointment.branchId, configuration.updatedById, "survey.invitation_skipped", appointmentId, { reason: "MINIMUM_FREQUENCY", surveyId: survey.id, invitationId: recent.id });
        continue;
      }
      if (!survey.activeVersionId) continue;
      const placeholderHash = this.hashToken(randomBytes(32).toString("base64url"));
      const scheduledAt = new Date(Date.now() + configuration.delayMinutes * 60_000);
      const expiresAt = new Date(scheduledAt.getTime() + 30 * 86_400_000);
      try {
        const invitation = await this.prisma.surveyInvitation.create({
          data: {
            organizationId: appointment.organizationId,
            branchId: appointment.branchId,
            surveyId: survey.id,
            surveyVersionId: survey.activeVersionId,
            patientId: appointment.patient.id,
            appointmentId,
            professionalId: appointment.professionalId,
            recipientEmail: email,
            tokenHash: placeholderHash,
            tokenExpiresAt: expiresAt,
            scheduledAt
          }
        });
        created += 1;
        await this.systemAudit(appointment.organizationId, appointment.branchId, configuration.updatedById, "survey.invitation_created", invitation.id, { surveyId: survey.id, appointmentId, scheduledAt });
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }
    return { created, skipped };
  }

  async publicSurvey(token: string) {
    const invitation = await this.resolveInvitation(token);
    if (invitation.status === SurveyInvitationStatus.RESPONDED) {
      return { state: "RESPONDED", message: "Esta encuesta ya fue respondida." };
    }
    if (invitation.tokenExpiresAt.getTime() <= Date.now()) {
      await this.prisma.surveyInvitation.update({ where: { id: invitation.id }, data: { status: SurveyInvitationStatus.EXPIRED } });
      return { state: "EXPIRED", message: "El enlace de esta encuesta ha expirado." };
    }
    if (!invitation.openedAt) {
      await this.prisma.$transaction([
        this.prisma.surveyInvitation.update({
          where: { id: invitation.id },
          data: { openedAt: new Date(), status: SurveyInvitationStatus.OPENED }
        }),
        this.prisma.surveyDeliveryEvent.create({
          data: { invitationId: invitation.id, type: SurveyDeliveryEventType.OPENED, provider: "public-form" }
        })
      ]);
    }
    const [branch, organization, patient, appointment, professional] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { id: invitation.branchId, organizationId: invitation.organizationId },
        include: { brand: true }
      }),
      this.prisma.organization.findUnique({ where: { id: invitation.organizationId }, select: { name: true } }),
      this.prisma.patient.findFirst({ where: { id: invitation.patientId, organizationId: invitation.organizationId }, select: { firstName: true, lastName: true } }),
      this.prisma.appointment.findFirst({ where: { id: invitation.appointmentId, organizationId: invitation.organizationId }, select: { startAt: true } }),
      this.prisma.professional.findFirst({ where: { id: invitation.professionalId, organizationId: invitation.organizationId }, select: { firstName: true, lastName: true } })
    ]);
    const timezone = branch?.timezone || "America/Mexico_City";
    const appointmentDate = appointment
      ? {
          date: new Intl.DateTimeFormat("es-MX", { timeZone: timezone, dateStyle: "long" }).format(appointment.startAt),
          time: new Intl.DateTimeFormat("es-MX", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(appointment.startAt)
        }
      : { date: "", time: "" };
    const responseUrl = `${(this.config.get<string>("FRONTEND_URL")?.trim() || "http://localhost:3000").replace(/\/$/, "")}/public/surveys/respond/${encodeURIComponent(token)}`;
    const variables = {
      nombrePaciente: patient?.firstName ?? "",
      apellidosPaciente: patient?.lastName ?? "",
      fechaAtencion: appointmentDate.date,
      horaAtencion: appointmentDate.time,
      nombreSucursal: branch?.name ?? "",
      direccionSucursal: branch?.address ?? "",
      telefonoSucursal: branch?.phone ?? "",
      nombreProfesional: professional ? `${professional.firstName} ${professional.lastName}`.trim() : "",
      nombreOrganizacion: organization?.name ?? "",
      enlaceEncuesta: responseUrl
    };
    return {
      state: "READY",
      survey: {
        name: invitation.survey.name,
        type: invitation.survey.type,
        version: invitation.surveyVersion.version,
        welcomeHtml: this.renderVariables(invitation.surveyVersion.emailHeaderHtml, variables),
        footerHtml: this.renderVariables(invitation.surveyVersion.emailFooterHtml, variables),
        sections: invitation.surveyVersion.sections.map((section) => ({
          id: section.id,
          name: section.name,
          description: section.description,
          position: section.position,
          questions: section.questions.map((question) => ({
            id: question.id,
            text: question.text,
            description: question.description,
            type: question.type,
            isRequired: question.isRequired,
            position: question.position,
            options: question.options.map((option) => ({
              id: option.id,
              label: option.label,
              value: option.value,
              position: option.position
            }))
          }))
        }))
      },
      brand: {
        organizationName: organization?.name ?? "Clínica dental",
        branchName: branch?.name ?? "Sucursal",
        logoUrl: branch?.brand?.logoUrl ?? null,
        primaryColor: branch?.brand?.primaryColor ?? null
      }
    };
  }

  async startPublicSurvey(token: string) {
    const invitation = await this.resolveInvitation(token);
    this.assertInvitationCanRespond(invitation);
    const now = new Date();
    const response = await this.prisma.$transaction(async (tx) => {
      const result = await tx.surveyResponse.upsert({
        where: { invitationId: invitation.id },
        create: {
          organizationId: invitation.organizationId,
          branchId: invitation.branchId,
          surveyId: invitation.surveyId,
          surveyVersionId: invitation.surveyVersionId,
          invitationId: invitation.id,
          patientId: invitation.patientId,
          appointmentId: invitation.appointmentId,
          professionalId: invitation.professionalId,
          startedAt: now
        },
        update: { startedAt: now }
      });
      await tx.surveyInvitation.update({ where: { id: invitation.id }, data: { status: SurveyInvitationStatus.STARTED, startedAt: now } });
      await tx.auditLog.create({
        data: {
          organizationId: invitation.organizationId,
          branchId: invitation.branchId,
          action: "survey.response_started",
          entity: "SurveyResponse",
          entityId: result.id,
          correlationId: randomUUID()
        }
      });
      return result;
    });
    return { responseId: response.id, state: "STARTED" };
  }

  async submitPublicSurvey(token: string, dto: SubmitPublicSurveyDto) {
    const invitation = await this.resolveInvitation(token);
    this.assertInvitationCanRespond(invitation);
    const questions = invitation.surveyVersion.sections.flatMap((section) => section.questions);
    const answersByQuestion = new Map(dto.answers.map((answer) => [answer.questionId, answer]));
    const knownIds = new Set(questions.map((question) => question.id));
    if (dto.answers.some((answer) => !knownIds.has(answer.questionId))) {
      throw new BadRequestException("La respuesta contiene preguntas que no pertenecen a esta encuesta");
    }
    for (const question of questions) {
      const answer = answersByQuestion.get(question.id);
      if (question.isRequired && (!answer || !this.answerHasValue(answer))) {
        throw new BadRequestException(`La pregunta “${question.text}” es obligatoria`);
      }
      if (answer) this.validateAnswer(question, answer);
    }
    const now = new Date();
    const response = await this.prisma.$transaction(async (tx) => {
      const record = await tx.surveyResponse.upsert({
        where: { invitationId: invitation.id },
        create: {
          organizationId: invitation.organizationId,
          branchId: invitation.branchId,
          surveyId: invitation.surveyId,
          surveyVersionId: invitation.surveyVersionId,
          invitationId: invitation.id,
          patientId: invitation.patientId,
          appointmentId: invitation.appointmentId,
          professionalId: invitation.professionalId,
          status: SurveyResponseStatus.SUBMITTED,
          submittedAt: now
        },
        update: { status: SurveyResponseStatus.SUBMITTED, submittedAt: now }
      });
      await tx.surveyAnswer.deleteMany({ where: { responseId: record.id } });
      const answerRows = dto.answers.filter((answer) => this.answerHasValue(answer));
      if (answerRows.length) {
        await tx.surveyAnswer.createMany({
          data: answerRows.map((answer) => ({
            responseId: record.id,
            questionId: answer.questionId,
            optionId: answer.optionId,
            optionIdsJson: answer.optionIds as Prisma.InputJsonValue | undefined,
            valueText: answer.valueText?.trim(),
            valueNumber: answer.valueNumber,
            valueBoolean: answer.valueBoolean
          }))
        });
      }
      await tx.surveyInvitation.update({
        where: { id: invitation.id },
        data: { status: SurveyInvitationStatus.RESPONDED, respondedAt: now }
      });
      await tx.auditLog.create({
        data: {
          organizationId: invitation.organizationId,
          branchId: invitation.branchId,
          action: "survey.response_submitted",
          entity: "SurveyResponse",
          entityId: record.id,
          after: { surveyId: invitation.surveyId, versionId: invitation.surveyVersionId },
          correlationId: randomUUID()
        }
      });
      return record;
    });
    return {
      state: "SUBMITTED",
      responseId: response.id,
      message: "Gracias por compartir tu opinión. Tu respuesta fue registrada correctamente."
    };
  }

  async recordDelivery(secret: string | undefined, dto: RecordSurveyDeliveryDto) {
    this.assertWebhookSecret(secret);
    const invitation = await this.prisma.surveyInvitation.findFirst({
      where: { providerMessageId: dto.providerMessageId },
      select: { id: true, status: true }
    });
    if (!invitation) return { accepted: true };
    const type = dto.type as SurveyDeliveryEventType;
    const now = new Date();
    const update: Prisma.SurveyInvitationUpdateInput = {};
    if (type === SurveyDeliveryEventType.DELIVERED) {
      update.status = SurveyInvitationStatus.DELIVERED;
      update.deliveredAt = now;
    } else if (type === SurveyDeliveryEventType.OPENED) {
      update.status = SurveyInvitationStatus.OPENED;
      update.openedAt = now;
    } else if (type === SurveyDeliveryEventType.BOUNCED) {
      update.status = SurveyInvitationStatus.BOUNCED;
      update.lastError = "El proveedor reportó un rebote";
    } else if (type === SurveyDeliveryEventType.FAILED) {
      update.status = SurveyInvitationStatus.FAILED;
      update.lastError = "El proveedor reportó un error de entrega";
    }
    await this.prisma.$transaction([
      this.prisma.surveyInvitation.update({ where: { id: invitation.id }, data: update }),
      this.prisma.surveyDeliveryEvent.create({
        data: {
          invitationId: invitation.id,
          type,
          provider: dto.provider,
          providerMessageId: dto.providerMessageId,
          payloadJson: dto.payload as Prisma.InputJsonValue | undefined
        }
      })
    ]);
    return { accepted: true };
  }

  hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  renderVariables(template: string, values: Record<string, string>) {
    return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, key: string) =>
      ALLOWED_VARIABLES.has(key) ? this.escapeHtml(values[key] ?? "") : match
    );
  }

  private async resolveInvitation(token: string) {
    const normalized = token.trim();
    if (!/^[A-Za-z0-9_-]{32,160}$/.test(normalized)) throw new NotFoundException("Enlace de encuesta no válido");
    const invitation = await this.prisma.surveyInvitation.findUnique({
      where: { tokenHash: this.hashToken(normalized) },
      include: {
        survey: true,
        surveyVersion: {
          include: {
            sections: {
              orderBy: { position: "asc" },
              include: {
                questions: {
                  orderBy: { position: "asc" },
                  include: { options: { orderBy: { position: "asc" } } }
                }
              }
            }
          }
        }
      }
    });
    if (!invitation) throw new NotFoundException("Enlace de encuesta no válido");
    return invitation;
  }

  private assertInvitationCanRespond(invitation: Awaited<ReturnType<CrmSurveysService["resolveInvitation"]>>) {
    if (invitation.status === SurveyInvitationStatus.RESPONDED) {
      throw new ConflictException("Esta encuesta ya fue respondida");
    }
    if (invitation.tokenExpiresAt.getTime() <= Date.now() || invitation.status === SurveyInvitationStatus.EXPIRED) {
      throw new ConflictException("El enlace de esta encuesta ha expirado");
    }
  }

  private validateAnswer(
    question: Awaited<ReturnType<CrmSurveysService["resolveInvitation"]>>["surveyVersion"]["sections"][number]["questions"][number],
    answer: SurveyPublicAnswerDto
  ) {
    const optionIds = new Set(question.options.map((option) => option.id));
    if (answer.optionId && !optionIds.has(answer.optionId)) throw new BadRequestException("Opción no válida");
    if (answer.optionIds?.some((id) => !optionIds.has(id))) throw new BadRequestException("Una o más opciones no son válidas");
    if (question.type === SurveyQuestionType.NPS_10 && (answer.valueNumber === undefined || answer.valueNumber < 0 || answer.valueNumber > 10)) {
      throw new BadRequestException("La respuesta NPS debe estar entre 0 y 10");
    }
    if (question.type === SurveyQuestionType.LIKERT_5 && (answer.valueNumber === undefined || answer.valueNumber < 1 || answer.valueNumber > 5)) {
      throw new BadRequestException("La respuesta Likert debe estar entre 1 y 5");
    }
    if (question.type === SurveyQuestionType.STAR_RATING && (answer.valueNumber === undefined || answer.valueNumber < 1 || answer.valueNumber > 5)) {
      throw new BadRequestException("La calificación debe estar entre 1 y 5 estrellas");
    }
  }

  private answerHasValue(answer: SurveyPublicAnswerDto) {
    return Boolean(
      answer.optionId ||
        answer.optionIds?.length ||
        answer.valueText?.trim() ||
        answer.valueNumber !== undefined ||
        answer.valueBoolean !== undefined
    );
  }

  private validateForActivation(current: Awaited<ReturnType<CrmSurveysService["get"]>>, version: NonNullable<Awaited<ReturnType<CrmSurveysService["get"]>>["draftVersion"]>) {
    if (!current.name.trim() || current.name.trim().toLowerCase() === DEFAULT_NAME.toLowerCase()) {
      throw new BadRequestException("Asigna un nombre a la encuesta antes de activarla");
    }
    if (!version.emailSubject.trim()) throw new BadRequestException("El asunto del correo es obligatorio");
    if (!version.emailHeaderHtml.trim()) throw new BadRequestException("El encabezado del correo es obligatorio");
    if (!version.sections.length) throw new BadRequestException("Agrega al menos una sección");
    const questions = version.sections.flatMap((section) => section.questions);
    if (!questions.length) throw new BadRequestException("Agrega al menos una pregunta");
    for (const question of questions) {
      if (!question.text.trim()) throw new BadRequestException("Todas las preguntas deben tener texto");
      if (OPTION_TYPES.has(question.type) && !question.options.length) {
        throw new BadRequestException(`La pregunta “${question.text}” requiere opciones`);
      }
      if (question.options.some((option) => !option.label.trim())) {
        throw new BadRequestException(`Todas las opciones de “${question.text}” deben tener etiqueta`);
      }
    }
    this.assertVariables(version.emailSubject);
    this.assertVariables(version.emailHeaderHtml);
    this.assertVariables(version.emailFooterHtml);
  }

  private questionMetrics(question: {
    id: string;
    text: string;
    type: SurveyQuestionType;
    options: { id: string; label: string; value: string; position: number }[];
    answers: { optionId: string | null; optionIdsJson: Prisma.JsonValue; valueNumber: number | null; valueText: string | null; valueBoolean: boolean | null }[];
  }) {
    const numeric = question.answers.map((answer) => answer.valueNumber).filter((value): value is number => value !== null);
    const counts = new Map(question.options.map((option) => [option.id, 0]));
    for (const answer of question.answers) {
      if (answer.optionId) counts.set(answer.optionId, (counts.get(answer.optionId) ?? 0) + 1);
      if (Array.isArray(answer.optionIdsJson)) {
        for (const optionId of answer.optionIdsJson) {
          if (typeof optionId === "string") counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
        }
      }
    }
    return {
      id: question.id,
      text: question.text,
      type: question.type,
      answerCount: question.answers.length,
      average: numeric.length ? Math.round((numeric.reduce((sum, value) => sum + value, 0) / numeric.length) * 100) / 100 : null,
      distribution: question.options.map((option) => ({
        optionId: option.id,
        label: option.label,
        count: counts.get(option.id) ?? 0,
        percentage: question.answers.length ? Math.round(((counts.get(option.id) ?? 0) / question.answers.length) * 10_000) / 100 : 0
      })),
      textResponses: question.type === SurveyQuestionType.FREE_TEXT
        ? question.answers.map((answer) => answer.valueText).filter(Boolean).slice(0, 100)
        : []
    };
  }

  private async getEditableSection(actor: AuthUser, id: string) {
    const section = await this.prisma.surveySection.findFirst({
      where: { id, version: { status: SurveyVersionStatus.DRAFT, survey: this.scope(actor) } },
      include: { version: { include: { survey: true } } }
    });
    if (!section) throw new ConflictException("La sección no pertenece a una versión borrador editable");
    return section;
  }

  private async getEditableQuestion(actor: AuthUser, id: string) {
    const question = await this.prisma.surveyQuestion.findFirst({
      where: { id, section: { version: { status: SurveyVersionStatus.DRAFT, survey: this.scope(actor) } } },
      include: { options: true, section: { include: { version: { include: { survey: true } } } } }
    });
    if (!question) throw new ConflictException("La pregunta no pertenece a una versión borrador editable");
    return question;
  }

  private async normalizeSectionPositions(tx: TransactionClient, versionId: string) {
    const rows = await tx.surveySection.findMany({ where: { versionId }, orderBy: { position: "asc" }, select: { id: true } });
    await Promise.all(rows.map((row, index) => tx.surveySection.update({ where: { id: row.id }, data: { position: index } })));
  }

  private async normalizeQuestionPositions(tx: TransactionClient, sectionId: string) {
    const rows = await tx.surveyQuestion.findMany({ where: { sectionId }, orderBy: { position: "asc" }, select: { id: true } });
    await Promise.all(rows.map((row, index) => tx.surveyQuestion.update({ where: { id: row.id }, data: { position: index } })));
  }

  private defaultOptions(type: SurveyQuestionType) {
    if (type === SurveyQuestionType.LIKERT_5) {
      return ["Muy en desacuerdo", "En desacuerdo", "Neutro", "De acuerdo", "Muy de acuerdo"].map((label, index) => ({ label, value: String(index + 1) }));
    }
    if (type === SurveyQuestionType.NPS_10) return Array.from({ length: 11 }, (_, index) => ({ label: String(index), value: String(index) }));
    if (type === SurveyQuestionType.YES_NO) return [{ label: "Sí", value: "true" }, { label: "No", value: "false" }];
    if (type === SurveyQuestionType.STAR_RATING) return Array.from({ length: 5 }, (_, index) => ({ label: `${index + 1} estrella${index ? "s" : ""}`, value: String(index + 1) }));
    if (type === SurveyQuestionType.SINGLE_CHOICE || type === SurveyQuestionType.MULTIPLE_CHOICE) {
      return [{ label: "Opción 1", value: "1" }, { label: "Opción 2", value: "2" }];
    }
    return [];
  }

  private scope(actor: AuthUser): Prisma.SurveyDefinitionWhereInput {
    return {
      organizationId: actor.organizationId,
      ...(this.isGlobal(actor) ? {} : { OR: [{ branchId: null }, { branchId: { in: actor.branchIds } }] })
    };
  }

  private assertBranch(actor: AuthUser, branchId: string) {
    if (!this.isGlobal(actor) && !actor.branchIds.includes(branchId)) throw new ForbiddenException("Sucursal fuera de tu alcance");
  }

  private isGlobal(actor: AuthUser) {
    return actor.permissions.includes("system.manage_all") || actor.permissions.includes("branches.view_all");
  }

  private assertExactIds(existing: string[], requested: string[]) {
    if (existing.length !== requested.length || new Set(requested).size !== requested.length || requested.some((id) => !existing.includes(id))) {
      throw new BadRequestException("El orden enviado no coincide con los elementos de la versión");
    }
  }

  private sanitizeHtml(value: string) {
    if (value.length > 100_000) throw new BadRequestException("El contenido supera el tamaño permitido");
    return value
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<\s*(script|iframe|object|embed|form|input|button|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/<\s*(script|iframe|object|embed|form|input|button|style)[^>]*\/?>/gi, "")
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/javascript\s*:/gi, "")
      .trim();
  }

  private sanitizePlain(value: string) {
    return value.replace(/<[^>]*>/g, "").replace(/\p{Cc}/gu, " ").trim();
  }

  private assertVariables(value: string) {
    const unknown = [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)]
      .map((match) => match[1])
      .filter((name) => !ALLOWED_VARIABLES.has(name));
    if (unknown.length) throw new BadRequestException(`Variables no permitidas: ${[...new Set(unknown)].join(", ")}`);
  }

  private assertTime(value?: string) {
    if (value !== undefined && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new BadRequestException("El horario debe usar formato HH:mm");
  }

  private jsonArray(value?: string[]): Prisma.InputJsonValue | undefined {
    return value === undefined ? undefined : value;
  }

  private matchesFilter(value: Prisma.JsonValue | null, candidate: string) {
    if (!Array.isArray(value) || !value.length) return true;
    return value.includes(candidate);
  }

  private matchesAny(value: Prisma.JsonValue | null, candidates: string[]) {
    if (!Array.isArray(value) || !value.length) return true;
    return value.some((entry) => typeof entry === "string" && candidates.includes(entry));
  }

  private dateFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    return {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {})
    };
  }

  private csvCell(value: string) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private escapeHtml(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  private assertWebhookSecret(secret: string | undefined) {
    const expected = this.config.get<string>("SURVEY_WEBHOOK_SECRET")?.trim();
    if (!expected || !secret) throw new UnauthorizedException("Webhook de encuestas no configurado");
    const receivedBuffer = Buffer.from(secret);
    const expectedBuffer = Buffer.from(expected);
    if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
      throw new UnauthorizedException("Firma de webhook no válida");
    }
  }

  private isUniqueViolation(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private async audit(actor: AuthUser, action: string, entity: string, entityId: string, before?: unknown, after?: unknown, branchId?: string) {
    return this.auditWith(this.prisma, actor, action, entity, entityId, before, after, branchId);
  }

  private async auditWith(client: TransactionClient | PrismaService, actor: AuthUser, action: string, entity: string, entityId: string, before?: unknown, after?: unknown, branchId?: string) {
    await client.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        branchId,
        userId: actor.id,
        actorUserId: actor.id,
        action,
        entity,
        entityId,
        before: this.toJson(before),
        after: this.toJson(after),
        correlationId: randomUUID()
      }
    });
  }

  private async systemAudit(organizationId: string, branchId: string, userId: string, action: string, entityId: string, after: unknown) {
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        branchId,
        userId,
        actorUserId: userId,
        action,
        entity: "SurveyInvitation",
        entityId,
        after: this.toJson(after),
        correlationId: randomUUID()
      }
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
