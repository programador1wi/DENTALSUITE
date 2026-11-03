import { BadRequestException, HttpException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { Prisma, RadiographyAnalysisProvider, RadiographyAnalysisStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { resolvePagination } from "../../common/utils/pagination.util";
import { coerceClinicalDocumentContent, normalizeClinicalDocumentContent } from "../../common/utils/clinical-document-content.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  ClinicalDocumentTemplatesQueryDto,
  CreateClinicalDocumentTemplateSettingsDto,
  PatientFilesQueryDto,
  UpsertRadiographyAnalysisDto,
  UploadBinaryFileAttachmentDto,
  UpdateClinicalDocumentTemplateSettingsDto,
  UploadFileAttachmentDto
} from "./dto/documents.dto";
import { validateUploadedFile } from "./file-type-validation";
import { ClinicalFileStorageService } from "../storage/clinical-file-storage.service";

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

const DEFAULT_LEGACY_STORAGE_ROOT = resolve(__dirname, "../../../storage");

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly clinicalStorage?: ClinicalFileStorageService
  ) {}

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
    const validatedFile = await this.validateFileOrReject(actor, "Patient", patientId, file);
    const { buffer, extension, mimeType, originalName, size } = validatedFile;

    const id = randomUUID();
    const storedFileName = `${Date.now()}-${id}${extension || ".bin"}`;
    const storage = this.requireClinicalStorage();
    const stored = await this.storeClinicalFileOrReject(actor, "Patient", patientId, {
      key: `${actor.organizationId}/patients/${patientId}/${id}.enc`,
      buffer,
      mimeType
    });

    const category = dto.category?.trim() || this.inferCategory(mimeType, extension);
    const created = await this.prisma.fileAttachment.create({
      data: {
        id,
        organizationId: actor.organizationId,
        patientId,
        treatmentPlanId: dto.treatmentPlanId,
        uploadedById: actor.id,
        fileName: storedFileName,
        originalName,
        mimeType,
        size,
        url: `/patients/${patientId}/files/${id}/content`,
        category,
        ...stored,
        detectedMimeType: mimeType
      }
    }).catch(async (error) => {
      await storage.discard(stored.storageKey).catch(() => undefined);
      throw error;
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

  async getPatientFileContent(actor: AuthUser, patientId: string, fileId: string): Promise<{ stream: Readable; mimeType: string; downloadName: string }> {
    const file = await this.prisma.fileAttachment.findFirst({
      where: {
        id: fileId,
        organizationId: actor.organizationId,
        patientId,
        patient: { branchId: branchScope(actor) }
      }
    });
    if (!file) throw new NotFoundException("File not found");

    if (file.storageKey) {
      if (!file.checksumSha256 || !file.encryptionVersion) {
        throw new Error("Clinical file storage metadata is incomplete");
      }
      const buffer = await this.requireClinicalStorage().read({
        storageKey: file.storageKey,
        checksumSha256: file.checksumSha256,
        encryptionVersion: file.encryptionVersion
      });
      return {
        stream: Readable.from([buffer]),
        mimeType: file.detectedMimeType ?? file.mimeType,
        downloadName: this.safeDownloadName(file.originalName)
      };
    }

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
    const validatedFile = await this.validateFileOrReject(actor, "User", userId, file);
    const { buffer, extension, mimeType, originalName, size } = validatedFile;

    const id = randomUUID();
    const storedFileName = `${Date.now()}-${id}${extension || ".bin"}`;
    const storage = this.requireClinicalStorage();
    const stored = await this.storeClinicalFileOrReject(actor, "User", userId, {
      key: `${actor.organizationId}/users/${userId}/${id}.enc`,
      buffer,
      mimeType
    });

    const category = dto.category?.trim() || this.inferCategory(mimeType, extension);
    const created = await this.prisma.fileAttachment.create({
      data: {
        id,
        organizationId: actor.organizationId,
        userId,
        professionalId,
        uploadedById: actor.id,
        fileName: storedFileName,
        originalName,
        mimeType,
        size,
        url: `/users/${userId}/files/${id}/content`,
        category,
        ...stored,
        detectedMimeType: mimeType
      }
    }).catch(async (error) => {
      await storage.discard(stored.storageKey).catch(() => undefined);
      throw error;
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

  async getUserFileContent(actor: AuthUser, userId: string, fileId: string): Promise<{ stream: Readable; mimeType: string; downloadName: string }> {
    await this.ensureUser(actor, userId);
    const file = await this.prisma.fileAttachment.findFirst({
      where: {
        id: fileId,
        organizationId: actor.organizationId,
        userId
      }
    });
    if (!file) throw new NotFoundException("File not found");

    if (file.storageKey) {
      if (!file.checksumSha256 || !file.encryptionVersion) {
        throw new Error("Clinical file storage metadata is incomplete");
      }
      const buffer = await this.requireClinicalStorage().read({
        storageKey: file.storageKey,
        checksumSha256: file.checksumSha256,
        encryptionVersion: file.encryptionVersion
      });
      return {
        stream: Readable.from([buffer]),
        mimeType: file.detectedMimeType ?? file.mimeType,
        downloadName: this.safeDownloadName(file.originalName)
      };
    }

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
    const validatedFile = await this.validateFileOrReject(
      actor,
      "ClinicalDocumentTemplateAsset",
      actor.organizationId,
      file
    );
    const { buffer, extension, mimeType, originalName, size } = validatedFile;

    const id = randomUUID();
    const storedFileName = `${id}${extension}`;
    await this.storeClinicalFileOrReject(actor, "ClinicalDocumentTemplateAsset", actor.organizationId, {
      key: `${actor.organizationId}/clinical-document-assets/${storedFileName}.enc`,
      buffer,
      mimeType
    });

    const uploaded = {
      fileName: storedFileName,
      originalName,
      mimeType,
      size,
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

  async getClinicalDocumentTemplateAsset(actor: AuthUser, fileName: string): Promise<{ stream: Readable; mimeType: string; downloadName: string }> {
    const safeFileName = this.safeStoredFileName(fileName);
    if (this.clinicalStorage) {
      const storageKey = `${actor.organizationId}/clinical-document-assets/${safeFileName}.enc`;
      if (await this.clinicalStorage.exists(storageKey)) {
        const buffer = await this.clinicalStorage.read({
          storageKey,
          encryptionVersion: 1
        });
        return {
          stream: Readable.from([buffer]),
          mimeType: this.mimeTypeFromExtension(extname(safeFileName).toLowerCase()),
          downloadName: this.safeDownloadName(safeFileName)
        };
      }
    }
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
      }
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
    return resolve(this.legacyStorageRoot(), "patient-files", organizationId, patientId);
  }

  private getUserFileDirectory(organizationId: string, userId: string) {
    return resolve(this.legacyStorageRoot(), "user-files", organizationId, userId);
  }

  private getClinicalDocumentTemplateAssetDirectory(organizationId: string) {
    return resolve(this.legacyStorageRoot(), "clinical-document-assets", organizationId);
  }

  private legacyStorageRoot() {
    return resolve(process.env.LEGACY_STORAGE_ROOT?.trim() || DEFAULT_LEGACY_STORAGE_ROOT);
  }

  private isPathInside(parentPath: string, childPath: string) {
    const segment = relative(parentPath, childPath);
    return Boolean(segment) && !segment.startsWith("..") && !isAbsolute(segment);
  }

  private async validateFileOrReject(
    actor: AuthUser,
    targetEntity: string,
    targetId: string,
    file?: UploadedPatientFile
  ) {
    const validation = validateUploadedFile(file);
    if (validation.ok) return validation;

    await this.audit(actor, {
      entity: targetEntity,
      entityId: targetId,
      action: "upload_rejected",
      after: {
        reasonCode: validation.code,
        extension: validation.extension,
        declaredMimeType: validation.mimeType,
        size: file?.size ?? null
      }
    });
    throw new BadRequestException({
      code: "UNSUPPORTED_FILE_CONTENT",
      message: "La extensión, el tipo MIME y el contenido del archivo deben coincidir."
    });
  }

  private requireClinicalStorage() {
    if (!this.clinicalStorage) throw new Error("Clinical file storage is not configured");
    return this.clinicalStorage;
  }

  private async storeClinicalFileOrReject(
    actor: AuthUser,
    targetEntity: string,
    targetId: string,
    input: { key: string; buffer: Buffer; mimeType: string }
  ) {
    try {
      return await this.requireClinicalStorage().store(input);
    } catch (error) {
      const response = error instanceof HttpException
        ? error.getResponse()
        : error instanceof Error
          ? { code: "CLINICAL_STORAGE_UNAVAILABLE", message: error.message }
          : { code: "CLINICAL_STORAGE_UNAVAILABLE" };
      const reasonCode = typeof response === "object" && response && "code" in response
        ? String(response.code)
        : "CLINICAL_STORAGE_UNAVAILABLE";
      await this.audit(actor, {
        entity: targetEntity,
        entityId: targetId,
        action: "upload_rejected",
        after: { reasonCode }
      });
      throw error;
    }
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
    const patient = await this.ensurePatient(actor, patientId);

    return this.prisma.$transaction(async (tx) => {
      const file = await tx.fileAttachment.findFirst({
        where: {
          id: fileId,
          patientId: patient.id,
          organizationId: actor.organizationId,
          patient: { branchId: branchScope(actor) },
          deletedAt: null
        }
      });

      if (!file) {
        throw new NotFoundException("File not found or already deleted");
      }

      const updateResult = await tx.fileAttachment.updateMany({
        where: {
          id: fileId,
          patientId: patient.id,
          organizationId: actor.organizationId,
          patient: { branchId: branchScope(actor) },
          deletedAt: null
        },
        data: {
          deletedAt: new Date(),
          deletedById: actor.id,
          deleteReason: reason
        }
      });

      if (updateResult.count !== 1) {
        throw new NotFoundException("File not found or already deleted");
      }

      const updated = await tx.fileAttachment.findUniqueOrThrow({
        where: { id: fileId }
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          userId: actor.id,
          actorUserId: actor.id,
          entity: "FileAttachment",
          entityId: fileId,
          action: "DELETE",
          before: file as unknown as Prisma.InputJsonValue,
          after: updated as unknown as Prisma.InputJsonValue
        }
      });

      return updated;
    });
  }
}
