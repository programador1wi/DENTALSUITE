import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { extname } from "node:path";
import {
  AgreementStatus,
  CommunicationChannel,
  CommunicationJobStatus,
  InstallmentStatus,
  MessageDeliveryStatus,
  PaymentStatus,
  PatientBenefitCoverageStatus,
  PatientBenefitCoverageType,
  PatientTaskStatus,
  Prisma,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus,
  type PatientStatus
} from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { generateUniquePatientNumber } from "../../common/utils/patient-number.util";
import { sanitizeRichTextHtml } from "../../common/utils/sanitize-rich-text.util";
import { AuthUser } from "../../common/types/auth-user";
import { DomainActorContext, domainActorAuditFields } from "../../common/types/domain-actor-context";
import { PrismaService } from "../../database/prisma.service";
import { DocumentsService } from "../documents/documents.service";
import { EmailService } from "../notifications/email.service";
import { PatientIdentityService } from "../patient-identity/patient-identity.service";
import { AddPatientAlertDto } from "./dto/add-patient-alert.dto";
import { AddPatientNoteDto } from "./dto/add-patient-note.dto";
import { CreatePatientDto } from "./dto/create-patient.dto";
import {
  AttachPatientCoverageDocumentDto,
  CoverageNormalizedResultDto,
  CreatePatientBenefitCoverageDto,
  PatientBenefitCoverageStatusDto,
  PatientEligibleCoveragesQueryDto,
  UpdatePatientBenefitCoverageDto,
  ValidatePatientInsuranceDto
} from "./dto/patient-benefit-coverage.dto";
import { ListPatientEmailsQueryDto, SendPatientEmailDto } from "./dto/patient-email.dto";
import { PatientQueryDto } from "./dto/patient-query.dto";
import { CreatePatientTaskDto, ListPatientTasksQueryDto, UpdatePatientTaskDto } from "./dto/patient-task.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { MergePatientsDto } from "./dto/merge-patients.dto";

const EXACT_PATIENT_DUPLICATE_MESSAGE =
  "Ya existe un paciente con el mismo nombre, apellidos, teléfono y correo. Selecciona el paciente existente.";
const PATIENT_EMAIL_TEMPLATE_KEY = "PATIENT_EMAIL";
const PATIENT_EMAIL_MAX_ATTACHMENTS = 3;
const PATIENT_EMAIL_MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const PATIENT_EMAIL_ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx"
]);
const PATIENT_EMAIL_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);
const EMAIL_REGEX = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

type PotentialPatientDuplicate = Prisma.PatientGetPayload<{
  select: {
    id: true;
    firstName: true;
    lastName: true;
    phone: true;
    email: true;
    documentNumber: true;
    createdAt: true;
    status: true;
  };
}>;

export type PreparedPatientCreate = {
  normalizedPhone?: string;
  normalizedAlternatePhone?: string;
  phoneForStorage?: string;
  alternatePhoneForStorage?: string;
  potentialDuplicates: PotentialPatientDuplicate[];
};

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService?: EmailService,
    private readonly documentsService?: DocumentsService,
    private readonly patientIdentityService?: PatientIdentityService
  ) {}

  private buildPatientWhere(actor: AuthUser, idOrNumber: string): Prisma.PatientWhereInput {
    const trimmed = idOrNumber.trim();
    const isNumeric = /^\d+$/.test(trimmed);
    return {
      organizationId: actor.organizationId,
      branchId: { in: actor.branchIds },
      deletedAt: null,
      ...(isNumeric
        ? { OR: [{ id: trimmed }, { patientNumber: parseInt(trimmed, 10) }] }
        : { id: trimmed })
    };
  }

  async findAll(actor: AuthUser, query: PatientQueryDto) {
    const { skip, take } = resolvePagination(query);
    const where: Prisma.PatientWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(query.status ? { status: query.status as PatientStatus } : {}),
      branchId: branchScope(actor, query.branchId),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { documentNumber: { contains: query.search, mode: "insensitive" } },
              ...(/^\d+$/.test(query.search.trim()) ? [{ patientNumber: parseInt(query.search.trim(), 10) }] : [])
            ]
          }
        : {}),
      ...(query.hasDebt === "true" ? { status: "DEBTOR" } : {}),
      ...(query.isNew === "true"
        ? {
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        : {}),
      ...(query.withoutFutureAppointment === "true"
        ? {
            appointments: {
              none: {
                startAt: { gte: new Date() },
                status: { notIn: ["CANCELLED_BY_PATIENT", "CANCELLED_BY_CLINIC", "NO_SHOW", "RESCHEDULED"] }
              }
            }
          }
        : {})
    };

    const rows = await this.prisma.patient.findMany({
      where,
      skip,
      take,
      include: {
        branch: true,
        medicalAlerts: { where: { isActive: true } },
        appointments: {
          where: {
            startAt: { gte: new Date() },
            status: { notIn: ["CANCELLED_BY_PATIENT", "CANCELLED_BY_CLINIC", "NO_SHOW", "RESCHEDULED"] }
          },
          orderBy: { startAt: "asc" },
          take: 1
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return rows.map((row) => ({
      id: row.id,
      patientNumber: row.patientNumber,
      branchId: row.branchId,
      branchName: row.branch.name,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      status: row.status,
      createdAt: row.createdAt,
      hasDebt: row.status === "DEBTOR",
      hasFutureAppointment: row.appointments.length > 0,
      isNew: row.createdAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      hasCriticalAlert: row.medicalAlerts.some((alert) =>
        ["HIGH", "CRITICAL"].includes(alert.severity.toUpperCase())
      )
    }));
  }

  async search(actor: AuthUser, q?: string, phone?: string, email?: string, documentNumber?: string) {
    const isNumericQ = q && /^\d+$/.test(q.trim());
    const rows = await this.prisma.patient.findMany({
      where: {
        organizationId: actor.organizationId,
        deletedAt: null,
        branchId: { in: actor.branchIds },
        OR: [
          q
            ? {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                  { phone: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { documentNumber: { contains: q, mode: "insensitive" } },
                  ...(isNumericQ ? [{ patientNumber: parseInt(q.trim(), 10) }] : [])
                ]
              }
            : undefined,
          phone ? { phone } : undefined,
          email ? { email: email.toLowerCase().trim() } : undefined,
          documentNumber ? { documentNumber } : undefined
        ].filter(Boolean) as Prisma.PatientWhereInput[]
      },
      take: 20,
      orderBy: { createdAt: "desc" }
    });

    return rows;
  }

  async findOne(actor: AuthUser, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: this.buildPatientWhere(actor, id),
      include: {
        branch: true,
        agreement: {
          select: {
            id: true,
            name: true,
            discountPercent: true,
            payrollDiscount: true,
            isActive: true,
            priceList: { select: { id: true, name: true, isDefault: true } }
          }
        },
        contacts: true,
        address: true,
        medicalAlerts: { orderBy: { createdAt: "desc" } },
        notes: {
          include: this.patientNoteInclude(),
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!patient) throw new NotFoundException("Patient not found");

    const [timeline, nextAppointment, lastAppointment, financialSummary, activeTreatments, benefitsSummary] =
      await Promise.all([
        this.getTimelineInternal(actor, patient.id),
        this.prisma.appointment.findFirst({
          where: {
            patientId: patient.id,
            organizationId: actor.organizationId,
            startAt: { gte: new Date() },
            status: { notIn: ["CANCELLED_BY_PATIENT", "CANCELLED_BY_CLINIC", "NO_SHOW", "RESCHEDULED"] }
          },
          orderBy: { startAt: "asc" }
        }),
        this.prisma.appointment.findFirst({
          where: {
            patientId: patient.id,
            organizationId: actor.organizationId,
            startAt: { lt: new Date() }
          },
          orderBy: { startAt: "desc" }
        }),
        this.getPatientFinancialSummary(actor, patient.id),
        this.prisma.treatmentPlan.count({
          where: {
            patientId: patient.id,
            organizationId: actor.organizationId,
            branchId: { in: actor.branchIds },
            isAlternative: false,
            status: { in: [TreatmentPlanStatus.ACCEPTED, TreatmentPlanStatus.IN_PROGRESS] }
          }
        }),
        this.getPatientBenefitsSummary(actor, patient.id)
      ]);

    return {
      ...patient,
      summary: {
        nextAppointment: nextAppointment?.startAt ?? null,
        lastAppointment: lastAppointment?.startAt ?? null,
        balance:
          financialSummary.outstandingAmount > 0
            ? financialSummary.outstandingAmount
            : -financialSummary.unallocatedCredit,
        activeTreatments,
        activeBenefits: benefitsSummary.activeBenefits,
        coverageExpiringSoon: benefitsSummary.coverageExpiringSoon,
        hasCriticalAlert: patient.medicalAlerts.some((alert) =>
          ["HIGH", "CRITICAL"].includes(alert.severity.toUpperCase())
        )
      },
      timeline
    };
  }

  async listBenefitCoverages(actor: AuthUser, patientId: string) {
    await this.getPatientForBenefitCoverage(actor, patientId);
    const coverages = await this.prisma.patientBenefitCoverage.findMany({
      where: {
        organizationId: actor.organizationId,
        patientId,
        branchId: { in: actor.branchIds }
      },
      include: this.patientBenefitCoverageInclude(),
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });
    return this.buildBenefitCoverageResponse(coverages);
  }

  async createBenefitCoverage(
    actor: AuthUser,
    patientId: string,
    dto: CreatePatientBenefitCoverageDto,
    idempotencyKey?: string
  ) {
    const patient = await this.getPatientForBenefitCoverage(actor, patientId);
    const normalized = this.normalizeBenefitCoverageInput(dto);
    const branchId = normalized.branchId ?? patient.branchId;
    await this.validateBranch(actor, branchId);
    if (normalized.agreementId) await this.validateAgreement(actor, normalized.agreementId);
    this.validateBenefitCoverageDates(normalized.startsAt, normalized.endsAt);

    const existingIdempotent = await this.findIdempotentBenefitCoverage(actor, patientId, idempotencyKey);
    if (existingIdempotent) return this.serializeBenefitCoverage(existingIdempotent);

    await this.assertNoDuplicateBenefitCoverage(
      actor,
      patientId,
      normalized.providerName,
      normalized.policyNumber,
      normalized.affiliateNumber
    );
    const status = (normalized.status ?? PatientBenefitCoverageStatus.DRAFT) as PatientBenefitCoverageStatus;

    const coverage = await this.prisma.$transaction(async (tx) => {
      const created = await tx.patientBenefitCoverage.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          patientId,
          type: normalized.type as PatientBenefitCoverageType,
          status,
          providerName: normalized.providerName,
          agreementId: normalized.agreementId,
          planName: normalized.planName,
          policyNumber: normalized.policyNumber,
          affiliateNumber: normalized.affiliateNumber,
          certificateNumber: normalized.certificateNumber,
          employeeNumber: normalized.employeeNumber,
          holderName: normalized.holderName,
          holderDocument: normalized.holderDocument,
          relationshipToPatient: normalized.relationshipToPatient,
          startsAt: this.dateOrNull(normalized.startsAt),
          endsAt: this.dateOrNull(normalized.endsAt),
          coveragePercent: this.numberOrUndefined(normalized.coveragePercent),
          copayAmount: this.numberOrUndefined(normalized.copayAmount),
          deductibleAmount: this.numberOrUndefined(normalized.deductibleAmount),
          annualLimitAmount: this.numberOrUndefined(normalized.annualLimitAmount),
          requiresAuthorization: normalized.requiresAuthorization ?? false,
          notes: normalized.notes,
          externalReference: normalized.externalReference,
          createdById: actor.id,
          updatedById: actor.id,
          metadata: idempotencyKey ? { idempotencyKey } : undefined
        },
        include: this.patientBenefitCoverageInclude()
      });

      await tx.patientBenefitCoverageAudit.create({
        data: {
          coverageId: created.id,
          organizationId: actor.organizationId,
          branchId,
          patientId,
          action: "create",
          after: this.auditJson(created),
          correlationId: idempotencyKey,
          actorUserId: actor.id
        }
      });

      if (created.agreementId && created.status === PatientBenefitCoverageStatus.ACTIVE) {
        await tx.patient.update({ where: { id: patientId }, data: { agreementId: created.agreementId } });
      }

      return created;
    });

    return this.serializeBenefitCoverage(coverage);
  }

  async updateBenefitCoverage(
    actor: AuthUser,
    patientId: string,
    coverageId: string,
    dto: UpdatePatientBenefitCoverageDto
  ) {
    await this.getPatientForBenefitCoverage(actor, patientId);
    const current = await this.getBenefitCoverageOrThrow(actor, patientId, coverageId);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== current.version) {
      throw new ConflictException(
        "La cobertura fue modificada por otro usuario. Recarga la ficha antes de guardar."
      );
    }

    const normalized = this.normalizeBenefitCoverageInput(dto);
    const branchId = normalized.branchId ?? current.branchId;
    await this.validateBranch(actor, branchId);
    if (normalized.agreementId) await this.validateAgreement(actor, normalized.agreementId);
    this.validateBenefitCoverageDates(normalized.startsAt, normalized.endsAt);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.patientBenefitCoverage.update({
        where: { id: coverageId },
        data: {
          branchId,
          type: normalized.type ? (normalized.type as PatientBenefitCoverageType) : undefined,
          status: normalized.status ? (normalized.status as PatientBenefitCoverageStatus) : undefined,
          providerName: normalized.providerName,
          agreementId: normalized.agreementId === undefined ? undefined : normalized.agreementId,
          planName: normalized.planName,
          policyNumber: normalized.policyNumber,
          affiliateNumber: normalized.affiliateNumber,
          certificateNumber: normalized.certificateNumber,
          employeeNumber: normalized.employeeNumber,
          holderName: normalized.holderName,
          holderDocument: normalized.holderDocument,
          relationshipToPatient: normalized.relationshipToPatient,
          startsAt: normalized.startsAt === undefined ? undefined : this.dateOrNull(normalized.startsAt),
          endsAt: normalized.endsAt === undefined ? undefined : this.dateOrNull(normalized.endsAt),
          coveragePercent: this.numberOrUndefined(normalized.coveragePercent),
          copayAmount: this.numberOrUndefined(normalized.copayAmount),
          deductibleAmount: this.numberOrUndefined(normalized.deductibleAmount),
          annualLimitAmount: this.numberOrUndefined(normalized.annualLimitAmount),
          requiresAuthorization: normalized.requiresAuthorization,
          notes: normalized.notes,
          externalReference: normalized.externalReference,
          updatedById: actor.id,
          version: { increment: 1 }
        },
        include: this.patientBenefitCoverageInclude()
      });

      await tx.patientBenefitCoverageAudit.create({
        data: {
          coverageId,
          organizationId: actor.organizationId,
          branchId: result.branchId,
          patientId,
          action: "update",
          before: this.auditJson(current),
          after: this.auditJson(result),
          actorUserId: actor.id
        }
      });

      if (result.agreementId && result.status === PatientBenefitCoverageStatus.ACTIVE) {
        await tx.patient.update({ where: { id: patientId }, data: { agreementId: result.agreementId } });
      }

      return result;
    });

    return this.serializeBenefitCoverage(updated);
  }

  async changeBenefitCoverageStatus(
    actor: AuthUser,
    patientId: string,
    coverageId: string,
    status: PatientBenefitCoverageStatusDto,
    reason?: string
  ) {
    await this.getPatientForBenefitCoverage(actor, patientId);
    const current = await this.getBenefitCoverageOrThrow(actor, patientId, coverageId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.patientBenefitCoverage.update({
        where: { id: coverageId },
        data: {
          status: status as PatientBenefitCoverageStatus,
          updatedById: actor.id,
          version: { increment: 1 }
        },
        include: this.patientBenefitCoverageInclude()
      });

      await tx.patientBenefitCoverageAudit.create({
        data: {
          coverageId,
          organizationId: actor.organizationId,
          branchId: result.branchId,
          patientId,
          action: status.toLowerCase(),
          before: this.auditJson(current),
          after: this.auditJson(result),
          reason: this.cleanString(reason),
          actorUserId: actor.id
        }
      });

      if (result.agreementId && result.status === PatientBenefitCoverageStatus.ACTIVE) {
        await tx.patient.update({ where: { id: patientId }, data: { agreementId: result.agreementId } });
      }

      return result;
    });
    return this.serializeBenefitCoverage(updated);
  }

  async validateInsurance(actor: AuthUser, patientId: string, dto: ValidatePatientInsuranceDto) {
    await this.getPatientForBenefitCoverage(actor, patientId);
    const current = await this.getBenefitCoverageOrThrow(actor, patientId, dto.coverageId);
    const normalizedResult: Partial<CoverageNormalizedResultDto> = dto.normalizedResult ?? {};
    const nextStatus = (dto.status ??
      (dto.errorMessage ? "INTEGRATION_ERROR" : "ACTIVE")) as PatientBenefitCoverageStatus;
    const validation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.patientBenefitCoverageValidation.create({
        data: {
          coverageId: current.id,
          organizationId: actor.organizationId,
          branchId: current.branchId,
          patientId,
          mode: dto.mode ?? "MANUAL",
          status: nextStatus,
          providerName: this.cleanString(dto.providerName) ?? current.providerName,
          externalIdentifier: this.cleanString(dto.externalIdentifier),
          requestSnapshot: this.inputJson(dto.requestSnapshot),
          responseSnapshot: this.inputJson(dto.responseSnapshot),
          normalizedResult: Object.keys(normalizedResult).length
            ? this.inputJson(normalizedResult)
            : undefined,
          errorMessage: this.cleanString(dto.errorMessage),
          validatedAt: new Date(),
          createdById: actor.id
        }
      });

      const updated = await tx.patientBenefitCoverage.update({
        where: { id: current.id },
        data: {
          status: nextStatus,
          coveragePercent: this.numberOrUndefined(normalizedResult.coveragePercent),
          copayAmount: this.numberOrUndefined(normalizedResult.copayAmount),
          deductibleAmount: this.numberOrUndefined(normalizedResult.deductibleAmount),
          annualLimitAmount: this.numberOrUndefined(normalizedResult.annualLimitAmount),
          requiresAuthorization: normalizedResult.requiresAuthorization,
          holderName: this.cleanString(normalizedResult.holderName) ?? undefined,
          endsAt: normalizedResult.validUntil ? this.dateOrNull(normalizedResult.validUntil) : undefined,
          lastValidatedAt: created.validatedAt,
          lastValidationStatus: nextStatus,
          lastValidationSummary:
            this.cleanString(dto.errorMessage) ??
            this.coverageValidationSummary(normalizedResult, nextStatus),
          updatedById: actor.id,
          version: { increment: 1 }
        },
        include: this.patientBenefitCoverageInclude()
      });

      await tx.patientBenefitCoverageAudit.create({
        data: {
          coverageId: current.id,
          organizationId: actor.organizationId,
          branchId: current.branchId,
          patientId,
          action: "validate",
          before: this.auditJson(current),
          after: this.auditJson(updated),
          reason: this.cleanString(dto.errorMessage),
          actorUserId: actor.id
        }
      });

      if (updated.agreementId && updated.status === PatientBenefitCoverageStatus.ACTIVE) {
        await tx.patient.update({ where: { id: patientId }, data: { agreementId: updated.agreementId } });
      }

      return created;
    });

    return validation;
  }

  async attachCoverageDocument(
    actor: AuthUser,
    patientId: string,
    coverageId: string,
    dto: AttachPatientCoverageDocumentDto
  ) {
    await this.getPatientForBenefitCoverage(actor, patientId);
    const coverage = await this.getBenefitCoverageOrThrow(actor, patientId, coverageId);
    const file = await this.prisma.fileAttachment.findFirst({
      where: {
        id: dto.fileAttachmentId,
        organizationId: actor.organizationId,
        patientId,
        deletedAt: null
      },
      select: { id: true }
    });
    if (!file) throw new BadRequestException("Invalid fileAttachmentId");

    const document = await this.prisma.$transaction(async (tx) => {
      const created = await tx.patientBenefitCoverageDocument.create({
        data: {
          coverageId,
          organizationId: actor.organizationId,
          branchId: coverage.branchId,
          patientId,
          fileAttachmentId: file.id,
          category: dto.category.trim(),
          notes: this.cleanString(dto.notes),
          uploadedById: actor.id
        },
        include: { fileAttachment: true }
      });
      await tx.patientBenefitCoverageAudit.create({
        data: {
          coverageId,
          organizationId: actor.organizationId,
          branchId: coverage.branchId,
          patientId,
          action: "document_added",
          after: this.auditJson(created),
          actorUserId: actor.id
        }
      });
      return created;
    });
    return document;
  }

  async listEligibleCoverages(actor: AuthUser, patientId: string, _query: PatientEligibleCoveragesQueryDto) {
    await this.getPatientForBenefitCoverage(actor, patientId);
    const now = new Date();
    const coverages = await this.prisma.patientBenefitCoverage.findMany({
      where: {
        organizationId: actor.organizationId,
        patientId,
        branchId: { in: actor.branchIds },
        status: PatientBenefitCoverageStatus.ACTIVE,
        OR: [{ endsAt: null }, { endsAt: { gte: now } }]
      },
      include: this.patientBenefitCoverageInclude(),
      orderBy: [{ endsAt: "asc" }, { updatedAt: "desc" }]
    });
    return this.buildBenefitCoverageResponse(coverages);
  }

  async listEmails(actor: AuthUser, patientId: string, query: ListPatientEmailsQueryDto) {
    await this.ensurePatientExists(actor, patientId);
    const { skip, take, page, pageSize } = resolvePagination(query);
    const where = this.patientEmailWhere(actor, patientId, query);

    const [items, total] = await Promise.all([
      this.prisma.communicationJob.findMany({
        where,
        include: this.patientEmailInclude(),
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.communicationJob.count({ where })
    ]);

    return {
      items: items.map((item) => this.serializePatientEmail(item, false)),
      total,
      page,
      pageSize
    };
  }

  async getEmail(actor: AuthUser, patientId: string, emailId: string) {
    await this.ensurePatientExists(actor, patientId);
    const email = await this.prisma.communicationJob.findFirst({
      where: {
        id: emailId,
        organizationId: actor.organizationId,
        patientId,
        channel: CommunicationChannel.EMAIL,
        templateKey: PATIENT_EMAIL_TEMPLATE_KEY,
        patient: { branchId: { in: actor.branchIds }, deletedAt: null }
      },
      include: this.patientEmailInclude()
    });
    if (!email) throw new NotFoundException("Email not found");
    return this.serializePatientEmail(email, true);
  }

  async sendEmail(actor: AuthUser, patientId: string, dto: SendPatientEmailDto, idempotencyKey?: string) {
    const patient = await this.getPatientForEmail(actor, patientId);
    const normalizedPatientEmail = this.normalizeRequiredEmail(
      patient.email,
      "El paciente no tiene un correo electrónico registrado.",
      "El correo del paciente no tiene un formato válido."
    );
    const subject = this.normalizeEmailSubject(dto.subject);
    const decodedHtml = this.decodeEmailHtml(dto.bodyHtmlBase64);
    const sanitizedContent = this.sanitizeEmailHtml(decodedHtml);
    const textBody = this.htmlToText(sanitizedContent);
    if (!textBody.trim()) throw new BadRequestException("Escribe el contenido del mensaje.");

    const normalizedIdempotencyKey = idempotencyKey?.trim();
    if (normalizedIdempotencyKey) {
      const existing = await this.findIdempotentPatientEmail(actor, patientId, normalizedIdempotencyKey);
      if (existing) return this.serializePatientEmail(existing, true);
    }

    const copyAddress = dto.copyToSender
      ? this.normalizeRequiredEmail(
          actor.email,
          "El usuario autenticado no tiene correo registrado.",
          "El correo del usuario autenticado no tiene un formato válido."
        )
      : undefined;
    const sender = this.getEmailSender();
    const attachments = await this.resolvePatientEmailAttachments(
      actor,
      patientId,
      dto.fileAttachmentIds ?? []
    );
    const replyTo = this.firstValidEmail(patient.branch.email, patient.organization.email);
    const toName = `${patient.firstName} ${patient.lastName}`.trim();
    const htmlBody = this.renderPatientEmailTemplate({
      organizationName: patient.organization.name,
      branchName: patient.branch.name,
      branchAddress: patient.branch.address ?? patient.organization.address ?? undefined,
      branchPhone: patient.branch.phone ?? patient.organization.phone ?? undefined,
      branchEmail: patient.branch.email ?? patient.organization.email ?? undefined,
      logoUrl: patient.organization.logoUrl ?? undefined,
      patientName: toName,
      contentHtml: sanitizedContent
    });
    const templateText = this.renderPatientEmailText({
      organizationName: patient.organization.name,
      branchName: patient.branch.name,
      branchAddress: patient.branch.address ?? patient.organization.address ?? undefined,
      branchPhone: patient.branch.phone ?? patient.organization.phone ?? undefined,
      branchEmail: patient.branch.email ?? patient.organization.email ?? undefined,
      patientName: toName,
      contentText: textBody
    });

    const queued = await this.prisma.$transaction(async (tx) => {
      const created = await tx.communicationJob.create({
        data: {
          organizationId: actor.organizationId,
          patientId,
          createdById: actor.id,
          channel: CommunicationChannel.EMAIL,
          templateKey: PATIENT_EMAIL_TEMPLATE_KEY,
          recipient: normalizedPatientEmail,
          subject,
          body: templateText,
          status: CommunicationJobStatus.QUEUED,
          provider: sender.provider,
          queuedAt: new Date(),
          metadata: {
            idempotencyKey: normalizedIdempotencyKey ?? null,
            branchId: patient.branchId,
            fromAddress: sender.fromAddress,
            fromName: sender.fromName,
            replyTo: replyTo ?? null,
            toAddress: normalizedPatientEmail,
            toName,
            ccAddress: copyAddress ?? null,
            htmlBody,
            textBody: templateText,
            attachmentIds: attachments.map((attachment) => attachment.id),
            attachmentCount: attachments.length,
            hasAttachments: attachments.length > 0,
            source: "PATIENT_PROFILE_EMAIL"
          }
        }
      });

      await tx.messageDelivery.create({
        data: {
          communicationJobId: created.id,
          status: MessageDeliveryStatus.QUEUED,
          provider: sender.provider
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "CommunicationJob",
          entityId: created.id,
          action: "queue_patient_email",
          after: {
            patientId,
            branchId: patient.branchId,
            toAddress: normalizedPatientEmail,
            subject,
            attachmentCount: attachments.length,
            copyToSender: Boolean(copyAddress)
          }
        }
      });

      return created;
    });

    try {
      if (!this.emailService)
        throw new ServiceUnavailableException(
          "El servicio de correo no está configurado para esta organización."
        );
      const emailAttachments = await Promise.all(
        attachments.map(async (attachment) => {
          if (!this.documentsService)
            throw new ServiceUnavailableException("El servicio de archivos no está disponible.");
          const file = await this.documentsService.getPatientFileContent(actor, patientId, attachment.id);
          return {
            filename: file.downloadName,
            content: file.stream,
            contentType: file.mimeType
          };
        })
      );
      const sent = await this.emailService.sendPatientEmail({
        to: normalizedPatientEmail,
        cc: copyAddress,
        replyTo,
        subject,
        html: htmlBody,
        text: templateText,
        attachments: emailAttachments
      });

      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.communicationJob.update({
          where: { id: queued.id },
          data: {
            status: CommunicationJobStatus.SENT,
            sentAt: new Date(),
            providerMessageId: sent.providerMessageId,
            failedAt: null,
            errorMessage: null
          },
          include: this.patientEmailInclude()
        });

        await tx.messageDelivery.create({
          data: {
            communicationJobId: queued.id,
            status: MessageDeliveryStatus.SENT,
            provider: sender.provider,
            providerMessageId: sent.providerMessageId,
            deliveredAt: new Date()
          }
        });

        await tx.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            actorUserId: actor.id,
            entity: "CommunicationJob",
            entityId: queued.id,
            action: "send_patient_email",
            after: {
              patientId,
              status: CommunicationJobStatus.SENT,
              provider: sender.provider,
              providerMessageId: sent.providerMessageId,
              attachmentCount: attachments.length
            }
          }
        });

        return row;
      });

      return this.serializePatientEmail(updated, true);
    } catch (error) {
      const safeMessage =
        error instanceof Error ? error.message.slice(0, 500) : "Unknown email provider error";
      const failed = await this.prisma.$transaction(async (tx) => {
        const row = await tx.communicationJob.update({
          where: { id: queued.id },
          data: {
            status: CommunicationJobStatus.FAILED,
            failedAt: new Date(),
            errorMessage: safeMessage
          },
          include: this.patientEmailInclude()
        });

        await tx.messageDelivery.create({
          data: {
            communicationJobId: queued.id,
            status: MessageDeliveryStatus.FAILED,
            provider: sender.provider,
            failedAt: new Date(),
            errorMessage: safeMessage
          }
        });

        await tx.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            actorUserId: actor.id,
            entity: "CommunicationJob",
            entityId: queued.id,
            action: "fail_patient_email",
            after: { patientId, status: CommunicationJobStatus.FAILED, errorMessage: safeMessage }
          }
        });

        return row;
      });

      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        failed.errorMessage || "No fue posible enviar el correo. Intenta nuevamente."
      );
    }
  }

  async create(actor: DomainActorContext, dto: CreatePatientDto) {
    const prepared = await this.preparePatientForCreate(actor, dto);
    const patient = await this.prisma.$transaction((tx) =>
      this.createPreparedPatientInTransaction(tx, actor, dto, prepared)
    );
    await this.finalizePatientCreation(actor, patient.id, prepared);

    return {
      patient: await this.findOne(actor, patient.id),
      potentialDuplicates: prepared.potentialDuplicates
    };
  }

  async preparePatientForCreate(
    actor: DomainActorContext,
    dto: CreatePatientDto
  ): Promise<PreparedPatientCreate> {
    await this.validateBranch(actor, dto.branchId);
    if (dto.agreementId) await this.validateAgreement(actor, dto.agreementId);
    this.validateBirthDate(dto.birthDate);
    const normalizedPhone =
      dto.phone && this.patientIdentityService
        ? await this.patientIdentityService.normalizePhone(actor.organizationId, dto.phone)
        : undefined;
    const normalizedAlternatePhone =
      dto.alternatePhone && this.patientIdentityService
        ? await this.patientIdentityService.normalizePhone(actor.organizationId, dto.alternatePhone)
        : undefined;
    const phoneForStorage =
      normalizedPhone?.normalizedValue.replace(/^\+/, "") ?? this.normalizePhoneForStorage(dto.phone);
    const alternatePhoneForStorage =
      normalizedAlternatePhone?.normalizedValue.replace(/^\+/, "") ??
      this.normalizePhoneForStorage(dto.alternatePhone);

    if (normalizedPhone)
      await this.ensurePhoneAvailableForStandalonePatient(actor, normalizedPhone.normalizedValue);
    if (normalizedAlternatePhone) {
      await this.ensurePhoneAvailableForStandalonePatient(actor, normalizedAlternatePhone.normalizedValue);
    }

    await this.ensureNoExactPatientDuplicate(actor, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: phoneForStorage,
      email: dto.email
    });

    const potentialDuplicates = await this.findPotentialDuplicates(actor, {
      phone: phoneForStorage,
      email: dto.email,
      documentNumber: dto.documentNumber
    });

    return {
      normalizedPhone: normalizedPhone?.normalizedValue,
      normalizedAlternatePhone: normalizedAlternatePhone?.normalizedValue,
      phoneForStorage,
      alternatePhoneForStorage,
      potentialDuplicates
    };
  }

  async createPreparedPatientInTransaction(
    tx: Prisma.TransactionClient,
    actor: DomainActorContext,
    dto: CreatePatientDto,
    prepared: PreparedPatientCreate
  ) {
    const patientNumber = await generateUniquePatientNumber(tx);
    const created = await tx.patient.create({
        data: {
          patientNumber,
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          agreementId: dto.agreementId?.trim(),
          firstName: this.normalizeDisplayName(dto.firstName),
          socialName: dto.socialName?.trim(),
          lastName: this.normalizeDisplayName(dto.lastName),
          internalNumber: dto.internalNumber?.trim(),
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          sex: dto.sex?.trim(),
          gender: dto.gender?.trim(),
          documentType: dto.documentType?.trim(),
          documentNumber: dto.documentNumber?.trim(),
          email: this.normalizeEmail(dto.email) || undefined,
          phone: prepared.phoneForStorage || undefined,
          alternatePhone: prepared.alternatePhoneForStorage || undefined,
          occupation: dto.occupation?.trim(),
          employer: dto.employer?.trim(),
          observations: dto.observations?.trim(),
          referredBy: dto.referredBy?.trim(),
          source: dto.source?.trim(),
          status: (dto.status as PatientStatus | undefined) ?? "ACTIVE"
        }
    });

    if (dto.contacts?.length) {
      await tx.patientContact.createMany({
          data: dto.contacts.map((contact) => ({
            patientId: created.id,
            name: contact.name.trim(),
            socialName: contact.socialName?.trim(),
            documentNumber: contact.documentNumber?.trim(),
            gender: contact.gender?.trim(),
            relationship: contact.relationship?.trim(),
            phone: contact.phone?.trim(),
            email: contact.email?.toLowerCase().trim(),
            isEmergencyContact: contact.isEmergencyContact ?? false
          }))
      });
    }

    if (dto.address) {
      await tx.patientAddress.create({
          data: {
            patientId: created.id,
            street: dto.address.street?.trim(),
            city: dto.address.city?.trim(),
            state: dto.address.state?.trim(),
            country: dto.address.country?.trim(),
            zipCode: dto.address.zipCode?.trim()
          }
      });
    }

    if (dto.medicalAlerts?.length) {
      await tx.patientMedicalAlert.createMany({
          data: dto.medicalAlerts.map((alert) => ({
            patientId: created.id,
            type: alert.type.trim(),
            description: alert.description.trim(),
            severity: alert.severity.trim(),
            isActive: alert.isActive ?? true
          }))
      });
    }

    await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          ...domainActorAuditFields(actor),
          entity: "Patient",
          entityId: created.id,
          action: "create",
          after: {
            firstName: created.firstName,
            lastName: created.lastName,
            email: created.email,
            phone: created.phone,
            documentNumber: created.documentNumber
          }
        }
    });

    return created;
  }

  async finalizePatientCreation(
    actor: DomainActorContext,
    patientId: string,
    prepared: PreparedPatientCreate
  ) {
    if (this.patientIdentityService && (prepared.normalizedPhone || prepared.normalizedAlternatePhone)) {
      await this.patientIdentityService.syncPatientPhones(
        actor,
        patientId,
        prepared.normalizedPhone,
        prepared.normalizedAlternatePhone
      );
    }
    if (this.patientIdentityService)
      await this.patientIdentityService.recordDuplicateCandidates(actor, patientId);
  }

  async update(actor: AuthUser, id: string, dto: UpdatePatientDto) {
    const current = await this.prisma.patient.findFirst({
      where: this.buildPatientWhere(actor, id),
      include: { contacts: true, address: true, medicalAlerts: true }
    });

    if (!current) throw new NotFoundException("Patient not found");
    if (dto.branchId) await this.validateBranch(actor, dto.branchId);
    if (dto.agreementId) await this.validateAgreement(actor, dto.agreementId);
    this.validateBirthDate(dto.birthDate);
    const normalizedPhone =
      dto.phone !== undefined && dto.phone && this.patientIdentityService
        ? await this.patientIdentityService.normalizePhone(actor.organizationId, dto.phone)
        : undefined;
    const normalizedAlternatePhone =
      dto.alternatePhone !== undefined && dto.alternatePhone && this.patientIdentityService
        ? await this.patientIdentityService.normalizePhone(actor.organizationId, dto.alternatePhone)
        : undefined;
    const nextPhone =
      dto.phone === undefined
        ? current.phone
        : (normalizedPhone?.normalizedValue.replace(/^\+/, "") ?? this.normalizePhoneForStorage(dto.phone));
    const nextAlternatePhone =
      dto.alternatePhone === undefined
        ? current.alternatePhone
        : (normalizedAlternatePhone?.normalizedValue.replace(/^\+/, "") ??
          this.normalizePhoneForStorage(dto.alternatePhone));

    if (normalizedPhone && normalizedPhone.normalizedValue !== current.phone) {
      await this.ensurePhoneAvailableForStandalonePatient(
        actor,
        normalizedPhone.normalizedValue,
        current.id
      );
    }
    if (normalizedAlternatePhone && normalizedAlternatePhone.normalizedValue !== current.alternatePhone) {
      await this.ensurePhoneAvailableForStandalonePatient(
        actor,
        normalizedAlternatePhone.normalizedValue,
        current.id
      );
    }

    const potentialDuplicates = await this.findPotentialDuplicates(
      actor,
      {
        phone: nextPhone,
        email: dto.email === undefined ? current.email : dto.email,
        documentNumber: dto.documentNumber === undefined ? current.documentNumber : dto.documentNumber
      },
      current.id
    );

    const dataToUpdate: Prisma.PatientUpdateManyMutationInput = {
      ...(dto.branchId ? { branchId: dto.branchId } : {}),
      ...(dto.agreementId !== undefined
        ? { agreementId: dto.agreementId ? dto.agreementId.trim() : null }
        : {}),
      ...(dto.firstName !== undefined ? { firstName: this.normalizeDisplayName(dto.firstName) } : {}),
      ...(dto.socialName !== undefined ? { socialName: dto.socialName?.trim() || null } : {}),
      ...(dto.lastName !== undefined ? { lastName: this.normalizeDisplayName(dto.lastName) } : {}),
      ...(dto.internalNumber !== undefined ? { internalNumber: dto.internalNumber === undefined ? undefined : dto.internalNumber.trim() || null } : {}),
      ...(dto.birthDate !== undefined ? { birthDate: dto.birthDate ? new Date(dto.birthDate) : null } : {}),
      ...(dto.sex !== undefined ? { sex: dto.sex?.trim() || null } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender?.trim() || null } : {}),
      ...(dto.documentType !== undefined ? { documentType: dto.documentType?.trim() || null } : {}),
      ...(dto.documentNumber !== undefined ? { documentNumber: dto.documentNumber?.trim() || null } : {}),
      ...(dto.email !== undefined ? { email: this.normalizeEmail(dto.email) || null } : {}),
      ...(dto.phone !== undefined ? { phone: nextPhone || null } : {}),
      ...(dto.alternatePhone !== undefined ? { alternatePhone: nextAlternatePhone || null } : {}),
      ...(dto.occupation !== undefined ? { occupation: dto.occupation?.trim() || null } : {}),
      ...(dto.employer !== undefined ? { employer: dto.employer?.trim() || null } : {}),
      ...(dto.observations !== undefined ? { observations: dto.observations?.trim() || null } : {}),
      ...(dto.referredBy !== undefined ? { referredBy: dto.referredBy?.trim() || null } : {}),
      ...(dto.source !== undefined ? { source: dto.source?.trim() || null } : {}),
      ...(dto.status !== undefined ? { status: dto.status as PatientStatus } : {}),
      version: { increment: 1 }
    };

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.patient.updateMany({
        where: {
          ...this.buildPatientWhere(actor, current.id),
          ...(dto.expectedVersion !== undefined ? { version: dto.expectedVersion } : {})
        },
        data: dataToUpdate
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          "El paciente fue modificado por otro usuario. Recarga la ficha antes de guardar."
        );
      }

      if (dto.address !== undefined) {
        if (current.address) {
          await tx.patientAddress.update({
            where: { patientId: current.id },
            data: {
              street: dto.address.street?.trim() || null,
              city: dto.address.city?.trim() || null,
              state: dto.address.state?.trim() || null,
              country: dto.address.country?.trim() || null,
              zipCode: dto.address.zipCode?.trim() || null
            }
          });
        } else if (dto.address.street || dto.address.city || dto.address.state || dto.address.country || dto.address.zipCode) {
          await tx.patientAddress.create({
            data: {
              patientId: current.id,
              street: dto.address.street?.trim() || null,
              city: dto.address.city?.trim() || null,
              state: dto.address.state?.trim() || null,
              country: dto.address.country?.trim() || null,
              zipCode: dto.address.zipCode?.trim() || null
            }
          });
        }
      }

      if (dto.contacts !== undefined) {
        await tx.patientContact.deleteMany({ where: { patientId: current.id } });
        if (dto.contacts.length) {
          await tx.patientContact.createMany({
            data: dto.contacts.map((contact) => ({
              patientId: current.id,
              name: contact.name.trim(),
              socialName: contact.socialName?.trim(),
              documentNumber: contact.documentNumber?.trim(),
              gender: contact.gender?.trim(),
              relationship: contact.relationship?.trim(),
              phone: contact.phone?.trim(),
              email: contact.email?.toLowerCase().trim(),
              isEmergencyContact: contact.isEmergencyContact ?? false
            }))
          });
        }
      }

      if (dto.medicalAlerts !== undefined) {
        await tx.patientMedicalAlert.deleteMany({ where: { patientId: current.id } });
        if (dto.medicalAlerts.length) {
          await tx.patientMedicalAlert.createMany({
            data: dto.medicalAlerts.map((alert) => ({
              patientId: current.id,
              type: alert.type.trim(),
              description: alert.description.trim(),
              severity: alert.severity.trim(),
              isActive: alert.isActive ?? true
            }))
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Patient",
          entityId: current.id,
          action: "update",
          before: {
            firstName: current.firstName,
            lastName: current.lastName,
            status: current.status,
            branchId: current.branchId,
            agreementId: current.agreementId,
            internalNumber: current.internalNumber,
            birthDate: current.birthDate,
            gender: current.gender,
            documentType: current.documentType,
            documentNumber: current.documentNumber,
            email: current.email,
            phone: current.phone,
            alternatePhone: current.alternatePhone
          },
          after: {
            firstName: dto.firstName ?? current.firstName,
            lastName: dto.lastName ?? current.lastName,
            status: dto.status ?? current.status,
            branchId: dto.branchId ?? current.branchId,
            agreementId: dto.agreementId !== undefined ? dto.agreementId : current.agreementId,
            internalNumber: dto.internalNumber !== undefined ? dto.internalNumber : current.internalNumber,
            birthDate: dto.birthDate ?? current.birthDate,
            gender: dto.gender ?? current.gender,
            documentType: dto.documentType ?? current.documentType,
            documentNumber: dto.documentNumber ?? current.documentNumber,
            email: dto.email ?? current.email,
            phone: dto.phone ?? current.phone,
            alternatePhone: dto.alternatePhone ?? current.alternatePhone,
            version: current.version + 1
          }
        }
      });
    });

    if (this.patientIdentityService && (dto.phone !== undefined || dto.alternatePhone !== undefined)) {
      await this.patientIdentityService.syncPatientPhones(
        actor,
        current.id,
        dto.phone === undefined ? this.phoneForParsing(current.phone) : normalizedPhone?.normalizedValue,
        dto.alternatePhone === undefined
          ? this.phoneForParsing(current.alternatePhone)
          : normalizedAlternatePhone?.normalizedValue
      );
    }
    if (this.patientIdentityService) await this.patientIdentityService.recordDuplicateCandidates(actor, current.id);

    return {
      patient: await this.findOne(actor, current.id),
      potentialDuplicates
    };
  }

  async softDelete(actor: AuthUser, id: string) {
    const current = await this.prisma.patient.findFirst({
      where: this.buildPatientWhere(actor, id)
    });

    if (!current) throw new NotFoundException("Patient not found");

    await this.prisma.patient.update({
      where: { id: current.id },
      data: {
        status: "INACTIVE",
        deletedAt: new Date()
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "Patient",
        entityId: current.id,
        action: "soft_delete",
        before: {
          status: current.status,
          deletedAt: current.deletedAt
        },
        after: {
          status: "INACTIVE",
          deletedAt: new Date().toISOString()
        }
      }
    });

    return { success: true };
  }

  async addNote(actor: AuthUser, patientId: string, dto: AddPatientNoteDto) {
    await this.ensurePatientExists(actor, patientId);

    const noteText = dto.note.trim();
    if (!noteText) throw new BadRequestException("Note is required");

    const fileAttachmentIds = [
      ...new Set((dto.fileAttachmentIds ?? []).map((id) => id.trim()).filter(Boolean))
    ];
    if (fileAttachmentIds.length) {
      const files = await this.prisma.fileAttachment.findMany({
        where: {
          id: { in: fileAttachmentIds },
          organizationId: actor.organizationId,
          patientId,
          patient: { branchId: { in: actor.branchIds }, deletedAt: null }
        },
        select: { id: true }
      });
      if (files.length !== fileAttachmentIds.length) {
        throw new BadRequestException("One or more attachments do not belong to this patient");
      }
    }

    const note = await this.prisma.$transaction(async (tx) => {
      const created = await tx.patientNote.create({
        data: {
          patientId,
          userId: actor.id,
          note: noteText,
          isPrivate: dto.isPrivate ?? false
        }
      });

      if (fileAttachmentIds.length) {
        await tx.patientNoteAttachment.createMany({
          data: fileAttachmentIds.map((fileAttachmentId) => ({
            patientNoteId: created.id,
            fileAttachmentId
          }))
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "PatientNote",
          entityId: created.id,
          action: "create",
          after: {
            patientId,
            isPrivate: created.isPrivate,
            attachmentCount: fileAttachmentIds.length
          }
        }
      });

      return tx.patientNote.findUniqueOrThrow({
        where: { id: created.id },
        include: this.patientNoteInclude()
      });
    });

    return note;
  }

  async listTasks(actor: AuthUser, patientId: string, query: ListPatientTasksQueryDto) {
    await this.ensurePatientExists(actor, patientId);

    const includeCompleted = ["true", "1", "yes"].includes((query.includeCompleted ?? "").toLowerCase());

    return this.prisma.patientTask.findMany({
      where: {
        organizationId: actor.organizationId,
        patientId,
        ...(includeCompleted ? {} : { status: PatientTaskStatus.PENDING })
      },
      include: this.patientTaskInclude(),
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }]
    });
  }

  async createTask(actor: AuthUser, patientId: string, dto: CreatePatientTaskDto) {
    const patient = await this.ensurePatientExists(actor, patientId);

    const type = dto.type.trim();
    const detail = dto.detail.trim();
    if (!type || !detail) throw new BadRequestException("Task type and detail are required");

    const assignedToId = await this.validateTaskAssignee(actor, dto.assignedToId);

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.patientTask.create({
        data: {
          organizationId: actor.organizationId,
          branchId: patient.branchId,
          patientId,
          type,
          title: type,
          detail,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          assignedToId,
          createdById: actor.id
        },
        include: this.patientTaskInclude()
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "PatientTask",
          entityId: task.id,
          action: "create",
          after: {
            patientId,
            type,
            assignedToId
          }
        }
      });

      return task;
    });
  }

  async updateTask(actor: AuthUser, patientId: string, taskId: string, dto: UpdatePatientTaskDto) {
    await this.ensurePatientExists(actor, patientId);
    const current = await this.prisma.patientTask.findFirst({
      where: { id: taskId, organizationId: actor.organizationId, patientId }
    });
    if (!current) throw new NotFoundException("Patient task not found");

    const data: Prisma.PatientTaskUncheckedUpdateInput = {};

    if (dto.type !== undefined) {
      const type = dto.type.trim();
      if (!type) throw new BadRequestException("Task type is required");
      data.type = type;
    }
    if (dto.detail !== undefined) {
      const detail = dto.detail.trim();
      if (!detail) throw new BadRequestException("Task detail is required");
      data.detail = detail;
    }
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.assignedToId !== undefined) {
      data.assignedToId = await this.validateTaskAssignee(actor, dto.assignedToId);
    }

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.patientTask.update({
        where: { id: current.id },
        data,
        include: this.patientTaskInclude()
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "PatientTask",
          entityId: task.id,
          action: "update",
          before: {
            type: current.type,
            detail: current.detail,
            dueDate: current.dueDate,
            assignedToId: current.assignedToId
          },
          after: {
            type: task.type,
            detail: task.detail,
            dueDate: task.dueDate,
            assignedToId: task.assignedToId
          }
        }
      });

      return task;
    });
  }

  async completeTask(actor: AuthUser, patientId: string, taskId: string) {
    await this.ensurePatientExists(actor, patientId);
    const current = await this.prisma.patientTask.findFirst({
      where: { id: taskId, organizationId: actor.organizationId, patientId }
    });
    if (!current) throw new NotFoundException("Patient task not found");

    if (current.status === PatientTaskStatus.COMPLETED) {
      return this.prisma.patientTask.findUniqueOrThrow({
        where: { id: current.id },
        include: this.patientTaskInclude()
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.patientTask.update({
        where: { id: current.id },
        data: {
          status: PatientTaskStatus.COMPLETED,
          completedAt: new Date(),
          completedById: actor.id
        },
        include: this.patientTaskInclude()
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "PatientTask",
          entityId: task.id,
          action: "complete",
          before: {
            status: current.status
          },
          after: {
            status: task.status,
            completedAt: task.completedAt
          }
        }
      });

      return task;
    });
  }

  async addAlert(actor: AuthUser, patientId: string, dto: AddPatientAlertDto) {
    await this.ensurePatientExists(actor, patientId);

    const alert = await this.prisma.patientMedicalAlert.create({
      data: {
        patientId,
        type: dto.type.trim(),
        description: dto.description.trim(),
        severity: dto.severity.trim(),
        isActive: dto.isActive ?? true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "PatientMedicalAlert",
        entityId: alert.id,
        action: "create",
        after: {
          patientId,
          type: alert.type,
          severity: alert.severity,
          isActive: alert.isActive
        }
      }
    });

    return alert;
  }

  async timeline(actor: AuthUser, patientId: string) {
    await this.ensurePatientExists(actor, patientId);
    return this.getTimelineInternal(actor, patientId);
  }

  async merge(actor: AuthUser, dto: MergePatientsDto) {
    const targetPatientId = dto.targetPatientId.trim();
    const sourcePatientId = dto.sourcePatientId.trim();
    if (!targetPatientId || !sourcePatientId || targetPatientId === sourcePatientId) {
      throw new BadRequestException("Select two different patients");
    }

    const [target, source] = await Promise.all([
      this.prisma.patient.findFirst({
        where: {
          id: targetPatientId,
          organizationId: actor.organizationId,
          branchId: { in: actor.branchIds },
          deletedAt: null
        }
      }),
      this.prisma.patient.findFirst({
        where: {
          id: sourcePatientId,
          organizationId: actor.organizationId,
          branchId: { in: actor.branchIds },
          deletedAt: null
        }
      })
    ]);
    if (!target || !source) throw new NotFoundException("Patient not found");

    await this.prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.patientContact.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.patientMedicalAlert.updateMany({
          where: { patientId: source.id },
          data: { patientId: target.id }
        }),
        tx.patientNote.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.appointment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.medicalCondition.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.allergy.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.medication.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.clinicalEvolution.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.prescription.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.clinicalDocument.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.odontogramRecord.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.toothCondition.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.toothProcedure.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.periodontalChart.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.treatmentPlan.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.budget.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.payment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.paymentLink.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.installmentPlan.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.installment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.refund.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.collectionCase.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.patientTask.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.fileAttachment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.radiographyAnalysis.updateMany({
          where: { patientId: source.id },
          data: { patientId: target.id }
        }),
        tx.consent.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.labOrder.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } })
      ]);

      const [targetAddress, targetMedicalHistory] = await Promise.all([
        tx.patientAddress.findUnique({ where: { patientId: target.id } }),
        tx.medicalHistory.findUnique({ where: { patientId: target.id } })
      ]);
      if (!targetAddress) {
        await tx.patientAddress.updateMany({
          where: { patientId: source.id },
          data: { patientId: target.id }
        });
      }
      if (!targetMedicalHistory) {
        await tx.medicalHistory.updateMany({
          where: { patientId: source.id },
          data: { patientId: target.id }
        });
      }

      await tx.patient.update({
        where: { id: target.id },
        data: {
          agreementId: target.agreementId ?? source.agreementId
        }
      });
      await tx.patient.update({
        where: { id: source.id },
        data: {
          status: "INACTIVE",
          deletedAt: new Date()
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Patient",
          entityId: target.id,
          action: "merge",
          after: {
            targetPatientId: target.id,
            sourcePatientId: source.id
          }
        }
      });
    });

    return this.findOne(actor, target.id);
  }

  private patientEmailWhere(
    actor: AuthUser,
    patientId: string,
    query: ListPatientEmailsQueryDto
  ): Prisma.CommunicationJobWhereInput {
    const monthRange = this.parseEmailMonth(query.month);
    const status = this.resolveEmailStatusFilter(query);
    return {
      organizationId: actor.organizationId,
      patientId,
      channel: CommunicationChannel.EMAIL,
      templateKey: PATIENT_EMAIL_TEMPLATE_KEY,
      patient: { branchId: { in: actor.branchIds }, deletedAt: null },
      ...(status ? { status } : {}),
      ...(query.filter === "withFiles" ? { metadata: { path: ["hasAttachments"], equals: true } } : {}),
      ...(monthRange ? { createdAt: { gte: monthRange.start, lt: monthRange.end } } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { subject: { contains: query.search.trim(), mode: "insensitive" } },
              { recipient: { contains: query.search.trim(), mode: "insensitive" } }
            ]
          }
        : {})
    };
  }

  private patientEmailInclude() {
    return {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      deliveries: { orderBy: { createdAt: "desc" as const } }
    };
  }

  private serializePatientEmail(
    email: Prisma.CommunicationJobGetPayload<{
      include: {
        createdBy: { select: { id: true; firstName: true; lastName: true; email: true } };
        deliveries: true;
      };
    }>,
    includeBody: boolean
  ) {
    const metadata = this.emailMetadata(email.metadata);
    const attachmentIds = Array.isArray(metadata.attachmentIds)
      ? metadata.attachmentIds.filter((entry): entry is string => typeof entry === "string")
      : [];
    return {
      id: email.id,
      patientId: email.patientId,
      subject: email.subject ?? "",
      status: email.status,
      provider: email.provider,
      providerMessageId: email.providerMessageId,
      fromAddress: this.stringOrNull(metadata.fromAddress),
      fromName: this.stringOrNull(metadata.fromName),
      toAddress: this.stringOrNull(metadata.toAddress) ?? email.recipient,
      toName: this.stringOrNull(metadata.toName),
      ccAddress: this.stringOrNull(metadata.ccAddress),
      senderUser: email.createdBy,
      preview: (this.stringOrNull(metadata.textBody) ?? email.body).slice(0, 180),
      attachmentCount:
        typeof metadata.attachmentCount === "number" ? metadata.attachmentCount : attachmentIds.length,
      attachmentIds,
      queuedAt: email.queuedAt,
      sentAt: email.sentAt,
      failedAt: email.failedAt,
      createdAt: email.createdAt,
      updatedAt: email.updatedAt,
      failureMessage: email.status === CommunicationJobStatus.FAILED ? email.errorMessage : null,
      deliveries: email.deliveries.map((delivery) => ({
        id: delivery.id,
        status: delivery.status,
        provider: delivery.provider,
        providerMessageId: delivery.providerMessageId,
        deliveredAt: delivery.deliveredAt,
        failedAt: delivery.failedAt,
        errorMessage: delivery.errorMessage,
        createdAt: delivery.createdAt
      })),
      ...(includeBody
        ? {
            htmlBody: this.stringOrNull(metadata.htmlBody),
            textBody: this.stringOrNull(metadata.textBody) ?? email.body
          }
        : {})
    };
  }

  private async getPatientForEmail(actor: AuthUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: this.buildPatientWhere(actor, patientId),
      select: {
        id: true,
        patientNumber: true,
        organizationId: true,
        branchId: true,
        firstName: true,
        lastName: true,
        email: true,
        organization: { select: { name: true, email: true, phone: true, address: true, logoUrl: true } },
        branch: { select: { id: true, name: true, email: true, phone: true, address: true } }
      }
    });
    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
  }

  private async findIdempotentPatientEmail(actor: AuthUser, patientId: string, idempotencyKey: string) {
    return this.prisma.communicationJob.findFirst({
      where: {
        organizationId: actor.organizationId,
        patientId,
        channel: CommunicationChannel.EMAIL,
        templateKey: PATIENT_EMAIL_TEMPLATE_KEY,
        createdById: actor.id,
        patient: { branchId: { in: actor.branchIds }, deletedAt: null },
        metadata: { path: ["idempotencyKey"], equals: idempotencyKey }
      },
      include: this.patientEmailInclude()
    });
  }

  private async resolvePatientEmailAttachments(
    actor: AuthUser,
    patientId: string,
    fileAttachmentIds: string[]
  ) {
    const uniqueIds = [...new Set(fileAttachmentIds.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length > PATIENT_EMAIL_MAX_ATTACHMENTS)
      throw new BadRequestException("Solo puedes adjuntar hasta 3 archivos.");
    if (!uniqueIds.length) return [];

    const files = await this.prisma.fileAttachment.findMany({
      where: {
        id: { in: uniqueIds },
        organizationId: actor.organizationId,
        patientId,
        deletedAt: null,
        patient: { branchId: { in: actor.branchIds }, deletedAt: null }
      },
      select: { id: true, originalName: true, mimeType: true, size: true }
    });
    if (files.length !== uniqueIds.length)
      throw new BadRequestException("Uno o más archivos no pertenecen a este paciente.");

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > PATIENT_EMAIL_MAX_TOTAL_BYTES)
      throw new BadRequestException("Los archivos no deben superar 25 MB en total.");

    for (const file of files) {
      if (file.size <= 0) throw new BadRequestException("No se pueden adjuntar archivos vacíos.");
      const extension = extname(file.originalName).toLowerCase();
      if (
        !PATIENT_EMAIL_ALLOWED_EXTENSIONS.has(extension) ||
        !PATIENT_EMAIL_ALLOWED_MIME_TYPES.has(file.mimeType)
      ) {
        throw new BadRequestException("Archivo no permitido.");
      }
    }

    return files;
  }

  private resolveEmailStatusFilter(query: ListPatientEmailsQueryDto) {
    if (query.status) return query.status;
    if (query.filter === "sent") return CommunicationJobStatus.SENT;
    if (query.filter === "queued") return CommunicationJobStatus.QUEUED;
    if (query.filter === "failed") return CommunicationJobStatus.FAILED;
    if (query.filter === "cancelled") return CommunicationJobStatus.CANCELLED;
    if (query.filter === "draft") return CommunicationJobStatus.PENDING;
    return undefined;
  }

  private parseEmailMonth(month?: string) {
    if (!month) return undefined;
    const match = /^(\d{4})-(\d{2})$/.exec(month.trim());
    if (!match) throw new BadRequestException("Mes inválido");
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) throw new BadRequestException("Mes inválido");
    return {
      start: new Date(Date.UTC(year, monthIndex, 1)),
      end: new Date(Date.UTC(year, monthIndex + 1, 1))
    };
  }

  private normalizeRequiredEmail(
    value: string | null | undefined,
    missingMessage: string,
    invalidMessage: string
  ) {
    const email = value?.trim().toLowerCase();
    if (!email) throw new BadRequestException(missingMessage);
    if (this.hasHeaderInjection(email) || !EMAIL_REGEX.test(email))
      throw new BadRequestException(invalidMessage);
    return email;
  }

  private normalizeEmailSubject(value: string) {
    const subject = value.trim().replace(/[\r\n]+/g, " ");
    if (!subject) throw new BadRequestException("Escribe un asunto.");
    if (this.hasHeaderInjection(subject)) throw new BadRequestException("Asunto inválido.");
    return subject;
  }

  private decodeEmailHtml(value: string) {
    try {
      const decoded = Buffer.from(value, "base64").toString("utf8");
      if (!decoded.trim()) throw new BadRequestException("Escribe el contenido del mensaje.");
      return decoded;
    } catch {
      throw new BadRequestException("Contenido del mensaje inválido.");
    }
  }

  private sanitizeEmailHtml(value: string) {
    return sanitizeRichTextHtml(value);
  }

  private htmlToText(value: string) {
    return value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h1|h2|h3|li)>/gi, "\n")
      .replace(/<li>/gi, "- ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private renderPatientEmailTemplate(input: {
    organizationName: string;
    branchName: string;
    branchAddress?: string;
    branchPhone?: string;
    branchEmail?: string;
    logoUrl?: string;
    patientName: string;
    contentHtml: string;
  }) {
    const logo =
      input.logoUrl && /^https:\/\//i.test(input.logoUrl)
        ? `<img src="${this.escapeHtmlAttribute(input.logoUrl)}" alt="Dental+" width="120" style="display:block;border:0;max-width:120px;height:auto;">`
        : `<div style="font-size:28px;font-weight:800;letter-spacing:-0.02em;color:#ef4444;">Dental<span style="color:#0f172a;">+</span></div>`;
    return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f3f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7fb;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;background:#ffffff;border:1px solid #dbe7f3;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 18px;border-bottom:1px solid #e5eef7;">${logo}<div style="margin-top:14px;font-size:13px;color:#64748b;">${this.escapeHtml(input.branchName || input.organizationName)}</div></td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Hola ${this.escapeHtml(input.patientName || "paciente")},</p>
          <div style="font-size:15px;line-height:1.7;color:#1f2937;">${input.contentHtml}</div>
          <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5eef7;font-size:14px;line-height:1.6;color:#334155;">
            <strong>${this.escapeHtml(input.branchName || input.organizationName)}</strong><br>
            ${input.branchAddress ? `${this.escapeHtml(input.branchAddress)}<br>` : ""}
            ${input.branchPhone ? `Tel. ${this.escapeHtml(input.branchPhone)}<br>` : ""}
            ${input.branchEmail ? `<a href="mailto:${this.escapeHtmlAttribute(input.branchEmail)}" style="color:#2563eb;text-decoration:none;">${this.escapeHtml(input.branchEmail)}</a>` : ""}
          </div>
        </td></tr>
        <tr><td style="padding:18px 32px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5;text-align:center;">Este mensaje contiene informacion relacionada con tu atencion dental. Si recibiste este correo por error, comunicate con la clinica.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private renderPatientEmailText(input: {
    organizationName: string;
    branchName: string;
    branchAddress?: string;
    branchPhone?: string;
    branchEmail?: string;
    patientName: string;
    contentText: string;
  }) {
    return [
      `Hola ${input.patientName || "paciente"},`,
      "",
      input.contentText,
      "",
      input.branchName || input.organizationName,
      input.branchAddress,
      input.branchPhone ? `Tel. ${input.branchPhone}` : undefined,
      input.branchEmail,
      "",
      "Este mensaje contiene informacion relacionada con tu atencion dental."
    ]
      .filter((line) => line !== undefined)
      .join("\n");
  }

  private getEmailSender() {
    const sender = this.emailService?.getDefaultSender() ?? {
      fromAddress: "no-reply@dentalsuite.com",
      fromName: "Dental+",
      provider: "smtp"
    };
    this.normalizeRequiredEmail(
      sender.fromAddress,
      "El servicio de correo no está configurado para esta organización.",
      "El remitente configurado no tiene un formato válido."
    );
    return sender;
  }

  private firstValidEmail(...values: Array<string | null | undefined>) {
    for (const value of values) {
      const email = value?.trim().toLowerCase();
      if (email && !this.hasHeaderInjection(email) && EMAIL_REGEX.test(email)) return email;
    }
    return undefined;
  }

  private hasHeaderInjection(value: string) {
    return /[\r\n]/.test(value);
  }

  private emailMetadata(value: Prisma.JsonValue | null): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private stringOrNull(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private escapeHtmlAttribute(value: string) {
    return this.escapeHtml(value).replace(/`/g, "&#96;");
  }

  private async getTimelineInternal(actor: AuthUser, patientId: string) {
    const patient = await this.ensurePatientExists(actor, patientId);
    const resolvedId = patient.id;

    const [notes, alerts] = await Promise.all([
      this.prisma.patientNote.findMany({
        where: { patientId: resolvedId },
        include: this.patientNoteInclude(),
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.patientMedicalAlert.findMany({
        where: { patientId: resolvedId },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const events = [
      {
        type: "PATIENT_CREATED",
        date: patient.createdAt,
        payload: {}
      },
      ...notes.map((note) => ({
        type: "NOTE",
        date: note.createdAt,
        payload: {
          id: note.id,
          note: note.note,
          isPrivate: note.isPrivate,
          user: note.user,
          attachments: note.attachments
        }
      })),
      ...alerts.map((alert) => ({
        type: "ALERT",
        date: alert.createdAt,
        payload: {
          id: alert.id,
          type: alert.type,
          description: alert.description,
          severity: alert.severity,
          isActive: alert.isActive
        }
      }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return events;
  }

  private async getPatientFinancialSummary(actor: AuthUser, patientId: string) {
    const billablePaymentStatus = { notIn: [PaymentStatus.REFUNDED, PaymentStatus.VOIDED] };
    const [plannedTotal, allocatedTotal, totalPayments, overdueInstallments] = await Promise.all([
      this.prisma.treatmentPlanItem.aggregate({
        _sum: { total: true },
        where: {
          treatmentPlan: {
            organizationId: actor.organizationId,
            patientId,
            branchId: { in: actor.branchIds },
            isAlternative: false
          },
          status: { not: TreatmentPlanItemStatus.CANCELLED }
        }
      }),
      this.prisma.paymentAllocation.aggregate({
        _sum: { amount: true },
        where: {
          payment: {
            organizationId: actor.organizationId,
            patientId,
            status: billablePaymentStatus
          },
          treatmentPlanItem: {
            treatmentPlan: {
              organizationId: actor.organizationId,
              patientId,
              branchId: { in: actor.branchIds },
              isAlternative: false
            }
          }
        }
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          organizationId: actor.organizationId,
          patientId,
          status: billablePaymentStatus
        }
      }),
      this.prisma.installment.count({
        where: {
          patientId,
          patient: { organizationId: actor.organizationId, branchId: { in: actor.branchIds } },
          dueDate: { lt: new Date() },
          status: { notIn: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] }
        }
      })
    ]);

    const plannedAmount = Number(plannedTotal._sum.total ?? 0);
    const allocatedPaidAmount = Number(allocatedTotal._sum.amount ?? 0);
    const totalPaidAmount = Number(totalPayments._sum.amount ?? 0);

    return {
      plannedAmount: this.roundMoney(plannedAmount),
      allocatedPaidAmount: this.roundMoney(allocatedPaidAmount),
      totalPaidAmount: this.roundMoney(totalPaidAmount),
      outstandingAmount: this.roundMoney(Math.max(plannedAmount - allocatedPaidAmount, 0)),
      unallocatedCredit: this.roundMoney(Math.max(totalPaidAmount - allocatedPaidAmount, 0)),
      overdueInstallments
    };
  }

  private async getPatientBenefitsSummary(actor: AuthUser, patientId: string) {
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 30);
    const [activeBenefits, expiring] = await Promise.all([
      this.prisma.patientBenefitCoverage.count({
        where: {
          organizationId: actor.organizationId,
          patientId,
          branchId: { in: actor.branchIds },
          status: PatientBenefitCoverageStatus.ACTIVE,
          OR: [{ endsAt: null }, { endsAt: { gte: now } }]
        }
      }),
      this.prisma.patientBenefitCoverage.findFirst({
        where: {
          organizationId: actor.organizationId,
          patientId,
          branchId: { in: actor.branchIds },
          status: PatientBenefitCoverageStatus.ACTIVE,
          endsAt: { gte: now, lte: soon }
        },
        orderBy: { endsAt: "asc" },
        select: { providerName: true, endsAt: true }
      })
    ]);
    return {
      activeBenefits,
      coverageExpiringSoon: expiring ? { providerName: expiring.providerName, endsAt: expiring.endsAt } : null
    };
  }

  private patientBenefitCoverageInclude() {
    return {
      branch: { select: { id: true, name: true, timezone: true } },
      agreement: {
        select: {
          id: true,
          name: true,
          discountPercent: true,
          payrollDiscount: true,
          isActive: true,
          priceList: { select: { id: true, name: true, isDefault: true } }
        }
      },
      validations: { orderBy: { createdAt: "desc" as const }, take: 6 },
      documents: {
        include: {
          fileAttachment: {
            select: {
              id: true,
              originalName: true,
              mimeType: true,
              size: true,
              url: true,
              category: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: "desc" as const }
      },
      audits: { orderBy: { createdAt: "desc" as const }, take: 10 }
    };
  }

  private buildBenefitCoverageResponse(coverages: any[]) {
    const now = new Date();
    const active = coverages.filter(
      (coverage) =>
        coverage.status === PatientBenefitCoverageStatus.ACTIVE &&
        (!coverage.endsAt || coverage.endsAt >= now)
    );
    const pending = coverages.filter((coverage) =>
      [
        PatientBenefitCoverageStatus.PENDING_VALIDATION,
        PatientBenefitCoverageStatus.VALIDATING,
        PatientBenefitCoverageStatus.REQUIRES_DOCUMENTS
      ].includes(coverage.status)
    );
    const nextExpiration = active
      .filter((coverage) => coverage.endsAt)
      .sort((left, right) => left.endsAt.getTime() - right.endsAt.getTime())[0];
    return {
      summary: {
        total: coverages.length,
        active: active.length,
        pendingValidation: pending.length,
        documents: coverages.reduce((sum, coverage) => sum + (coverage.documents?.length ?? 0), 0),
        nextExpiration: nextExpiration
          ? { providerName: nextExpiration.providerName, endsAt: nextExpiration.endsAt }
          : null
      },
      items: coverages.map((coverage) => this.serializeBenefitCoverage(coverage))
    };
  }

  private serializeBenefitCoverage(coverage: any) {
    return {
      ...coverage,
      coveragePercent: this.nullableNumber(coverage.coveragePercent),
      copayAmount: this.nullableNumber(coverage.copayAmount),
      deductibleAmount: this.nullableNumber(coverage.deductibleAmount),
      annualLimitAmount: this.nullableNumber(coverage.annualLimitAmount),
      validations:
        coverage.validations?.map((validation: any) => ({
          ...validation,
          retryCount: Number(validation.retryCount ?? 0)
        })) ?? [],
      documents: coverage.documents ?? [],
      audits: coverage.audits ?? []
    };
  }

  private async getPatientForBenefitCoverage(actor: AuthUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: this.buildPatientWhere(actor, patientId),
      select: { id: true, patientNumber: true, branchId: true, agreementId: true }
    });
    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
  }

  private async getBenefitCoverageOrThrow(actor: AuthUser, patientId: string, coverageId: string) {
    const coverage = await this.prisma.patientBenefitCoverage.findFirst({
      where: {
        id: coverageId,
        organizationId: actor.organizationId,
        patientId,
        branchId: { in: actor.branchIds }
      },
      include: this.patientBenefitCoverageInclude()
    });
    if (!coverage) throw new NotFoundException("Patient coverage not found");
    return coverage;
  }

  private async findIdempotentBenefitCoverage(actor: AuthUser, patientId: string, idempotencyKey?: string) {
    const normalized = this.cleanString(idempotencyKey);
    if (!normalized) return null;
    const audit = await this.prisma.patientBenefitCoverageAudit.findFirst({
      where: {
        organizationId: actor.organizationId,
        patientId,
        correlationId: normalized,
        action: "create"
      },
      include: { coverage: { include: this.patientBenefitCoverageInclude() } },
      orderBy: { createdAt: "desc" }
    });
    return audit?.coverage ?? null;
  }

  private async assertNoDuplicateBenefitCoverage(
    actor: AuthUser,
    patientId: string,
    providerName: string,
    policyNumber?: string | null,
    affiliateNumber?: string | null
  ) {
    const identity: Prisma.PatientBenefitCoverageWhereInput[] = [];
    if (policyNumber) identity.push({ policyNumber });
    if (affiliateNumber) identity.push({ affiliateNumber });
    if (!identity.length) return;
    const duplicate = await this.prisma.patientBenefitCoverage.findFirst({
      where: {
        organizationId: actor.organizationId,
        patientId,
        providerName: { equals: providerName, mode: "insensitive" },
        status: { notIn: [PatientBenefitCoverageStatus.CANCELLED, PatientBenefitCoverageStatus.INACTIVE] },
        OR: identity
      },
      select: { id: true }
    });
    if (duplicate)
      throw new ConflictException("Ya existe un beneficio o cobertura similar para este paciente.");
  }

  private normalizeBenefitCoverageInput(
    dto: CreatePatientBenefitCoverageDto | UpdatePatientBenefitCoverageDto
  ) {
    const providerName = "providerName" in dto ? this.cleanString(dto.providerName) : undefined;
    if ("providerName" in dto && dto.providerName !== undefined && !providerName) {
      throw new BadRequestException("providerName is required");
    }
    return {
      type: dto.type,
      status: dto.status,
      providerName: providerName as string,
      branchId: this.cleanString(dto.branchId),
      agreementId: dto.agreementId === null ? null : this.cleanString(dto.agreementId),
      planName: this.cleanString(dto.planName),
      policyNumber: this.cleanString(dto.policyNumber),
      affiliateNumber: this.cleanString(dto.affiliateNumber),
      certificateNumber: this.cleanString(dto.certificateNumber),
      employeeNumber: this.cleanString(dto.employeeNumber),
      holderName: this.cleanString(dto.holderName),
      holderDocument: this.cleanString(dto.holderDocument),
      relationshipToPatient: this.cleanString(dto.relationshipToPatient),
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      coveragePercent: dto.coveragePercent,
      copayAmount: dto.copayAmount,
      deductibleAmount: dto.deductibleAmount,
      annualLimitAmount: dto.annualLimitAmount,
      requiresAuthorization: dto.requiresAuthorization,
      notes: this.cleanString(dto.notes),
      externalReference: this.cleanString(dto.externalReference)
    };
  }

  private validateBenefitCoverageDates(startsAt?: string, endsAt?: string) {
    if (!startsAt || !endsAt) return;
    if (new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
      throw new BadRequestException("La fecha de inicio no puede ser posterior a la fecha de termino.");
    }
  }

  private coverageValidationSummary(
    normalizedResult: Partial<CoverageNormalizedResultDto>,
    status: PatientBenefitCoverageStatus
  ) {
    if (status === PatientBenefitCoverageStatus.ACTIVE) {
      const coverage = normalizedResult.coveragePercent;
      return typeof coverage === "number" ? `Cobertura activa al ${coverage}%` : "Cobertura activa";
    }
    if (status === PatientBenefitCoverageStatus.REQUIRES_DOCUMENTS) return "Requiere documentos";
    if (status === PatientBenefitCoverageStatus.REJECTED) return "Validacion rechazada";
    if (status === PatientBenefitCoverageStatus.INTEGRATION_ERROR) return "Error de integracion";
    return "Validacion registrada";
  }

  private cleanString(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private dateOrNull(value?: string | null) {
    return value ? new Date(value) : null;
  }

  private numberOrUndefined(value?: number | null) {
    return value === undefined || value === null || Number.isNaN(value) ? undefined : value;
  }

  private nullableNumber(value: unknown) {
    if (value === null || value === undefined) return null;
    return Number(value);
  }

  private auditJson(value: unknown) {
    return JSON.parse(JSON.stringify(value ?? null));
  }

  private inputJson(value: unknown): Prisma.InputJsonValue | undefined {
    return value === undefined || value === null ? undefined : (value as Prisma.InputJsonValue);
  }

  private async validateBranch(actor: AuthUser, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchScope(actor, branchId),
        organizationId: actor.organizationId,
        deletedAt: null,
        status: "ACTIVE"
      }
    });

    if (!branch) throw new BadRequestException("Invalid branchId");
  }

  private async validateAgreement(actor: AuthUser, agreementId: string) {
    const now = new Date();
    const agreement = await this.prisma.agreement.findFirst({
      where: {
        id: agreementId,
        organizationId: actor.organizationId,
        isActive: true,
        status: AgreementStatus.ACTIVE,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
        ]
      }
    });

    if (!agreement) throw new BadRequestException("Invalid agreementId");
  }

  private patientNoteInclude() {
    return {
      user: { select: { id: true, firstName: true, lastName: true } },
      attachments: {
        include: {
          fileAttachment: {
            select: {
              id: true,
              fileName: true,
              originalName: true,
              mimeType: true,
              size: true,
              url: true,
              category: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: "asc" as const }
      }
    };
  }

  private patientTaskInclude() {
    const userSelect = { id: true, firstName: true, lastName: true, email: true };
    return {
      assignedTo: { select: userSelect },
      createdBy: { select: userSelect },
      completedBy: { select: userSelect }
    };
  }

  private async validateTaskAssignee(actor: AuthUser, assignedToId?: string | null) {
    const trimmed = assignedToId?.trim();
    if (!trimmed) return null;

    const user = await this.prisma.user.findFirst({
      where: {
        id: trimmed,
        organizationId: actor.organizationId,
        deletedAt: null,
        isActive: true,
        branches: { some: { branchId: { in: actor.branchIds } } }
      },
      select: { id: true }
    });

    if (!user) throw new BadRequestException("Invalid assignedToId");
    return user.id;
  }

  private async ensurePatientExists(actor: AuthUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: this.buildPatientWhere(actor, patientId),
      select: { id: true, patientNumber: true, branchId: true, createdAt: true }
    });

    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
  }

  private async ensurePhoneAvailableForStandalonePatient(
    actor: AuthUser,
    normalizedValue: string,
    excludePatientId?: string
  ) {
    const legacyValue = normalizedValue.replace(/^\+/, "");
    const [contactPoint, legacyPatient] = await Promise.all([
      this.prisma.contactPoint.findUnique({
        where: {
          organizationId_type_normalizedValue: {
            organizationId: actor.organizationId,
            type: "PHONE",
            normalizedValue
          }
        },
        include: {
          patientLinks: {
            where: {
              ...(excludePatientId ? { patientId: { not: excludePatientId } } : {}),
              OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
              patient: { deletedAt: null, status: { notIn: ["INACTIVE", "MERGED"] } }
            },
            select: { id: true },
            take: 1
          }
        }
      }),
      this.prisma.patient.findFirst({
        where: {
          organizationId: actor.organizationId,
          deletedAt: null,
          status: { notIn: ["INACTIVE", "MERGED"] },
          ...(excludePatientId ? { id: { not: excludePatientId } } : {}),
          OR: [{ phone: legacyValue }, { alternatePhone: legacyValue }]
        },
        select: { id: true }
      })
    ]);
    if (contactPoint?.patientLinks.length || legacyPatient) {
      throw new ConflictException({
        code: "PHONE_REQUIRES_FAMILY_GROUP",
        message:
          "El teléfono ya pertenece a otra ficha. Usa el flujo de grupo familiar o registra otro número."
      });
    }
  }

  private async findPotentialDuplicates(
    actor: AuthUser,
    fields: { phone?: string | null; email?: string | null; documentNumber?: string | null },
    excludeId?: string
  ) {
    const conditions: Prisma.PatientWhereInput[] = [];

    if (fields.phone?.trim()) {
      conditions.push({ phone: fields.phone.trim() });
    }

    if (fields.email?.trim()) {
      conditions.push({ email: fields.email.toLowerCase().trim() });
    }

    if (fields.documentNumber?.trim()) {
      conditions.push({ documentNumber: fields.documentNumber.trim() });
    }

    if (!conditions.length) return [];

    return this.prisma.patient.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: conditions
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        documentNumber: true,
        createdAt: true,
        status: true
      },
      take: 10,
      orderBy: { createdAt: "desc" }
    });
  }

  private async ensureNoExactPatientDuplicate(
    actor: AuthUser,
    fields: { firstName?: string; lastName?: string; phone?: string | null; email?: string | null },
    excludeId?: string
  ) {
    const identity = this.normalizeExactPatientIdentity(fields);
    if (!identity) return;

    const candidates = await this.prisma.patient.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        deletedAt: null,
        status: { not: "INACTIVE" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [{ phone: identity.phone }, { email: identity.email }]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true
      },
      take: 25,
      orderBy: { createdAt: "desc" }
    });

    const duplicate = candidates.find((candidate) => {
      const candidateIdentity = this.normalizeExactPatientIdentity(candidate);
      if (!candidateIdentity) return false;
      return (
        candidateIdentity.firstName === identity.firstName &&
        candidateIdentity.lastName === identity.lastName &&
        candidateIdentity.phone === identity.phone &&
        candidateIdentity.email === identity.email
      );
    });

    if (duplicate) {
      throw new ConflictException({
        message: EXACT_PATIENT_DUPLICATE_MESSAGE,
        duplicatePatientId: duplicate.id
      });
    }
  }

  private normalizeExactPatientIdentity(fields: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
  }) {
    const firstName = this.normalizeIdentityText(fields.firstName);
    const lastName = this.normalizeIdentityText(fields.lastName);
    const phone = this.normalizePhoneForStorage(fields.phone);
    const email = this.normalizeEmail(fields.email);

    if (!firstName || !lastName || !phone || !email) return null;

    return { firstName, lastName, phone, email };
  }

  private normalizeDisplayName(value?: string | null) {
    return (value ?? "").trim().replace(/\s+/g, " ");
  }

  private normalizeIdentityText(value?: string | null) {
    return this.normalizeDisplayName(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  private normalizeEmail(value?: string | null) {
    return (value ?? "").trim().toLowerCase();
  }

  private normalizePhoneForStorage(value?: string | null) {
    return (value ?? "").replace(/\D/g, "");
  }

  private phoneForParsing(value?: string | null) {
    const digits = this.normalizePhoneForStorage(value);
    if (!digits) return undefined;
    return digits.length > 10 ? `+${digits}` : digits;
  }

  private validateBirthDate(value?: string | null) {
    if (!value) return;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Fecha de nacimiento inválida");
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date > today) throw new BadRequestException("La fecha de nacimiento no puede estar en el futuro");
  }

  private uniqueUsers(
    rows: Array<{
      branch: { name: string };
      user: { id: string; firstName: string; lastName: string; email: string };
    }>
  ) {
    const users = new Map<string, { id: string; name: string; email: string; branchName: string }>();
    for (const row of rows) {
      if (users.has(row.user.id)) continue;
      users.set(row.user.id, {
        id: row.user.id,
        name: `${row.user.firstName} ${row.user.lastName}`,
        email: row.user.email,
        branchName: row.branch.name
      });
    }
    return [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }
}
