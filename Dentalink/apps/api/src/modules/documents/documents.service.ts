import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsentStatus, Prisma, RadiographyAnalysisProvider, RadiographyAnalysisStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createReadStream, type ReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { resolvePagination } from "../../common/utils/pagination.util";
import { coerceClinicalDocumentContent, normalizeClinicalDocumentContent } from "../../common/utils/clinical-document-content.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  ClinicalDocumentTemplatesQueryDto,
  ConsentTemplatesQueryDto,
  CreateClinicalDocumentTemplateSettingsDto,
  CreateConsentDto,
  CreateConsentTemplateDto,
  PatientConsentsQueryDto,
  PatientFilesQueryDto,
  SignConsentDto,
  UpsertRadiographyAnalysisDto,
  UploadBinaryFileAttachmentDto,
  UpdateClinicalDocumentTemplateSettingsDto,
  UpdateConsentTemplateDto,
  UploadFileAttachmentDto
} from "./dto/documents.dto";

type UploadedPatientFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
};

type NormalizedRadiographyFinding = {
  id: string;
  tooth: string;
  label: string;
  bbox: { x: number; y: number; width: number; height: number };
  visible: boolean;
  source: "MANUAL";
};

const PATIENT_FILE_STORAGE_ROOT = resolve(process.cwd(), "storage", "patient-files");
const USER_FILE_STORAGE_ROOT = resolve(process.cwd(), "storage", "user-files");
const CLINICAL_DOCUMENT_TEMPLATE_ASSET_STORAGE_ROOT = resolve(process.cwd(), "storage", "clinical-document-assets");
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".dcm", ".dicom"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/dicom"
]);

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPatientFiles(actor: AuthUser, patientId: string, query: PatientFilesQueryDto) {
    const { skip, take } = resolvePagination(query);
    await this.ensurePatient(actor, patientId);
    return this.prisma.fileAttachment.findMany({
      where: {
        organizationId: actor.organizationId,
        patientId,
        ...(query.category ? { category: query.category } : {}),
        ...(query.treatmentPlanId ? { treatmentPlanId: query.treatmentPlanId } : {})
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });
  }

  async uploadPatientFile(actor: AuthUser, patientId: string, dto: UploadFileAttachmentDto) {
    await this.ensurePatient(actor, patientId);
    if (dto.treatmentPlanId) await this.ensurePatientTreatmentPlan(actor, patientId, dto.treatmentPlanId);
    const created = await this.prisma.fileAttachment.create({
      data: {
        organizationId: actor.organizationId,
        patientId,
        treatmentPlanId: dto.treatmentPlanId,
        uploadedById: actor.id,
        fileName: dto.fileName.trim(),
        originalName: dto.originalName.trim(),
        mimeType: dto.mimeType.trim(),
        size: dto.size,
        url: dto.url.trim(),
        category: dto.category.trim()
      }
    });

    await this.audit(actor, {
      entity: "FileAttachment",
      entityId: created.id,
      action: "upload",
      after: {
        patientId,
        treatmentPlanId: created.treatmentPlanId,
        fileName: created.fileName,
        category: created.category
      }
    });

    return created;
  }

  async uploadPatientBinaryFile(actor: AuthUser, patientId: string, dto: UploadBinaryFileAttachmentDto, file?: UploadedPatientFile) {
    await this.ensurePatient(actor, patientId);
    if (dto.treatmentPlanId) await this.ensurePatientTreatmentPlan(actor, patientId, dto.treatmentPlanId);
    if (!file?.buffer || !file.originalname?.trim()) throw new BadRequestException("File is required");
    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) throw new BadRequestException("File size is not allowed");

    const extension = extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype?.trim() || "application/octet-stream";
    if (!this.isAllowedFile(extension, mimeType)) {
      throw new BadRequestException("Unsupported file type");
    }

    const id = randomUUID();
    const storedFileName = `${Date.now()}-${id}${extension || ".bin"}`;
    const targetDirectory = this.getPatientFileDirectory(actor.organizationId, patientId);
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(join(targetDirectory, storedFileName), file.buffer);

    const category = dto.category?.trim() || this.inferCategory(mimeType, extension);
    const created = await this.prisma.fileAttachment.create({
      data: {
        id,
        organizationId: actor.organizationId,
        patientId,
        treatmentPlanId: dto.treatmentPlanId,
        uploadedById: actor.id,
        fileName: storedFileName,
        originalName: file.originalname.trim(),
        mimeType,
        size: file.size,
        url: `/patients/${patientId}/files/${id}/content`,
        category
      }
    });

    await this.audit(actor, {
      entity: "FileAttachment",
      entityId: created.id,
      action: "upload",
      after: {
        patientId,
        treatmentPlanId: created.treatmentPlanId,
        fileName: created.fileName,
        originalName: created.originalName,
        category: created.category
      }
    });

    return created;
  }

  async getPatientFileContent(actor: AuthUser, patientId: string, fileId: string): Promise<{ stream: ReadStream; mimeType: string; downloadName: string }> {
    const file = await this.prisma.fileAttachment.findFirst({
      where: {
        id: fileId,
        organizationId: actor.organizationId,
        patientId,
        patient: { branchId: branchScope(actor) }
      }
    });
    if (!file) throw new NotFoundException("File not found");

    const directory = this.getPatientFileDirectory(actor.organizationId, patientId);
    const filePath = resolve(directory, file.fileName);
    if (!this.isPathInside(directory, filePath)) throw new BadRequestException("Invalid file path");

    await stat(filePath).catch(() => {
      throw new NotFoundException("Stored file not found");
    });

    return {
      stream: createReadStream(filePath),
      mimeType: file.mimeType,
      downloadName: this.safeDownloadName(file.originalName)
    };
  }

  async getPatientRadiographyAnalysis(actor: AuthUser, patientId: string, fileId: string) {
    const file = await this.ensureRadiographyImageFile(actor, patientId, fileId);
    const analysis = await this.prisma.radiographyAnalysis.findUnique({
      where: { fileAttachmentId: file.id }
    });

    return analysis ? this.serializeRadiographyAnalysis(analysis) : null;
  }

  async upsertPatientRadiographyAnalysis(actor: AuthUser, patientId: string, fileId: string, dto: UpsertRadiographyAnalysisDto) {
    const file = await this.ensureRadiographyImageFile(actor, patientId, fileId);
    const findings = this.normalizeRadiographyFindings(dto.findings);
    const status = dto.status ?? RadiographyAnalysisStatus.DRAFT;

    const saved = await this.prisma.radiographyAnalysis.upsert({
      where: { fileAttachmentId: file.id },
      create: {
        organizationId: actor.organizationId,
        patientId,
        fileAttachmentId: file.id,
        provider: RadiographyAnalysisProvider.MANUAL,
        status,
        findings,
        createdById: actor.id,
        updatedById: actor.id
      },
      update: {
        provider: RadiographyAnalysisProvider.MANUAL,
        status,
        findings,
        updatedById: actor.id
      }
    });

    await this.audit(actor, {
      entity: "RadiographyAnalysis",
      entityId: saved.id,
      action: "upsert",
      after: {
        patientId,
        fileAttachmentId: file.id,
        findingsCount: findings.length,
        status
      }
    });

    return this.serializeRadiographyAnalysis(saved);
  }

  async listUserFiles(actor: AuthUser, userId: string, query: PatientFilesQueryDto) {
    const { skip, take } = resolvePagination(query);
    await this.ensureUser(actor, userId);
    return this.prisma.fileAttachment.findMany({
      where: {
        organizationId: actor.organizationId,
        userId,
        ...(query.category ? { category: query.category } : {})
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });
  }

  async uploadUserBinaryFile(actor: AuthUser, userId: string, dto: UploadBinaryFileAttachmentDto, file?: UploadedPatientFile) {
    await this.ensureUser(actor, userId);
    const professionalId = dto.professionalId ? await this.ensureUserProfessional(actor, userId, dto.professionalId) : undefined;
    if (!file?.buffer || !file.originalname?.trim()) throw new BadRequestException("File is required");
    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) throw new BadRequestException("File size is not allowed");

    const extension = extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype?.trim() || "application/octet-stream";
    if (!this.isAllowedFile(extension, mimeType)) {
      throw new BadRequestException("Unsupported file type");
    }

    const id = randomUUID();
    const storedFileName = `${Date.now()}-${id}${extension || ".bin"}`;
    const targetDirectory = this.getUserFileDirectory(actor.organizationId, userId);
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(join(targetDirectory, storedFileName), file.buffer);

    const category = dto.category?.trim() || this.inferCategory(mimeType, extension);
    const created = await this.prisma.fileAttachment.create({
      data: {
        id,
        organizationId: actor.organizationId,
        userId,
        professionalId,
        uploadedById: actor.id,
        fileName: storedFileName,
        originalName: file.originalname.trim(),
        mimeType,
        size: file.size,
        url: `/users/${userId}/files/${id}/content`,
        category
      }
    });

    await this.audit(actor, {
      entity: "FileAttachment",
      entityId: created.id,
      action: "upload_user_file",
      after: {
        userId,
        professionalId,
        fileName: created.fileName,
        originalName: created.originalName,
        category: created.category
      }
    });

    return created;
  }

  async getUserFileContent(actor: AuthUser, userId: string, fileId: string): Promise<{ stream: ReadStream; mimeType: string; downloadName: string }> {
    await this.ensureUser(actor, userId);
    const file = await this.prisma.fileAttachment.findFirst({
      where: {
        id: fileId,
        organizationId: actor.organizationId,
        userId
      }
    });
    if (!file) throw new NotFoundException("File not found");

    const directory = this.getUserFileDirectory(actor.organizationId, userId);
    const filePath = resolve(directory, file.fileName);
    if (!this.isPathInside(directory, filePath)) throw new BadRequestException("Invalid file path");

    await stat(filePath).catch(() => {
      throw new NotFoundException("Stored file not found");
    });

    return {
      stream: createReadStream(filePath),
      mimeType: file.mimeType,
      downloadName: this.safeDownloadName(file.originalName)
    };
  }

  async listConsentTemplates(actor: AuthUser, query: ConsentTemplatesQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.consentTemplate.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.active !== undefined ? { isActive: query.active === "true" } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { content: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: { procedure: { select: { id: true, code: true, name: true } } },
      skip,
      take,
      orderBy: { name: "asc" }
    });
  }

  async createConsentTemplate(actor: AuthUser, dto: CreateConsentTemplateDto) {
    if (dto.procedureId) await this.ensureProcedure(actor, dto.procedureId);
    const created = await this.prisma.consentTemplate.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        content: dto.content.trim(),
        procedureId: dto.procedureId
      }
    });

    await this.audit(actor, {
      entity: "ConsentTemplate",
      entityId: created.id,
      action: "create",
      after: {
        name: created.name,
        procedureId: created.procedureId
      }
    });

    return created;
  }

  async updateConsentTemplate(actor: AuthUser, id: string, dto: UpdateConsentTemplateDto) {
    const current = await this.prisma.consentTemplate.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!current) throw new NotFoundException("Consent template not found");

    if (dto.procedureId) await this.ensureProcedure(actor, dto.procedureId);

    const updated = await this.prisma.consentTemplate.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        content: dto.content?.trim(),
        procedureId: dto.procedureId,
        isActive: dto.isActive
      }
    });

    await this.audit(actor, {
      entity: "ConsentTemplate",
      entityId: id,
      action: "update",
      before: {
        name: current.name,
        procedureId: current.procedureId,
        isActive: current.isActive
      },
      after: {
        name: updated.name,
        procedureId: updated.procedureId,
        isActive: updated.isActive
      }
    });
    return updated;
  }

  async deactivateConsentTemplate(actor: AuthUser, id: string) {
    return this.updateConsentTemplate(actor, id, { isActive: false });
  }

  async listClinicalDocumentTemplates(actor: AuthUser, query: ClinicalDocumentTemplatesQueryDto) {
    const { skip, take } = resolvePagination(query);
    const templates = await this.prisma.clinicalDocumentTemplate.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.active !== undefined ? { isActive: query.active === "true" } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { description: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      skip,
      take,
      orderBy: { name: "asc" }
    });
    return templates.map((template) => this.serializeClinicalDocumentTemplate(template));
  }

  async createClinicalDocumentTemplate(actor: AuthUser, dto: CreateClinicalDocumentTemplateSettingsDto) {
    const created = await this.prisma.clinicalDocumentTemplate.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        content: normalizeClinicalDocumentContent(dto.content)
      }
    });

    await this.audit(actor, {
      entity: "ClinicalDocumentTemplate",
      entityId: created.id,
      action: "create",
      after: { name: created.name, description: created.description }
    });
    return this.serializeClinicalDocumentTemplate(created);
  }

  async updateClinicalDocumentTemplate(actor: AuthUser, id: string, dto: UpdateClinicalDocumentTemplateSettingsDto) {
    const current = await this.prisma.clinicalDocumentTemplate.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!current) throw new NotFoundException("Clinical document template not found");

    const updated = await this.prisma.clinicalDocumentTemplate.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        content: dto.content === undefined ? undefined : normalizeClinicalDocumentContent(dto.content),
        isActive: dto.isActive
      }
    });

    await this.audit(actor, {
      entity: "ClinicalDocumentTemplate",
      entityId: id,
      action: dto.isActive === false ? "deactivate" : "update",
      before: {
        name: current.name,
        description: current.description,
        isActive: current.isActive
      },
      after: {
        name: updated.name,
        description: updated.description,
        isActive: updated.isActive
      }
    });
    return this.serializeClinicalDocumentTemplate(updated);
  }

  async duplicateClinicalDocumentTemplate(actor: AuthUser, id: string) {
    const current = await this.prisma.clinicalDocumentTemplate.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!current) throw new NotFoundException("Clinical document template not found");

    const name = await this.nextClinicalDocumentTemplateCopyName(actor.organizationId, current.name);
    const created = await this.prisma.clinicalDocumentTemplate.create({
      data: {
        organizationId: actor.organizationId,
        name,
        description: current.description,
        content: coerceClinicalDocumentContent(current.content),
        isActive: true
      }
    });

    await this.audit(actor, {
      entity: "ClinicalDocumentTemplate",
      entityId: created.id,
      action: "duplicate",
      before: { sourceId: current.id, sourceName: current.name },
      after: { name: created.name, isActive: created.isActive }
    });
    return this.serializeClinicalDocumentTemplate(created);
  }

  async deactivateClinicalDocumentTemplate(actor: AuthUser, id: string) {
    return this.updateClinicalDocumentTemplate(actor, id, { isActive: false });
  }

  async uploadClinicalDocumentTemplateAsset(actor: AuthUser, file?: UploadedPatientFile) {
    if (!file?.buffer || !file.originalname?.trim()) throw new BadRequestException("File is required");
    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) throw new BadRequestException("File size is not allowed");

    const extension = extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype?.trim() || "application/octet-stream";
    if (!this.isAllowedFile(extension, mimeType)) throw new BadRequestException("Unsupported file type");

    const id = randomUUID();
    const storedFileName = `${id}${extension}`;
    const directory = this.getClinicalDocumentTemplateAssetDirectory(actor.organizationId);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, storedFileName), file.buffer);

    const uploaded = {
      fileName: storedFileName,
      originalName: file.originalname.trim(),
      mimeType,
      size: file.size,
      url: `/settings/clinical-document-templates/assets/${storedFileName}`
    };

    await this.audit(actor, {
      entity: "ClinicalDocumentTemplateAsset",
      entityId: id,
      action: "upload",
      after: uploaded
    });
    return uploaded;
  }

  async getClinicalDocumentTemplateAsset(actor: AuthUser, fileName: string): Promise<{ stream: ReadStream; mimeType: string; downloadName: string }> {
    const safeFileName = this.safeStoredFileName(fileName);
    const directory = this.getClinicalDocumentTemplateAssetDirectory(actor.organizationId);
    const filePath = resolve(directory, safeFileName);
    if (!this.isPathInside(directory, filePath)) throw new BadRequestException("Invalid file path");

    await stat(filePath).catch(() => {
      throw new NotFoundException("Stored file not found");
    });

    return {
      stream: createReadStream(filePath),
      mimeType: this.mimeTypeFromExtension(extname(safeFileName).toLowerCase()),
      downloadName: this.safeDownloadName(safeFileName)
    };
  }

  async listPatientConsents(actor: AuthUser, patientId: string, query: PatientConsentsQueryDto) {
    const { skip, take } = resolvePagination(query);
    await this.ensurePatient(actor, patientId);
    return this.prisma.consent.findMany({
      where: {
        patientId,
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        template: { select: { id: true, name: true, procedureId: true } },
        treatmentPlan: { select: { id: true, name: true, status: true } },
        appointment: { select: { id: true, startAt: true, status: true } },
        signatures: { orderBy: { signedAt: "asc" } }
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });
  }

  async createPatientConsent(actor: AuthUser, patientId: string, dto: CreateConsentDto) {
    await this.ensurePatient(actor, patientId);
    const template = await this.prisma.consentTemplate.findFirst({
      where: { id: dto.templateId, organizationId: actor.organizationId, isActive: true }
    });
    if (!template) throw new NotFoundException("Consent template not found");

    if (dto.treatmentPlanId) {
      const treatmentPlan = await this.prisma.treatmentPlan.findFirst({
        where: { id: dto.treatmentPlanId, organizationId: actor.organizationId, patientId }
      });
      if (!treatmentPlan) throw new BadRequestException("Invalid treatment plan for patient");
    }

    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findFirst({
        where: { id: dto.appointmentId, organizationId: actor.organizationId, patientId }
      });
      if (!appointment) throw new BadRequestException("Invalid appointment for patient");
    }

    const created = await this.prisma.consent.create({
      data: {
        patientId,
        templateId: dto.templateId,
        treatmentPlanId: dto.treatmentPlanId,
        appointmentId: dto.appointmentId,
        contentSnapshot: template.content,
        status: ConsentStatus.DRAFT
      }
    });

    await this.audit(actor, {
      entity: "Consent",
      entityId: created.id,
      action: "create",
      after: {
        patientId,
        templateId: created.templateId,
        treatmentPlanId: created.treatmentPlanId,
        appointmentId: created.appointmentId
      }
    });

    return this.getConsent(actor, created.id);
  }

  async signConsent(actor: AuthUser, consentId: string, dto: SignConsentDto) {
    const consent = await this.prisma.consent.findFirst({
      where: {
        id: consentId,
        patient: { organizationId: actor.organizationId, branchId: branchScope(actor) }
      },
      include: { signatures: true }
    });
    if (!consent) throw new NotFoundException("Consent not found");
    if (consent.status === ConsentStatus.SIGNED) {
      throw new BadRequestException("Signed consents cannot be modified");
    }

    const signed = await this.prisma.$transaction(async (tx) => {
      await tx.documentSignature.create({
        data: {
          consentId: consent.id,
          signerName: dto.signerName.trim(),
          signerType: dto.signerType.trim(),
          signatureData: dto.signatureData.trim(),
          ipAddress: dto.ipAddress?.trim() ?? null,
          signedAt: new Date()
        }
      });

      return tx.consent.update({
        where: { id: consent.id },
        data: {
          status: ConsentStatus.SIGNED,
          signedAt: new Date()
        }
      });
    });

    await this.audit(actor, {
      entity: "Consent",
      entityId: signed.id,
      action: "sign",
      after: {
        signerName: dto.signerName,
        signerType: dto.signerType
      }
    });

    return this.getConsent(actor, signed.id);
  }

  async getConsentPdf(actor: AuthUser, consentId: string) {
    const consent = await this.getConsent(actor, consentId);
    const pdfText = [
      `Consentimiento: ${consent.template.name}`,
      `Paciente: ${consent.patient.firstName} ${consent.patient.lastName}`,
      `Estado: ${consent.status}`,
      `Fecha firma: ${consent.signedAt ? consent.signedAt.toISOString() : "NO FIRMADO"}`,
      "",
      "Contenido:",
      consent.contentSnapshot
    ].join("\n");

    return {
      fileName: `consent-${consent.id}.pdf`,
      mimeType: "application/pdf",
      status: consent.status,
      signedAt: consent.signedAt,
      contentSnapshot: consent.contentSnapshot,
      signatures: consent.signatures,
      printableContent: pdfText
    };
  }

  private async getConsent(actor: AuthUser, consentId: string) {
    const consent = await this.prisma.consent.findFirst({
      where: {
        id: consentId,
        patient: { organizationId: actor.organizationId, branchId: branchScope(actor) }
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        template: { select: { id: true, name: true, procedureId: true } },
        treatmentPlan: { select: { id: true, name: true, status: true } },
        appointment: { select: { id: true, startAt: true, status: true } },
        signatures: { orderBy: { signedAt: "asc" } }
      }
    });
    if (!consent) throw new NotFoundException("Consent not found");
    return consent;
  }

  private async ensurePatient(actor: AuthUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: actor.organizationId, branchId: branchScope(actor), deletedAt: null }
    });
    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
  }

  private async ensurePatientTreatmentPlan(actor: AuthUser, patientId: string, treatmentPlanId: string) {
    const treatmentPlan = await this.prisma.treatmentPlan.findFirst({
      where: {
        id: treatmentPlanId,
        patientId,
        organizationId: actor.organizationId,
        branchId: branchScope(actor)
      },
      select: { id: true }
    });
    if (!treatmentPlan) throw new BadRequestException("Invalid treatment plan for patient");
    return treatmentPlan;
  }

  private async ensureUser(actor: AuthUser, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: actor.organizationId,
        deletedAt: null,
        branches: { some: { branchId: branchScope(actor) } }
      }
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  private async ensureUserProfessional(actor: AuthUser, userId: string, professionalId: string) {
    const professional = await this.prisma.professional.findFirst({
      where: {
        id: professionalId,
        userId,
        organizationId: actor.organizationId
      },
      select: { id: true }
    });
    if (!professional) throw new BadRequestException("Professional does not belong to this user");
    return professional.id;
  }

  private async ensureProcedure(actor: AuthUser, procedureId: string) {
    const procedure = await this.prisma.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId }
    });
    if (!procedure) throw new NotFoundException("Procedure not found");
    return procedure;
  }

  private async ensureRadiographyImageFile(actor: AuthUser, patientId: string, fileId: string) {
    await this.ensurePatient(actor, patientId);
    const file = await this.prisma.fileAttachment.findFirst({
      where: {
        id: fileId,
        organizationId: actor.organizationId,
        patientId,
        patient: { branchId: branchScope(actor) }
      }
    });
    if (!file) throw new NotFoundException("File not found");
    if (file.category !== "XRAY" || !file.mimeType.startsWith("image/")) {
      throw new BadRequestException("Radiography analysis is available only for XRAY image files");
    }
    return file;
  }

  private normalizeRadiographyFindings(findings: UpsertRadiographyAnalysisDto["findings"]) {
    return findings.map<NormalizedRadiographyFinding>((finding) => {
      const tooth = finding.tooth.trim();
      const label = finding.label.trim();
      if (!tooth || !label) throw new BadRequestException("Finding tooth and label are required");

      const x = this.clampCoordinate(finding.bbox.x);
      const y = this.clampCoordinate(finding.bbox.y);
      const width = this.clampSize(finding.bbox.width, x);
      const height = this.clampSize(finding.bbox.height, y);

      return {
        id: finding.id?.trim() || randomUUID(),
        tooth,
        label,
        bbox: { x, y, width, height },
        visible: finding.visible,
        source: "MANUAL"
      };
    });
  }

  private serializeRadiographyAnalysis(analysis: {
    id: string;
    organizationId: string;
    patientId: string;
    fileAttachmentId: string;
    provider: RadiographyAnalysisProvider;
    status: RadiographyAnalysisStatus;
    findings: Prisma.JsonValue;
    createdById: string | null;
    updatedById: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: analysis.id,
      organizationId: analysis.organizationId,
      patientId: analysis.patientId,
      fileAttachmentId: analysis.fileAttachmentId,
      provider: analysis.provider,
      status: analysis.status,
      findings: Array.isArray(analysis.findings) ? analysis.findings : [],
      createdById: analysis.createdById,
      updatedById: analysis.updatedById,
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt
    };
  }

  private clampCoordinate(value: number) {
    return Math.min(0.99, Math.max(0, value));
  }

  private clampSize(value: number, origin: number) {
    return Math.min(1 - origin, Math.max(0.01, value));
  }

  private serializeClinicalDocumentTemplate<T extends { content: Prisma.JsonValue }>(template: T) {
    return { ...template, content: coerceClinicalDocumentContent(template.content) };
  }

  private async nextClinicalDocumentTemplateCopyName(organizationId: string, sourceName: string) {
    const baseName = `Copia de ${sourceName.trim()}`.slice(0, 180);
    for (let index = 0; index < 50; index += 1) {
      const candidate = index === 0 ? baseName : `${baseName} ${index + 1}`;
      const existing = await this.prisma.clinicalDocumentTemplate.findFirst({
        where: { organizationId, name: candidate }
      });
      if (!existing) return candidate;
    }
    return `${baseName} ${Date.now()}`;
  }

  private getPatientFileDirectory(organizationId: string, patientId: string) {
    return resolve(PATIENT_FILE_STORAGE_ROOT, organizationId, patientId);
  }

  private getUserFileDirectory(organizationId: string, userId: string) {
    return resolve(USER_FILE_STORAGE_ROOT, organizationId, userId);
  }

  private getClinicalDocumentTemplateAssetDirectory(organizationId: string) {
    return resolve(CLINICAL_DOCUMENT_TEMPLATE_ASSET_STORAGE_ROOT, organizationId);
  }

  private isPathInside(parentPath: string, childPath: string) {
    const segment = relative(parentPath, childPath);
    return Boolean(segment) && !segment.startsWith("..") && !isAbsolute(segment);
  }

  private isAllowedFile(extension: string, mimeType: string) {
    return ALLOWED_MIME_TYPES.has(mimeType) || ALLOWED_EXTENSIONS.has(extension);
  }

  private inferCategory(mimeType: string, extension: string) {
    if (mimeType.startsWith("image/")) return "PHOTO";
    if (mimeType === "application/dicom" || extension === ".dcm" || extension === ".dicom") return "XRAY";
    if (mimeType === "application/pdf" || extension === ".pdf") return "DOCUMENT";
    return "OTHER";
  }

  private safeStoredFileName(fileName: string) {
    const trimmed = fileName.trim();
    if (!trimmed || trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
      throw new BadRequestException("Invalid file path");
    }
    return trimmed;
  }

  private mimeTypeFromExtension(extension: string) {
    if ([".jpg", ".jpeg"].includes(extension)) return "image/jpeg";
    if (extension === ".png") return "image/png";
    if (extension === ".webp") return "image/webp";
    if (extension === ".pdf") return "application/pdf";
    return "application/octet-stream";
  }

  private safeDownloadName(fileName: string) {
    return fileName.replace(/["\r\n\\]/g, "_");
  }

  private async audit(
    actor: AuthUser,
    payload: {
      entity: string;
      entityId?: string;
      action: string;
      before?: Prisma.InputJsonValue;
      after?: Prisma.InputJsonValue;
    }
  ) {
    await this.prisma.auditLog.create({
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

  async deletePatientFile(actor: AuthUser, patientId: string, fileId: string, reason: string) {
    const file = await this.prisma.fileAttachment.findFirst({
      where: { id: fileId, patientId, organizationId: actor.organizationId, deletedAt: null }
    });

    if (!file) throw new NotFoundException("File not found or already deleted");

    const updated = await this.prisma.fileAttachment.update({
      where: { id: fileId },
      data: {
        deletedAt: new Date(),
        deletedById: actor.id,
        deleteReason: reason
      }
    });

    await this.audit(actor, {
      entity: "FileAttachment",
      entityId: fileId,
      action: "DELETE",
      before: file,
      after: updated
    });

    return updated;
  }
}
