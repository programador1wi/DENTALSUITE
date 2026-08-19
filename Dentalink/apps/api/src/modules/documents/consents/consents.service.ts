import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ConsentScopeType,
  ConsentStatus,
  ConsentTemplateStatus,
  ConsentTemplateVersionStatus,
  Prisma
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AuthUser } from "../../../common/types/auth-user";
import { branchScope } from "../../../common/utils/branch-scope.util";
import { resolvePagination } from "../../../common/utils/pagination.util";
import { PrismaService } from "../../../database/prisma.service";
import {
  AddConsentSignatureDto,
  ConsentTemplateDraftDto,
  ConsentTemplateListQueryDto,
  FinalizeConsentDto,
  GeneratePatientConsentDto,
  PatientConsentListQueryDto,
  PreviewConsentTemplateDto,
  UpdateConsentFieldsDto,
  UpdateConsentTemplateDraftDto,
  VersionedActionDto,
  VoidConsentDto
} from "./consent.dto";
import {
  CONSENT_VARIABLES,
  assertDocumentHash,
  contentHash,
  enabledSignerTypes,
  extractManualFieldDefinitions,
  htmlToPlainText,
  parseRequiredSigners,
  renderConsentHtml,
  requiredSignerTypes,
  validateConsentTemplate,
  validateManualValues,
  type RequiredSigners
} from "./consent-domain";

type RequestContext = {
  correlationId?: string;
  userAgent?: string;
  ipAddress?: string;
};

type TemplateDraftInput = ConsentTemplateDraftDto | UpdateConsentTemplateDraftDto;

const SIGNATURE_STORAGE_ROOT = resolve(process.cwd(), "storage", "consent-signatures");
const PDF_STORAGE_ROOT = resolve(process.cwd(), "storage", "consent-pdfs");
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const ENCRYPTED_FILE_MAGIC = Buffer.from("DWCNS1");
const ACCEPTED_SIGNATURE_MIME = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"]
]);

@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}

  variableCatalog() {
    return CONSENT_VARIABLES;
  }

  async listTemplates(actor: AuthUser, query: ConsentTemplateListQueryDto) {
    const { skip, take } = resolvePagination(query);
    if (query.branchId && !actor.branchIds.includes(query.branchId)) {
      throw new ForbiddenException("No tienes acceso a la sucursal solicitada.");
    }
    const where: Prisma.ConsentTemplateWhereInput = {
      organizationId: actor.organizationId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search.trim(), mode: "insensitive" } },
              { internalDescription: { contains: query.search.trim(), mode: "insensitive" } }
            ]
          }
        : {}),
      ...(query.status === "DRAFT"
        ? {
            OR: [
              { status: ConsentTemplateStatus.DRAFT },
              { versions: { some: { status: ConsentTemplateVersionStatus.DRAFT } } }
            ]
          }
        : query.status
          ? { status: query.status as ConsentTemplateStatus }
          : {}),
      ...(query.scopeType ? { scopeType: query.scopeType as ConsentScopeType } : {}),
      ...(query.branchId
        ? {
            OR: [
              { scopeType: ConsentScopeType.ORGANIZATION },
              { branches: { some: { branchId: query.branchId } } }
            ]
          }
        : {}),
      ...(query.authorId ? { createdById: query.authorId } : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : {})
            }
          }
        : {}),
      ...(query.updatedFrom || query.updatedTo
        ? {
            updatedAt: {
              ...(query.updatedFrom ? { gte: new Date(query.updatedFrom) } : {}),
              ...(query.updatedTo ? { lte: new Date(query.updatedTo) } : {})
            }
          }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.consentTemplate.findMany({
        where,
        include: this.templateInclude(),
        skip,
        take,
        orderBy: { updatedAt: "desc" }
      }),
      this.prisma.consentTemplate.count({ where })
    ]);
    const userIds = [...new Set(rows.flatMap((row) => [row.createdById, row.updatedById]).filter(Boolean))] as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { organizationId: actor.organizationId, id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true }
        })
      : [];
    const userMap = new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]));
    return {
      items: rows.map((row) => this.serializeTemplate(row, userMap)),
      total,
      skip,
      take
    };
  }

  async getTemplate(actor: AuthUser, id: string) {
    const template = await this.prisma.consentTemplate.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: this.templateInclude()
    });
    if (!template) throw new NotFoundException("Plantilla de consentimiento no encontrada.");
    return this.serializeTemplate(template);
  }

  async createTemplate(actor: AuthUser, dto: ConsentTemplateDraftDto, context: RequestContext = {}) {
    const input = await this.normalizeTemplateInput(actor, dto);
    const validation = validateConsentTemplate(input.editorSchemaJson, input.requiredSigners);
    const html = renderConsentHtml(input.editorSchemaJson, this.sampleValues(), { preview: true });
    const hash = contentHash({
      editorSchemaJson: input.editorSchemaJson,
      requiredSigners: input.requiredSigners
    });
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const template = await tx.consentTemplate.create({
          data: {
            organizationId: actor.organizationId,
            name: input.name,
            internalDescription: input.internalDescription,
            content: htmlToPlainText(html),
            scopeType: input.scopeType,
            specialtyId: input.specialtyId,
            treatmentTypeIds: input.treatmentTypeIds,
            status: ConsentTemplateStatus.DRAFT,
            isActive: false,
            createdById: actor.id,
            updatedById: actor.id,
            branches: input.branchIds.length
              ? { createMany: { data: input.branchIds.map((branchId) => ({ branchId })) } }
              : undefined,
            versions: {
              create: {
                versionNumber: 1,
                status: ConsentTemplateVersionStatus.DRAFT,
                editorSchemaJson: this.json(input.editorSchemaJson),
                sanitizedHtmlSnapshot: html,
                requiredSignersJson: this.json(input.requiredSigners),
                variablesManifestJson: this.json(validation.manifest),
                contentHash: hash,
                createdById: actor.id
              }
            }
          }
        });
        await this.audit(tx, actor, context, {
          entity: "ConsentTemplate",
          entityId: template.id,
          action: "consent_template.created",
          after: { name: template.name, scopeType: template.scopeType, status: template.status }
        });
        await this.outbox(tx, actor, "ConsentTemplate", template.id, "consent_template.created", context);
        return template;
      });
      return { ...(await this.getTemplate(actor, created.id)), validation };
    } catch (error) {
      this.rethrowUniqueName(error);
    }
  }

  async updateTemplateDraft(actor: AuthUser, id: string, dto: UpdateConsentTemplateDraftDto, context: RequestContext = {}) {
    const input = await this.normalizeTemplateInput(actor, dto);
    const template = await this.prisma.consentTemplate.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { versions: { where: { status: ConsentTemplateVersionStatus.DRAFT }, orderBy: { versionNumber: "desc" }, take: 1 } }
    });
    if (!template) throw new NotFoundException("Plantilla de consentimiento no encontrada.");
    if (template.version !== dto.expectedVersion) this.versionConflict();
    const draft = template.versions[0];
    if (!draft) {
      throw new ConflictException("La versión publicada es inmutable. Crea una nueva versión antes de editar.");
    }
    const validation = validateConsentTemplate(input.editorSchemaJson, input.requiredSigners);
    const html = renderConsentHtml(input.editorSchemaJson, this.sampleValues(), { preview: true });
    const hash = contentHash({
      editorSchemaJson: input.editorSchemaJson,
      requiredSigners: input.requiredSigners
    });
    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.consentTemplate.updateMany({
          where: { id, organizationId: actor.organizationId, version: dto.expectedVersion },
          data: {
            name: input.name,
            internalDescription: input.internalDescription,
            content: htmlToPlainText(html),
            scopeType: input.scopeType,
            specialtyId: input.specialtyId,
            treatmentTypeIds: input.treatmentTypeIds,
            updatedById: actor.id,
            version: { increment: 1 }
          }
        });
        if (updated.count !== 1) this.versionConflict();
        await tx.consentTemplateBranch.deleteMany({ where: { templateId: id } });
        if (input.branchIds.length) {
          await tx.consentTemplateBranch.createMany({
            data: input.branchIds.map((branchId) => ({ templateId: id, branchId }))
          });
        }
        await tx.consentTemplateVersion.update({
          where: { id: draft.id },
          data: {
            editorSchemaJson: this.json(input.editorSchemaJson),
            sanitizedHtmlSnapshot: html,
            requiredSignersJson: this.json(input.requiredSigners),
            variablesManifestJson: this.json(validation.manifest),
            contentHash: hash
          }
        });
        await this.audit(tx, actor, context, {
          entity: "ConsentTemplate",
          entityId: id,
          action: "consent_template.draft_updated",
          before: { version: template.version, name: template.name },
          after: { version: template.version + 1, name: input.name, draftVersion: draft.versionNumber }
        });
      });
      return { ...(await this.getTemplate(actor, id)), validation };
    } catch (error) {
      this.rethrowUniqueName(error);
    }
  }

  async previewTemplate(dto: PreviewConsentTemplateDto) {
    const signers = parseRequiredSigners(dto.requiredSigners);
    const validation = validateConsentTemplate(dto.editorSchemaJson, signers);
    const values = this.sampleValues();
    const html = this.documentShell(
      "VISTA PREVIA · DATOS FICTICIOS",
      renderConsentHtml(dto.editorSchemaJson, values, { preview: true }),
      signers
    );
    return {
      html,
      validation,
      sampleValues: values,
      documentHash: contentHash({ editorSchemaJson: dto.editorSchemaJson, values })
    };
  }

  async publishTemplate(actor: AuthUser, id: string, dto: VersionedActionDto, context: RequestContext = {}) {
    const template = await this.prisma.consentTemplate.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        versions: { where: { status: ConsentTemplateVersionStatus.DRAFT }, orderBy: { versionNumber: "desc" }, take: 1 }
      }
    });
    if (!template) throw new NotFoundException("Plantilla de consentimiento no encontrada.");
    if (template.version !== dto.expectedVersion) this.versionConflict();
    const draft = template.versions[0];
    if (!draft) throw new ConflictException("No existe un borrador para publicar.");
    const signers = parseRequiredSigners(draft.requiredSignersJson);
    const validation = validateConsentTemplate(draft.editorSchemaJson, signers);
    if (validation.errors.length) {
      throw new BadRequestException({
        message: "La plantilla contiene errores y no puede publicarse.",
        errors: validation.errors,
        warnings: validation.warnings
      });
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.consentTemplate.updateMany({
        where: { id, organizationId: actor.organizationId, version: dto.expectedVersion },
        data: {
          status: ConsentTemplateStatus.PUBLISHED,
          isActive: true,
          currentPublishedVersionId: draft.id,
          updatedById: actor.id,
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) this.versionConflict();
      await tx.consentTemplateVersion.update({
        where: { id: draft.id },
        data: {
          status: ConsentTemplateVersionStatus.PUBLISHED,
          publishedById: actor.id,
          publishedAt: new Date()
        }
      });
      await this.audit(tx, actor, context, {
        entity: "ConsentTemplate",
        entityId: id,
        action: "consent_template.version_published",
        before: { status: template.status, version: template.version },
        after: { status: "PUBLISHED", templateVersion: draft.versionNumber, version: template.version + 1 }
      });
      await this.outbox(tx, actor, "ConsentTemplate", id, "consent_template.version_published", context, {
        templateVersionId: draft.id,
        versionNumber: draft.versionNumber
      });
    });
    return this.getTemplate(actor, id);
  }

  async createNewVersion(actor: AuthUser, id: string, dto: VersionedActionDto, context: RequestContext = {}) {
    const template = await this.prisma.consentTemplate.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { versions: { orderBy: { versionNumber: "desc" } }, currentPublishedVersion: true }
    });
    if (!template) throw new NotFoundException("Plantilla de consentimiento no encontrada.");
    if (template.version !== dto.expectedVersion) this.versionConflict();
    if (template.versions.some((version) => version.status === ConsentTemplateVersionStatus.DRAFT)) {
      throw new ConflictException("Ya existe una versión en borrador.");
    }
    if (!template.currentPublishedVersion) throw new ConflictException("La plantilla todavía no tiene una versión publicada.");
    const nextNumber = (template.versions[0]?.versionNumber ?? 0) + 1;
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.consentTemplate.updateMany({
        where: { id, organizationId: actor.organizationId, version: dto.expectedVersion },
        data: { updatedById: actor.id, version: { increment: 1 } }
      });
      if (updated.count !== 1) this.versionConflict();
      await tx.consentTemplateVersion.create({
        data: {
          templateId: id,
          versionNumber: nextNumber,
          status: ConsentTemplateVersionStatus.DRAFT,
          editorSchemaJson: this.json(template.currentPublishedVersion!.editorSchemaJson),
          sanitizedHtmlSnapshot: template.currentPublishedVersion!.sanitizedHtmlSnapshot,
          requiredSignersJson: this.json(template.currentPublishedVersion!.requiredSignersJson),
          variablesManifestJson: this.json(template.currentPublishedVersion!.variablesManifestJson),
          contentHash: template.currentPublishedVersion!.contentHash,
          createdById: actor.id
        }
      });
      await this.audit(tx, actor, context, {
        entity: "ConsentTemplate",
        entityId: id,
        action: "consent_template.new_version",
        after: { versionNumber: nextNumber }
      });
    });
    return this.getTemplate(actor, id);
  }

  async duplicateTemplate(actor: AuthUser, id: string, context: RequestContext = {}) {
    const source = await this.prisma.consentTemplate.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        currentPublishedVersion: true,
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        branches: true
      }
    });
    if (!source) throw new NotFoundException("Plantilla de consentimiento no encontrada.");
    const sourceVersion = source.currentPublishedVersion ?? source.versions[0];
    if (!sourceVersion) throw new ConflictException("La plantilla no contiene una versión para duplicar.");
    const name = await this.nextCopyName(actor.organizationId, source.name);
    const created = await this.prisma.$transaction(async (tx) => {
      const template = await tx.consentTemplate.create({
        data: {
          organizationId: actor.organizationId,
          name,
          internalDescription: source.internalDescription,
          content: source.content,
          procedureId: source.procedureId,
          scopeType: source.scopeType,
          specialtyId: source.specialtyId,
          treatmentTypeIds: source.treatmentTypeIds,
          status: ConsentTemplateStatus.DRAFT,
          isActive: false,
          createdById: actor.id,
          updatedById: actor.id,
          branches: source.branches.length
            ? { createMany: { data: source.branches.map((branch) => ({ branchId: branch.branchId })) } }
            : undefined,
          versions: {
            create: {
              versionNumber: 1,
              editorSchemaJson: this.json(sourceVersion.editorSchemaJson),
              sanitizedHtmlSnapshot: sourceVersion.sanitizedHtmlSnapshot,
              requiredSignersJson: this.json(sourceVersion.requiredSignersJson),
              variablesManifestJson: this.json(sourceVersion.variablesManifestJson),
              contentHash: sourceVersion.contentHash,
              createdById: actor.id
            }
          }
        }
      });
      await this.audit(tx, actor, context, {
        entity: "ConsentTemplate",
        entityId: template.id,
        action: "consent_template.duplicated",
        before: { sourceTemplateId: source.id },
        after: { name }
      });
      return template;
    });
    return this.getTemplate(actor, created.id);
  }

  async deactivateTemplate(actor: AuthUser, id: string, dto: VersionedActionDto, context: RequestContext = {}) {
    const template = await this.prisma.consentTemplate.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!template) throw new NotFoundException("Plantilla de consentimiento no encontrada.");
    if (template.version !== dto.expectedVersion) this.versionConflict();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.consentTemplate.updateMany({
        where: { id, organizationId: actor.organizationId, version: dto.expectedVersion },
        data: {
          status: ConsentTemplateStatus.INACTIVE,
          isActive: false,
          updatedById: actor.id,
          version: { increment: 1 }
        }
      });
      if (result.count !== 1) this.versionConflict();
      await this.audit(tx, actor, context, {
        entity: "ConsentTemplate",
        entityId: id,
        action: "consent_template.deactivated",
        before: { status: template.status, isActive: template.isActive },
        after: { status: "INACTIVE", isActive: false }
      });
      await this.outbox(tx, actor, "ConsentTemplate", id, "consent_template.deactivated", context);
      return tx.consentTemplate.findUnique({ where: { id } });
    });
    return updated;
  }

  async listTemplateVersions(actor: AuthUser, id: string) {
    await this.ensureTemplate(actor, id);
    return this.prisma.consentTemplateVersion.findMany({
      where: { templateId: id, template: { organizationId: actor.organizationId } },
      orderBy: { versionNumber: "desc" }
    });
  }

  async listTemplateAudit(actor: AuthUser, id: string) {
    await this.ensureTemplate(actor, id);
    return this.auditHistory(actor, "ConsentTemplate", id);
  }

  async listPatientConsents(actor: AuthUser, patientId: string, query: PatientConsentListQueryDto) {
    await this.ensurePatient(actor, patientId);
    const { skip, take } = resolvePagination(query);
    const rows = await this.prisma.consent.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        patientId,
        ...(query.status ? { status: query.status as ConsentStatus } : {})
      },
      include: this.consentInclude(),
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => this.serializeConsent(row));
  }

  async getConsent(actor: AuthUser, id: string) {
    const consent = await this.prisma.consent.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: this.consentInclude()
    });
    if (!consent) throw new NotFoundException("Consentimiento no encontrado.");
    return this.serializeConsent(consent);
  }

  async generatePatientConsent(
    actor: AuthUser,
    patientId: string,
    dto: GeneratePatientConsentDto,
    idempotencyKey: string | undefined,
    context: RequestContext = {}
  ) {
    const key = idempotencyKey?.trim();
    if (!key) throw new BadRequestException("Idempotency-Key es obligatorio.");
    const existing = await this.prisma.consent.findUnique({
      where: { organizationId_idempotencyKey: { organizationId: actor.organizationId, idempotencyKey: key } },
      include: this.consentInclude()
    });
    if (existing) {
      if (
        existing.patientId !== patientId ||
        existing.templateId !== dto.templateId ||
        existing.treatmentPlanId !== (dto.treatmentPlanId ?? null) ||
        existing.appointmentId !== (dto.appointmentId ?? null)
      ) {
        throw new ConflictException("La clave de idempotencia ya fue utilizada con una solicitud diferente.");
      }
      return this.serializeConsent(existing);
    }

    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: { branch: true, organization: true }
    });
    if (!patient) throw new NotFoundException("Paciente no encontrado.");
    const template = await this.prisma.consentTemplate.findFirst({
      where: {
        id: dto.templateId,
        organizationId: actor.organizationId,
        status: ConsentTemplateStatus.PUBLISHED,
        isActive: true
      },
      include: { currentPublishedVersion: true, branches: true }
    });
    if (!template?.currentPublishedVersion) {
      throw new NotFoundException("La plantilla no está publicada o fue deshabilitada.");
    }
    if (
      template.scopeType === ConsentScopeType.BRANCHES &&
      !template.branches.some((scope) => scope.branchId === patient.branchId)
    ) {
      throw new ForbiddenException("La plantilla no está habilitada para la sucursal del paciente.");
    }
    const appointment = dto.appointmentId
      ? await this.prisma.appointment.findFirst({
          where: {
            id: dto.appointmentId,
            organizationId: actor.organizationId,
            patientId,
            branchId: patient.branchId
          },
          include: { professional: { include: { specialties: { include: { specialty: true } } } } }
        })
      : null;
    if (dto.appointmentId && !appointment) throw new BadRequestException("La cita no pertenece al paciente.");
    const treatment = dto.treatmentPlanId
      ? await this.prisma.treatmentPlan.findFirst({
          where: { id: dto.treatmentPlanId, organizationId: actor.organizationId, patientId, branchId: patient.branchId },
          include: {
            professional: { include: { specialties: { include: { specialty: true } } } },
            items: { select: { procedureId: true } }
          }
        })
      : null;
    if (dto.treatmentPlanId && !treatment) throw new BadRequestException("El tratamiento no pertenece al paciente.");
    const professionalId = dto.professionalId ?? treatment?.professionalId ?? appointment?.professionalId ?? null;
    const professional = professionalId
      ? await this.prisma.professional.findFirst({
          where: { id: professionalId, organizationId: actor.organizationId, isActive: true },
          include: { specialties: { include: { specialty: true } } }
        })
      : null;
    if (professionalId && !professional) throw new BadRequestException("El profesional no está disponible en la organización.");
    if (template.scopeType === ConsentScopeType.SPECIALTY) {
      const clinicalSpecialtyIds = new Set(
        [
          treatment?.specialtyId,
          appointment?.specialtyId,
          ...(professional?.specialties.map((item) => item.specialtyId) ?? [])
        ].filter((value): value is string => Boolean(value))
      );
      if (!template.specialtyId || !clinicalSpecialtyIds.has(template.specialtyId)) {
        throw new ForbiddenException("La plantilla no corresponde a la especialidad del contexto clínico.");
      }
    }
    if (template.scopeType === ConsentScopeType.TREATMENTS) {
      const procedureIds = new Set(treatment?.items.map((item) => item.procedureId) ?? []);
      if (!template.treatmentTypeIds.some((procedureId) => procedureIds.has(procedureId))) {
        throw new ForbiddenException("La plantilla no corresponde a los tratamientos del plan seleccionado.");
      }
    }
    if (dto.supersedesConsentId) {
      const superseded = await this.prisma.consent.findFirst({
        where: {
          id: dto.supersedesConsentId,
          organizationId: actor.organizationId,
          patientId,
          branchId: patient.branchId
        }
      });
      if (!superseded) throw new BadRequestException("El consentimiento corregido no pertenece al paciente.");
    }

    const editor = template.currentPublishedVersion.editorSchemaJson;
    const automaticValues = this.resolveVariables({
      patient,
      professional,
      branch: patient.branch,
      organization: patient.organization,
      appointment,
      treatment
    });
    const allowedManualKeys = new Set(extractManualFieldDefinitions(editor).map((field) => field.key));
    const manualValues = Object.fromEntries(
      Object.entries(dto.values ?? {}).filter(([fieldKey]) => allowedManualKeys.has(fieldKey) || fieldKey.startsWith("representative."))
    );
    const mergedValues = { ...automaticValues, ...manualValues };
    const valueErrors = validateManualValues(editor, mergedValues);
    if (valueErrors.length) throw new BadRequestException({ message: "Faltan datos obligatorios.", errors: valueErrors });
    const signers = parseRequiredSigners(template.currentPublishedVersion.requiredSignersJson);
    const renderedHtml = this.documentShell(
      template.name,
      renderConsentHtml(editor, mergedValues),
      signers
    );
    const hash = contentHash({
      templateVersionId: template.currentPublishedVersion.id,
      renderedHtml,
      mergedValues
    });
    const correlationId = context.correlationId?.trim() || randomUUID();
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const consent = await tx.consent.create({
          data: {
            organizationId: actor.organizationId,
            branchId: patient.branchId,
            patientId,
            templateId: template.id,
            templateVersionId: template.currentPublishedVersion!.id,
            treatmentPlanId: treatment?.id,
            appointmentId: appointment?.id,
            professionalId,
            representativeId: dto.representativeId,
            contentSnapshot: htmlToPlainText(renderedHtml),
            mergedValuesJson: this.json({
              ...mergedValues,
              _requiredSigners: signers
            }),
            renderedHtmlSnapshot: renderedHtml,
            documentHash: hash,
            status: ConsentStatus.READY_FOR_SIGNATURE,
            readyAt: new Date(),
            supersedesConsentId: dto.supersedesConsentId,
            correlationId,
            idempotencyKey: key,
            createdById: actor.id
          }
        });
        await this.audit(tx, actor, { ...context, correlationId }, {
          entity: "Consent",
          entityId: consent.id,
          action: "consent_instance.generated",
          branchId: patient.branchId,
          after: {
            patientId,
            templateId: template.id,
            templateVersionId: template.currentPublishedVersion!.id,
            documentHash: hash
          }
        });
        await this.outbox(tx, actor, "Consent", consent.id, "consent_instance.generated", { ...context, correlationId }, {
          patientId,
          branchId: patient.branchId,
          templateVersionId: template.currentPublishedVersion!.id
        });
        return consent;
      });
      return this.getConsent(actor, created.id);
    } catch (error) {
      if (this.isUnique(error)) {
        const retry = await this.prisma.consent.findUnique({
          where: { organizationId_idempotencyKey: { organizationId: actor.organizationId, idempotencyKey: key } },
          include: this.consentInclude()
        });
        if (retry) return this.serializeConsent(retry);
      }
      throw error;
    }
  }

  async updateConsentFields(actor: AuthUser, id: string, dto: UpdateConsentFieldsDto, context: RequestContext = {}) {
    const consent = await this.ensureMutableConsent(actor, id);
    if (consent.version !== dto.expectedVersion) this.versionConflict();
    if (consent.signatures.length) throw new ConflictException("El contenido queda bloqueado después de la primera firma.");
    const allowedKeys = new Set(extractManualFieldDefinitions(consent.templateVersion.editorSchemaJson).map((field) => field.key));
    const incoming = Object.fromEntries(Object.entries(dto.values).filter(([key]) => allowedKeys.has(key) || key.startsWith("representative.")));
    const current = this.record(consent.mergedValuesJson);
    const merged = { ...current, ...incoming };
    const errors = validateManualValues(consent.templateVersion.editorSchemaJson, merged);
    if (errors.length) throw new BadRequestException({ message: "Los campos contienen errores.", errors });
    const signers = parseRequiredSigners(consent.templateVersion.requiredSignersJson);
    const html = this.documentShell(
      consent.template.name,
      renderConsentHtml(consent.templateVersion.editorSchemaJson, merged),
      signers
    );
    const hash = contentHash({ templateVersionId: consent.templateVersionId, renderedHtml: html, mergedValues: merged });
    const result = await this.prisma.consent.updateMany({
      where: { id, organizationId: actor.organizationId, version: dto.expectedVersion },
      data: {
        mergedValuesJson: this.json(merged),
        renderedHtmlSnapshot: html,
        contentSnapshot: htmlToPlainText(html),
        documentHash: hash,
        version: { increment: 1 }
      }
    });
    if (result.count !== 1) this.versionConflict();
    await this.audit(this.prisma, actor, context, {
      entity: "Consent",
      entityId: id,
      action: "consent_instance.fields_updated",
      branchId: consent.branchId,
      after: { fieldKeys: Object.keys(incoming), documentHash: hash, version: consent.version + 1 }
    });
    return this.getConsent(actor, id);
  }

  async prepareSignature(actor: AuthUser, id: string) {
    const consent = await this.getConsentRecord(actor, id);
    if (this.isTerminalConsentStatus(consent.status)) {
      throw new ConflictException("El consentimiento ya no admite firmas.");
    }
    const signers = parseRequiredSigners(consent.templateVersion.requiredSignersJson);
    const signedTypes = consent.signatures.map((signature) => signature.signerType);
    return {
      consentId: consent.id,
      documentHash: consent.documentHash,
      renderedHtmlSnapshot: consent.renderedHtmlSnapshot,
      enabledSigners: enabledSignerTypes(signers),
      requiredSigners: requiredSignerTypes(signers),
      missingRequiredSigners: requiredSignerTypes(signers).filter((type) => !signedTypes.includes(type)),
      acceptanceText: "Declaro haber leído, comprendido y aceptado el contenido íntegro de este consentimiento informado.",
      acceptanceTextVersion: "consent-acceptance-v1"
    };
  }

  async addSignature(
    actor: AuthUser,
    id: string,
    dto: AddConsentSignatureDto,
    context: RequestContext = {}
  ) {
    this.assertSignerPermission(actor, dto.signerType);
    const consent = await this.getConsentRecord(actor, id);
    if (this.isTerminalConsentStatus(consent.status)) {
      throw new ConflictException("El consentimiento ya no admite firmas.");
    }
    assertDocumentHash(consent.documentHash, dto.documentHash);
    const signers = parseRequiredSigners(consent.templateVersion.requiredSignersJson);
    if (!enabledSignerTypes(signers).includes(dto.signerType)) {
      throw new BadRequestException("Ese tipo de firmante no está habilitado en la plantilla.");
    }
    if (consent.signatures.some((signature) => signature.signerType === dto.signerType)) {
      throw new ConflictException("Ese firmante ya registró una firma.");
    }
    if (dto.signatureMethod === "SAVED_PROFESSIONAL_SIGNATURE" && dto.signerType !== "PROFESSIONAL") {
      throw new BadRequestException("La firma guardada solo puede utilizarse para un profesional.");
    }
    const signature = this.parseSignature(dto.signatureDataUrl);
    const signatureId = randomUUID();
    const relativeKey = `${actor.organizationId}/${consent.patientId}/${consent.id}/${signatureId}.${signature.extension}`;
    const targetPath = resolve(SIGNATURE_STORAGE_ROOT, relativeKey);
    await mkdir(resolve(targetPath, ".."), { recursive: true });
    await this.writeEncryptedFile(targetPath, signature.bytes);
    const checksum = createHash("sha256").update(signature.bytes).digest("hex");
    const correlationId = context.correlationId?.trim() || consent.correlationId || randomUUID();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.documentSignature.create({
          data: {
            id: signatureId,
            consentId: consent.id,
            signerName: dto.signerName.trim(),
            signerType: dto.signerType,
            signerReferenceId: dto.signerReferenceId,
            signatureMethod: dto.signatureMethod,
            signatureData: "",
            signatureStorageKey: relativeKey,
            signatureMimeType: signature.mimeType,
            signatureSize: signature.bytes.length,
            signatureChecksum: checksum,
            documentHash: consent.documentHash,
            acceptanceText: dto.acceptanceText.trim(),
            acceptanceTextVersion: dto.acceptanceTextVersion.trim(),
            timezone: dto.timezone,
            ipAddress: this.protectIp(context.ipAddress),
            userAgent: this.cleanAgent(context.userAgent),
            facilitatedById: actor.id,
            branchId: consent.branchId,
            correlationId
          }
        });
        await tx.consent.update({
          where: { id: consent.id },
          data: { status: ConsentStatus.PARTIALLY_SIGNED, version: { increment: 1 } }
        });
        await this.audit(tx, actor, { ...context, correlationId }, {
          entity: "Consent",
          entityId: consent.id,
          action: "consent_instance.signature_added",
          branchId: consent.branchId,
          after: {
            signerType: dto.signerType,
            signatureMethod: dto.signatureMethod,
            documentHash: consent.documentHash,
            signatureChecksum: checksum
          }
        });
        await this.outbox(tx, actor, "Consent", consent.id, "consent_instance.signature_added", { ...context, correlationId }, {
          signerType: dto.signerType,
          branchId: consent.branchId
        });
      });
    } catch (error) {
      await unlink(targetPath).catch(() => undefined);
      if (this.isUnique(error)) throw new ConflictException("Ese firmante ya registró una firma.");
      throw error;
    }
    return this.getConsent(actor, id);
  }

  async finalizeConsent(actor: AuthUser, id: string, dto: FinalizeConsentDto, context: RequestContext = {}) {
    const consent = await this.getConsentRecord(actor, id);
    if (consent.version !== dto.expectedVersion) this.versionConflict();
    if (consent.status === ConsentStatus.SIGNED) return this.serializeConsent(consent);
    if (this.isClosedWithoutCompletion(consent.status)) {
      throw new ConflictException("El consentimiento ya no puede finalizarse.");
    }
    assertDocumentHash(consent.documentHash, dto.documentHash);
    const signers = parseRequiredSigners(consent.templateVersion.requiredSignersJson);
    const signedTypes = consent.signatures.map((signature) => signature.signerType);
    const missing = requiredSignerTypes(signers).filter((type) => !signedTypes.includes(type));
    if (missing.length) {
      throw new BadRequestException({
        message: "No se puede finalizar: faltan firmas obligatorias.",
        missingSigners: missing
      });
    }
    const pdfBytes = await this.generatePdf(consent);
    const relativeKey = `${actor.organizationId}/${consent.patientId}/${consent.id}.pdf`;
    const targetPath = resolve(PDF_STORAGE_ROOT, relativeKey);
    await mkdir(resolve(targetPath, ".."), { recursive: true });
    await this.writeEncryptedFile(targetPath, pdfBytes);
    const checksum = createHash("sha256").update(pdfBytes).digest("hex");
    const now = new Date();
    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.consent.updateMany({
          where: { id, organizationId: actor.organizationId, version: dto.expectedVersion },
          data: {
            status: ConsentStatus.SIGNED,
            signedAt: now,
            completedAt: now,
            pdfStorageKey: relativeKey,
            pdfMimeType: "application/pdf",
            pdfSize: pdfBytes.length,
            pdfChecksum: checksum,
            version: { increment: 1 }
          }
        });
        if (updated.count !== 1) this.versionConflict();
        await this.audit(tx, actor, context, {
          entity: "Consent",
          entityId: id,
          action: "consent_instance.completed",
          branchId: consent.branchId,
          after: {
            documentHash: consent.documentHash,
            pdfChecksum: checksum,
            signatureCount: consent.signatures.length
          }
        });
        await this.outbox(tx, actor, "Consent", id, "consent_instance.completed", context, {
          patientId: consent.patientId,
          branchId: consent.branchId,
          documentHash: consent.documentHash
        });
        await this.outbox(tx, actor, "Consent", id, "consent_instance.pdf_generated", context, {
          pdfChecksum: checksum
        });
      });
    } catch (error) {
      await unlink(targetPath).catch(() => undefined);
      throw error;
    }
    return this.getConsent(actor, id);
  }

  async voidConsent(actor: AuthUser, id: string, dto: VoidConsentDto, context: RequestContext = {}) {
    const consent = await this.getConsentRecord(actor, id);
    if (consent.version !== dto.expectedVersion) this.versionConflict();
    if (consent.status === ConsentStatus.VOIDED) throw new ConflictException("El consentimiento ya fue anulado.");
    const user = await this.prisma.user.findFirst({
      where: { id: actor.id, organizationId: actor.organizationId, isActive: true },
      select: { passwordHash: true }
    });
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new ForbiddenException("La contraseña actual no es válida.");
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.consent.updateMany({
        where: { id, organizationId: actor.organizationId, version: dto.expectedVersion },
        data: {
          status: ConsentStatus.VOIDED,
          voidedAt: now,
          voidedById: actor.id,
          voidReason: dto.reason.trim(),
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) this.versionConflict();
      await this.audit(tx, actor, context, {
        entity: "Consent",
        entityId: id,
        action: "consent_instance.voided",
        branchId: consent.branchId,
        reason: dto.reason.trim(),
        before: { status: consent.status },
        after: { status: "VOIDED", originalPreserved: true }
      });
      await this.outbox(tx, actor, "Consent", id, "consent_instance.voided", context, {
        patientId: consent.patientId,
        branchId: consent.branchId
      });
    });
    return this.getConsent(actor, id);
  }

  async getPdf(actor: AuthUser, id: string, context: RequestContext = {}): Promise<{
    stream: Readable;
    fileName: string;
    mimeType: string;
    size: number;
  }> {
    const consent = await this.getConsentRecord(actor, id);
    if (consent.status !== ConsentStatus.SIGNED || !consent.pdfStorageKey) {
      throw new ConflictException("El PDF final solo está disponible cuando el consentimiento está completo.");
    }
    const targetPath = resolve(PDF_STORAGE_ROOT, consent.pdfStorageKey);
    await stat(targetPath).catch(() => {
      throw new NotFoundException("El archivo PDF final no está disponible.");
    });
    const pdfBytes = await this.readEncryptedFile(targetPath);
    await this.audit(this.prisma, actor, context, {
      entity: "Consent",
      entityId: id,
      action: "consent_instance.pdf_downloaded",
      branchId: consent.branchId,
      after: { pdfChecksum: consent.pdfChecksum }
    });
    return {
      stream: Readable.from(pdfBytes),
      fileName: `consentimiento-${id}.pdf`,
      mimeType: consent.pdfMimeType ?? "application/pdf",
      size: consent.pdfSize ?? pdfBytes.length
    };
  }

  async getEvidence(actor: AuthUser, id: string) {
    const consent = await this.getConsentRecord(actor, id);
    return {
      consentId: consent.id,
      status: consent.status,
      templateVersionId: consent.templateVersionId,
      templateVersionNumber: consent.templateVersion.versionNumber,
      documentHash: consent.documentHash,
      pdfChecksum: consent.pdfChecksum,
      completedAt: consent.completedAt,
      voidedAt: consent.voidedAt,
      voidReason: consent.voidReason,
      signatures: consent.signatures.map((signature) => ({
        id: signature.id,
        signerType: signature.signerType,
        signerName: signature.signerName,
        signatureMethod: signature.signatureMethod,
        signedAt: signature.signedAt,
        timezone: signature.timezone,
        documentHash: signature.documentHash,
        signatureChecksum: signature.signatureChecksum,
        acceptanceText: signature.acceptanceText,
        acceptanceTextVersion: signature.acceptanceTextVersion,
        facilitatedById: signature.facilitatedById,
        branchId: signature.branchId,
        correlationId: signature.correlationId,
        ipAddress: signature.ipAddress
      }))
    };
  }

  async getConsentAudit(actor: AuthUser, id: string) {
    await this.getConsentRecord(actor, id);
    return this.auditHistory(actor, "Consent", id);
  }

  private async getConsentRecord(actor: AuthUser, id: string) {
    const consent = await this.prisma.consent.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: this.consentInclude()
    });
    if (!consent) throw new NotFoundException("Consentimiento no encontrado.");
    return consent;
  }

  private async ensureMutableConsent(actor: AuthUser, id: string) {
    const consent = await this.getConsentRecord(actor, id);
    if (this.isTerminalConsentStatus(consent.status)) {
      throw new ConflictException("El consentimiento es inmutable en su estado actual.");
    }
    return consent;
  }

  private async ensureTemplate(actor: AuthUser, id: string) {
    const template = await this.prisma.consentTemplate.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true }
    });
    if (!template) throw new NotFoundException("Plantilla de consentimiento no encontrada.");
    return template;
  }

  private async ensurePatient(actor: AuthUser, patientId: string) {
    const trimmed = patientId.trim();
    const isNumeric = /^\d+$/.test(trimmed);
    const patient = await this.prisma.patient.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        deletedAt: null,
        ...(isNumeric
          ? { OR: [{ id: trimmed }, { patientNumber: parseInt(trimmed, 10) }] }
          : { id: trimmed })
      },
      select: { id: true, branchId: true }
    });
    if (!patient) throw new NotFoundException("Paciente no encontrado.");
    return patient;
  }

  private async normalizeTemplateInput(actor: AuthUser, dto: TemplateDraftInput) {
    const name = dto.name.trim().replace(/\s+/g, " ");
    if (name.length < 3 || !/\S/.test(name)) throw new BadRequestException("El nombre debe tener entre 3 y 150 caracteres.");
    const branchIds = [...new Set(dto.branchIds ?? [])];
    if (dto.scopeType === "BRANCHES" && branchIds.length === 0) {
      throw new BadRequestException("Selecciona al menos una sucursal para ese alcance.");
    }
    if (branchIds.some((branchId) => !actor.branchIds.includes(branchId))) {
      throw new ForbiddenException("No puedes asignar la plantilla a una sucursal fuera de tu alcance.");
    }
    if (branchIds.length) {
      const count = await this.prisma.branch.count({
        where: { id: { in: branchIds }, organizationId: actor.organizationId, isActive: true }
      });
      if (count !== branchIds.length) throw new BadRequestException("Una o más sucursales no son válidas.");
    }
    if (dto.scopeType === "SPECIALTY" && !dto.specialtyId) {
      throw new BadRequestException("Selecciona una especialidad.");
    }
    if (dto.specialtyId) {
      const specialty = await this.prisma.specialty.findFirst({
        where: { id: dto.specialtyId, organizationId: actor.organizationId, isActive: true }
      });
      if (!specialty) throw new BadRequestException("La especialidad no es válida.");
    }
    if (dto.scopeType === "TREATMENTS" && !(dto.treatmentTypeIds?.length)) {
      throw new BadRequestException("Selecciona al menos un tipo de tratamiento.");
    }
    const treatmentTypeIds = [...new Set(dto.treatmentTypeIds ?? [])];
    if (treatmentTypeIds.length) {
      const count = await this.prisma.procedure.count({
        where: { id: { in: treatmentTypeIds }, organizationId: actor.organizationId, isActive: true }
      });
      if (count !== treatmentTypeIds.length) throw new BadRequestException("Uno o más tratamientos no son válidos.");
    }
    return {
      name,
      internalDescription: dto.internalDescription?.trim() || null,
      scopeType: dto.scopeType as ConsentScopeType,
      branchIds: dto.scopeType === "BRANCHES" ? branchIds : [],
      specialtyId: dto.scopeType === "SPECIALTY" ? dto.specialtyId ?? null : null,
      treatmentTypeIds: dto.scopeType === "TREATMENTS" ? treatmentTypeIds : [],
      editorSchemaJson: dto.editorSchemaJson,
      requiredSigners: parseRequiredSigners(dto.requiredSigners)
    };
  }

  private resolveVariables(input: {
    patient: {
      firstName: string;
      lastName: string;
      documentType: string | null;
      documentNumber: string | null;
      birthDate: Date | null;
      email: string | null;
      phone: string | null;
    };
    professional: {
      firstName: string;
      lastName: string;
      licenseNumber: string | null;
      specialties: Array<{ specialty: { name: string } }>;
    } | null;
    branch: { name: string; address: string | null; phone: string | null; timezone: string | null };
    organization: { name: string };
    appointment: { startAt: Date } | null;
    treatment: { name: string; description: string | null } | null;
  }) {
    const timezone = input.branch.timezone || "UTC";
    const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: timezone });
    const timeFormat = new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: timezone });
    const age = input.patient.birthDate
      ? Math.max(0, new Date().getUTCFullYear() - input.patient.birthDate.getUTCFullYear())
      : null;
    return {
      "patient.full_name": `${input.patient.firstName} ${input.patient.lastName}`.trim(),
      "patient.document_type": input.patient.documentType,
      "patient.document_number": input.patient.documentNumber,
      "patient.birth_date": input.patient.birthDate ? dateFormat.format(input.patient.birthDate) : null,
      "patient.age": age,
      "patient.email": input.patient.email,
      "patient.phone": input.patient.phone,
      "professional.full_name": input.professional
        ? `${input.professional.firstName} ${input.professional.lastName}`.trim()
        : null,
      "professional.license_number": input.professional?.licenseNumber ?? null,
      "professional.specialty": input.professional?.specialties[0]?.specialty.name ?? null,
      "organization.name": input.organization.name,
      "branch.name": input.branch.name,
      "branch.address": input.branch.address,
      "branch.phone": input.branch.phone,
      "appointment.date": input.appointment ? dateFormat.format(input.appointment.startAt) : null,
      "appointment.time": input.appointment ? timeFormat.format(input.appointment.startAt) : null,
      "treatment.name": input.treatment?.name ?? null,
      "treatment.description": input.treatment?.description ?? null,
      "treatment.estimated_cost": null,
      "system.current_date": dateFormat.format(new Date())
    };
  }

  private serializeTemplate(template: any, userMap = new Map<string, string>()) {
    const draft = template.versions?.find((version: any) => version.status === ConsentTemplateVersionStatus.DRAFT) ?? null;
    const editableVersion = draft ?? template.currentPublishedVersion ?? template.versions?.[0] ?? null;
    const validation = editableVersion
      ? validateConsentTemplate(editableVersion.editorSchemaJson, parseRequiredSigners(editableVersion.requiredSignersJson))
      : { errors: ["La plantilla no contiene versiones."], warnings: [], manifest: [], fieldKeys: [] };
    return {
      ...template,
      currentPublishedVersion: template.currentPublishedVersion
        ? {
            ...template.currentPublishedVersion,
            requiredSigners: parseRequiredSigners(template.currentPublishedVersion.requiredSignersJson)
          }
        : null,
      draftVersion: draft
        ? { ...draft, requiredSigners: parseRequiredSigners(draft.requiredSignersJson) }
        : null,
      editableVersion: editableVersion
        ? { ...editableVersion, requiredSigners: parseRequiredSigners(editableVersion.requiredSignersJson) }
        : null,
      branchIds: template.branches?.map((scope: any) => scope.branchId) ?? [],
      updatedByName: template.updatedById ? userMap.get(template.updatedById) ?? null : null,
      createdByName: template.createdById ? userMap.get(template.createdById) ?? null : null,
      generatedCount: template._count?.consents ?? 0,
      validation
    };
  }

  private serializeConsent(consent: any) {
    const signers = parseRequiredSigners(consent.templateVersion.requiredSignersJson);
    const signedTypes = consent.signatures.map((signature: any) => signature.signerType);
    return {
      ...consent,
      requiredSigners: signers,
      manualFields: extractManualFieldDefinitions(consent.templateVersion.editorSchemaJson),
      missingRequiredSigners: requiredSignerTypes(signers).filter((type) => !signedTypes.includes(type)),
      signatures: consent.signatures.map((signature: any) => ({
        id: signature.id,
        signerName: signature.signerName,
        signerType: signature.signerType,
        signatureMethod: signature.signatureMethod,
        signedAt: signature.signedAt,
        documentHash: signature.documentHash,
        signatureChecksum: signature.signatureChecksum
      }))
    };
  }

  private templateInclude() {
    return {
      branches: { include: { branch: { select: { id: true, name: true } } } },
      currentPublishedVersion: true,
      versions: { orderBy: { versionNumber: "desc" as const } },
      _count: { select: { consents: true } },
      procedure: { select: { id: true, code: true, name: true } }
    };
  }

  private consentInclude() {
    return {
      patient: { select: { id: true, firstName: true, lastName: true, branchId: true } },
      template: { select: { id: true, name: true, status: true } },
      templateVersion: true,
      treatmentPlan: { select: { id: true, name: true, status: true } },
      appointment: { select: { id: true, startAt: true, status: true } },
      signatures: { orderBy: { signedAt: "asc" as const } }
    };
  }

  private async generatePdf(consent: any) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pageSize: [number, number] = [595.28, 841.89];
    let page = pdf.addPage(pageSize);
    let y = 790;
    const drawLine = (text: string, options?: { bold?: boolean; size?: number }) => {
      const size = options?.size ?? 10;
      if (y < 55) {
        page = pdf.addPage(pageSize);
        y = 790;
      }
      page.drawText(text, {
        x: 48,
        y,
        size,
        font: options?.bold ? bold : font,
        color: rgb(0.1, 0.16, 0.24)
      });
      y -= size + 5;
    };
    drawLine(consent.template.name, { bold: true, size: 16 });
    drawLine(`Paciente: ${consent.patient.firstName} ${consent.patient.lastName}`, { size: 10 });
    drawLine(`Documento: ${consent.documentHash}`, { size: 7 });
    y -= 10;
    for (const paragraph of htmlToPlainText(consent.renderedHtmlSnapshot).split("\n")) {
      for (const line of this.wrapText(paragraph, 92)) drawLine(line || " ");
      y -= 3;
    }
    y -= 10;
    drawLine("Evidencia de firmas", { bold: true, size: 12 });
    for (const signature of consent.signatures) {
      drawLine(`${signature.signerType}: ${signature.signerName}`);
      drawLine(`Fecha UTC: ${signature.signedAt.toISOString()} · checksum ${signature.signatureChecksum}`, { size: 7 });
      if (signature.signatureStorageKey && signature.signatureMimeType) {
        const signaturePath = resolve(SIGNATURE_STORAGE_ROOT, signature.signatureStorageKey);
        const signatureBytes = await this.readEncryptedFile(signaturePath).catch(() => null);
        if (signatureBytes) {
          const image =
            signature.signatureMimeType === "image/png"
              ? await pdf.embedPng(signatureBytes)
              : await pdf.embedJpg(signatureBytes);
          const scaled = image.scaleToFit(150, 50);
          if (y < scaled.height + 55) {
            page = pdf.addPage(pageSize);
            y = 790;
          }
          page.drawImage(image, { x: 48, y: y - scaled.height, width: scaled.width, height: scaled.height });
          y -= scaled.height + 8;
        }
      }
      y -= 4;
    }
    drawLine(`Hash final: ${consent.documentHash}`, { size: 7 });
    return Buffer.from(await pdf.save());
  }

  private documentShell(title: string, body: string, signers: RequiredSigners) {
    const signatureBlocks = [
      signers.patient.enabled ? '<section class="consent-signature"><div></div><p>Firma del paciente</p></section>' : "",
      signers.professional.enabled ? '<section class="consent-signature"><div></div><p>Firma profesional</p></section>' : "",
      signers.representative.enabled ? '<section class="consent-signature"><div></div><p>Firma del representante</p></section>' : ""
    ].join("");
    return `<article class="consent-document"><header><p>Documento clínico</p><h1>${this.escape(title)}</h1></header><main>${body}</main><footer><div class="consent-signatures">${signatureBlocks}</div><p>La evidencia digital y el hash criptográfico forman parte integral de este documento.</p></footer></article>`;
  }

  private sampleValues() {
    return {
      "patient.full_name": "PACIENTE DE EJEMPLO",
      "patient.document_type": "Documento de identidad",
      "patient.document_number": "0000-EXAMPLE",
      "patient.birth_date": "1 de enero de 1990",
      "patient.age": "36",
      "patient.email": "paciente.ejemplo@invalid.test",
      "patient.phone": "+00 000 000 0000",
      "representative.full_name": "REPRESENTANTE DE EJEMPLO",
      "representative.document_number": "REP-0000",
      "representative.relationship": "Representante legal",
      "professional.full_name": "PROFESIONAL DE EJEMPLO",
      "professional.license_number": "LIC-EJEMPLO",
      "professional.specialty": "Odontología",
      "organization.name": "CLÍNICA DE EJEMPLO",
      "branch.name": "SUCURSAL DE EJEMPLO",
      "branch.address": "Dirección ficticia 123",
      "branch.phone": "+00 000 000 0000",
      "appointment.date": "27 de julio de 2026",
      "appointment.time": "10:30",
      "treatment.name": "TRATAMIENTO DE EJEMPLO",
      "treatment.description": "Descripción ficticia para vista previa",
      "treatment.estimated_cost": "$0.00",
      "system.current_date": "27 de julio de 2026"
    };
  }

  private parseSignature(dataUrl: string) {
    const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
    if (!match) throw new BadRequestException("La firma debe ser una imagen PNG o JPEG válida.");
    const mimeType = match[1];
    const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
    if (!bytes.length || bytes.length > MAX_SIGNATURE_BYTES) {
      throw new BadRequestException("La firma excede el tamaño permitido de 2 MB.");
    }
    return { mimeType, extension: ACCEPTED_SIGNATURE_MIME.get(mimeType)!, bytes };
  }

  private storageEncryptionKey() {
    const configured = process.env.CONSENT_STORAGE_ENCRYPTION_KEY?.trim();
    if (configured) {
      const key = /^[a-f0-9]{64}$/i.test(configured)
        ? Buffer.from(configured, "hex")
        : Buffer.from(configured, "base64");
      if (key.length !== 32) {
        throw new Error("CONSENT_STORAGE_ENCRYPTION_KEY debe contener exactamente 32 bytes.");
      }
      return key;
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("CONSENT_STORAGE_ENCRYPTION_KEY es obligatoria en producción.");
    }
    return createHash("sha256")
      .update(process.env.JWT_SECRET || "dentalink-local-consent-storage-key")
      .digest();
  }

  private async writeEncryptedFile(targetPath: string, plainBytes: Buffer) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.storageEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plainBytes), cipher.final()]);
    const tag = cipher.getAuthTag();
    await writeFile(targetPath, Buffer.concat([ENCRYPTED_FILE_MAGIC, iv, tag, encrypted]));
  }

  private async readEncryptedFile(targetPath: string) {
    const stored = await readFile(targetPath);
    if (!stored.subarray(0, ENCRYPTED_FILE_MAGIC.length).equals(ENCRYPTED_FILE_MAGIC)) {
      return stored;
    }
    const offset = ENCRYPTED_FILE_MAGIC.length;
    const iv = stored.subarray(offset, offset + 12);
    const tag = stored.subarray(offset + 12, offset + 28);
    const encrypted = stored.subarray(offset + 28);
    const decipher = createDecipheriv("aes-256-gcm", this.storageEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  private async nextCopyName(organizationId: string, sourceName: string) {
    for (let index = 1; index <= 999; index += 1) {
      const suffix = index === 1 ? " (copia)" : ` (copia ${index})`;
      const candidate = `${sourceName.slice(0, Math.max(3, 150 - suffix.length))}${suffix}`;
      const exists = await this.prisma.consentTemplate.findFirst({
        where: { organizationId, name: { equals: candidate, mode: "insensitive" } },
        select: { id: true }
      });
      if (!exists) return candidate;
    }
    throw new ConflictException("No fue posible generar un nombre único para la copia.");
  }

  private auditHistory(actor: AuthUser, entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { organizationId: actor.organizationId, entity, entityId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        branchId: true,
        userId: true,
        actorUserId: true,
        before: true,
        after: true,
        reason: true,
        correlationId: true,
        createdAt: true
      }
    });
  }

  private async audit(
    tx: Prisma.TransactionClient | PrismaService,
    actor: AuthUser,
    context: RequestContext,
    entry: {
      entity: string;
      entityId: string;
      action: string;
      branchId?: string;
      before?: unknown;
      after?: unknown;
      reason?: string;
    }
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        branchId: entry.branchId,
        userId: actor.id,
        actorUserId: actor.id,
        entity: entry.entity,
        entityId: entry.entityId,
        action: entry.action,
        before: entry.before === undefined ? undefined : this.json(entry.before),
        after: entry.after === undefined ? undefined : this.json(entry.after),
        reason: entry.reason,
        correlationId: context.correlationId?.trim() || undefined,
        ipAddress: this.protectIp(context.ipAddress),
        userAgent: this.cleanAgent(context.userAgent)
      }
    });
  }

  private async outbox(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    context: RequestContext,
    payload: Record<string, unknown> = {}
  ) {
    await tx.outboxEvent.create({
      data: {
        organizationId: actor.organizationId,
        aggregateType,
        aggregateId,
        eventType,
        payload: this.json({ aggregateId, ...payload }),
        correlationId: context.correlationId?.trim() || undefined,
        idempotencyKey: context.correlationId
          ? `${eventType}:${aggregateId}:${context.correlationId.trim()}`
          : undefined
      }
    });
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private json(value: unknown) {
    return value as Prisma.InputJsonValue;
  }

  private cleanAgent(value?: string) {
    return value?.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 500) || undefined;
  }

  private protectIp(value?: string) {
    if (!value) return undefined;
    const normalized = value.split(",")[0].trim();
    if (normalized.includes(":")) return `${normalized.split(":").slice(0, 4).join(":")}::/64`;
    const parts = normalized.split(".");
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : undefined;
  }

  private wrapText(value: string, limit: number) {
    if (!value.trim()) return [""];
    const words = value.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if (`${current} ${word}`.trim().length > limit && current) {
        lines.push(current);
        current = word;
      } else {
        current = `${current} ${word}`.trim();
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  private escape(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private assertSignerPermission(actor: AuthUser, signerType: AddConsentSignatureDto["signerType"]) {
    if (actor.permissions.includes("system.manage_all") || actor.permissions.includes("consents.sign")) return;
    const permissionByType: Record<AddConsentSignatureDto["signerType"], string> = {
      PATIENT: "consents.instances.sign_patient",
      PROFESSIONAL: "consents.instances.sign_professional",
      REPRESENTATIVE: "consents.instances.sign_representative"
    };
    if (!actor.permissions.includes(permissionByType[signerType])) {
      throw new ForbiddenException("No tienes permiso para registrar ese tipo de firma.");
    }
  }

  private isTerminalConsentStatus(status: ConsentStatus) {
    return (
      status === ConsentStatus.SIGNED ||
      status === ConsentStatus.VOIDED ||
      status === ConsentStatus.EXPIRED ||
      status === ConsentStatus.CANCELLED
    );
  }

  private isClosedWithoutCompletion(status: ConsentStatus) {
    return (
      status === ConsentStatus.VOIDED ||
      status === ConsentStatus.EXPIRED ||
      status === ConsentStatus.CANCELLED
    );
  }

  private versionConflict(): never {
    throw new ConflictException("La información fue modificada por otro usuario. Recarga antes de continuar.");
  }

  private rethrowUniqueName(error: unknown): never {
    if (this.isUnique(error)) {
      throw new ConflictException("Ya existe una plantilla con ese nombre en la organización.");
    }
    throw error;
  }

  private isUnique(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
