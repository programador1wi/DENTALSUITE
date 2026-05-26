import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsentStatus, Prisma } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
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
  UpdateClinicalDocumentTemplateSettingsDto,
  UpdateConsentTemplateDto,
  UploadFileAttachmentDto
} from "./dto/documents.dto";

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
        ...(query.category ? { category: query.category } : {})
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });
  }

  async uploadPatientFile(actor: AuthUser, patientId: string, dto: UploadFileAttachmentDto) {
    await this.ensurePatient(actor, patientId);
    const created = await this.prisma.fileAttachment.create({
      data: {
        organizationId: actor.organizationId,
        patientId,
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
        fileName: created.fileName,
        category: created.category
      }
    });

    return created;
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
    return this.prisma.clinicalDocumentTemplate.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.active !== undefined ? { isActive: query.active === "true" } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { description: { contains: query.search, mode: "insensitive" } },
                { content: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      skip,
      take,
      orderBy: { name: "asc" }
    });
  }

  async createClinicalDocumentTemplate(actor: AuthUser, dto: CreateClinicalDocumentTemplateSettingsDto) {
    const created = await this.prisma.clinicalDocumentTemplate.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        content: dto.content.trim()
      }
    });

    await this.audit(actor, {
      entity: "ClinicalDocumentTemplate",
      entityId: created.id,
      action: "create",
      after: { name: created.name, description: created.description }
    });
    return created;
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
        content: dto.content?.trim(),
        isActive: dto.isActive
      }
    });

    await this.audit(actor, {
      entity: "ClinicalDocumentTemplate",
      entityId: id,
      action: "update",
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
    return updated;
  }

  async deactivateClinicalDocumentTemplate(actor: AuthUser, id: string) {
    return this.updateClinicalDocumentTemplate(actor, id, { isActive: false });
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
        patient: { organizationId: actor.organizationId }
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
        patient: { organizationId: actor.organizationId }
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
      where: { id: patientId, organizationId: actor.organizationId, deletedAt: null }
    });
    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
  }

  private async ensureProcedure(actor: AuthUser, procedureId: string) {
    const procedure = await this.prisma.procedure.findFirst({
      where: { id: procedureId, organizationId: actor.organizationId }
    });
    if (!procedure) throw new NotFoundException("Procedure not found");
    return procedure;
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
}
