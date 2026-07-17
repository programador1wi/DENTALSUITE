import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PhotographicFrequency,
  PhotographicImageStatus,
  PhotographicLinkedEntityType,
  PhotographicSessionStatus,
  PhotographicSessionType,
  PhotographicUploadSessionStatus,
  Prisma
} from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { AuthUser } from "../../common/types/auth-user";
import { assertBranchAccess } from "../../common/utils/branch-scope.util";
import { PrismaService } from "../../database/prisma.service";
import {
  CreatePhotographicLinkDto,
  CreatePhotographicSessionDto,
  DismissPhotographicReminderDto,
  UpdatePhotographicPolicyDto,
  UpdatePhotographicSessionDto,
  UpdatePhotographicSlotDto,
  UpdatePhotographicTransformationsDto,
  UploadPhotographicImageDto,
  VoidPhotographicRecordDto
} from "./dto/photographic-templates.dto";
import {
  PhotographicImageStorage,
  PreparedPhotographicImage,
  StoredPhotographicFile
} from "./photographic-image.storage";

type UploadedImage = { originalname: string; mimetype?: string; size: number; buffer?: Buffer };

const CLOSED_PLAN_STATUSES = new Set(["COMPLETED", "CANCELLED", "REJECTED"]);
const ACTIVE_IMAGE_STATUSES: PhotographicImageStatus[] = [
  PhotographicImageStatus.PENDING,
  PhotographicImageStatus.UPLOADING,
  PhotographicImageStatus.PROCESSING,
  PhotographicImageStatus.READY,
  PhotographicImageStatus.ERROR
];

const DEFAULT_SLOTS = [
  ["FACIAL_FRONT_REST", "Frontal en reposo", "FACIAL", 1, 1, 1, "PORTRAIT"],
  ["FACIAL_FRONT_SMILE", "Frontal sonriendo", "FACIAL", 2, 1, 2, "PORTRAIT"],
  ["FACIAL_PROFILE_RIGHT", "Perfil derecho", "FACIAL", 3, 1, 3, "PORTRAIT"],
  ["FACIAL_PROFILE_LEFT_OR_THREE_QUARTER", "Perfil izquierdo / tres cuartos", "FACIAL", 4, 1, 4, "PORTRAIT"],
  ["INTRAORAL_FRONT", "Intraoral frontal", "INTRAORAL", 5, 2, 1, "LANDSCAPE"],
  ["INTRAORAL_RIGHT", "Intraoral lateral derecha", "INTRAORAL", 6, 2, 2, "LANDSCAPE"],
  ["INTRAORAL_LEFT", "Intraoral lateral izquierda", "INTRAORAL", 7, 2, 3, "LANDSCAPE"],
  ["OCCLUSAL_UPPER", "Oclusal superior", "INTRAORAL", 8, 3, 1, "LANDSCAPE"],
  ["OCCLUSAL_LOWER", "Oclusal inferior", "INTRAORAL", 9, 3, 2, "LANDSCAPE"],
  ["INTRAORAL_ADDITIONAL", "Intraoral adicional", "INTRAORAL", 10, 3, 3, "LANDSCAPE"]
] as const;

const SESSION_INCLUDE = {
  images: {
    where: { voidedAt: null, status: { in: ACTIVE_IMAGE_STATUSES } },
    include: {
      slot: true,
      originalFile: true,
      previewFile: true,
      thumbnailFile: true,
      editedFile: true
    },
    orderBy: { slot: { sortOrder: "asc" as const } }
  },
  links: { where: { removedAt: null }, orderBy: { createdAt: "asc" as const } }
} satisfies Prisma.PhotographicSessionInclude;

@Injectable()
export class PhotographicTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PhotographicImageStorage,
    private readonly config: ConfigService
  ) {}

  async list(actor: AuthUser, treatmentPlanId: string, includeVoided = false) {
    if (
      includeVoided &&
      !actor.permissions.includes("photographic_templates.view_voided") &&
      !actor.permissions.includes("system.manage_all")
    ) {
      throw new ForbiddenException("Viewing voided photographic sessions requires an additional permission");
    }
    const plan = await this.ensurePlan(actor, treatmentPlanId);
    const slots = await this.ensureDefaultSlots(actor.organizationId);
    await this.importLegacyFiles(actor, plan, slots.find((slot) => slot.code === "UNCLASSIFIED")!);
    const sessions = await this.prisma.photographicSession.findMany({
      where: {
        treatmentPlanId,
        organizationId: actor.organizationId,
        patientId: plan.patientId,
        ...(!includeVoided ? { status: { not: PhotographicSessionStatus.VOIDED } } : {})
      },
      include: SESSION_INCLUDE,
      orderBy: [{ clinicalDate: "asc" }, { createdAt: "asc" }]
    });
    const policy = await this.prisma.photographicPolicy.findUnique({ where: { treatmentPlanId } });
    return {
      slots: slots.filter((slot) => slot.code !== "UNCLASSIFIED"),
      unclassifiedSlot: slots.find((slot) => slot.code === "UNCLASSIFIED"),
      sessions,
      policy: policy ?? {
        treatmentPlanId,
        frequency: PhotographicFrequency.NONE,
        customIntervalDays: null,
        reminderDismissedAt: null
      },
      reminder: await this.buildReminder(plan, sessions, policy)
    };
  }

  async get(actor: AuthUser, sessionId: string) {
    const session = await this.ensureSession(actor, sessionId);
    return this.prisma.photographicSession.findUniqueOrThrow({
      where: { id: session.id },
      include: SESSION_INCLUDE
    });
  }

  async getFileContent(actor: AuthUser, fileId: string) {
    const file = await this.prisma.fileAttachment.findFirst({
      where: { id: fileId, organizationId: actor.organizationId, deletedAt: null },
      include: {
        photographicOriginalImage: { include: { session: true } },
        photographicPreviewImage: { include: { session: true } },
        photographicThumbnailImage: { include: { session: true } },
        photographicEditedImage: { include: { session: true } }
      }
    });
    const image =
      file?.photographicOriginalImage ??
      file?.photographicPreviewImage ??
      file?.photographicThumbnailImage ??
      file?.photographicEditedImage;
    if (!file?.patientId || !image || !actor.branchIds.includes(image.session.branchId)) {
      throw new NotFoundException("Photographic file not found");
    }
    const stream = await this.storage.open(actor.organizationId, file.patientId, file.fileName);
    await this.audit(this.prisma, actor, image.session, "access_photographic_file", undefined, {
      fileAttachmentId: file.id,
      imageId: image.id,
      category: file.category
    });
    return { stream, mimeType: file.mimeType, downloadName: file.originalName };
  }

  async compare(actor: AuthUser, sessionId: string, otherSessionId: string) {
    const [left, right] = await Promise.all([this.get(actor, sessionId), this.get(actor, otherSessionId)]);
    if (left.treatmentPlanId !== right.treatmentPlanId || left.patientId !== right.patientId) {
      throw new BadRequestException("Only sessions from the same patient and treatment plan can be compared");
    }
    await this.audit(this.prisma, actor, left, "compare_photographic_sessions", undefined, {
      leftSessionId: left.id,
      rightSessionId: right.id
    });
    return { left, right };
  }

  async updateSlot(actor: AuthUser, slotId: string, dto: UpdatePhotographicSlotDto) {
    const slot = await this.prisma.photographicSlot.findFirst({
      where: { id: slotId, organizationId: actor.organizationId, code: { not: "UNCLASSIFIED" } }
    });
    if (!slot) throw new NotFoundException("Photographic position not found");
    const changed = await this.prisma.photographicSlot.updateMany({
      where: { id: slot.id, version: dto.version },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.group !== undefined ? { group: dto.group.trim() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.rowNumber !== undefined ? { rowNumber: dto.rowNumber } : {}),
        ...(dto.columnNumber !== undefined ? { columnNumber: dto.columnNumber } : {}),
        ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}),
        ...(dto.recommendedOrientation !== undefined
          ? { recommendedOrientation: dto.recommendedOrientation?.trim() || null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        version: { increment: 1 }
      }
    });
    if (!changed.count) throw new ConflictException("Photographic position was modified by another user");
    const updated = await this.prisma.photographicSlot.findUniqueOrThrow({ where: { id: slot.id } });
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        actorUserId: actor.id,
        entity: "PhotographicSlot",
        entityId: slot.id,
        action: "update_photographic_slot",
        before: this.json(slot),
        after: this.json({ value: updated, correlationId: randomUUID() })
      }
    });
    return updated;
  }

  async availableLinks(actor: AuthUser, treatmentPlanId: string) {
    const plan = await this.ensurePlan(actor, treatmentPlanId);
    const [appointments, controls, evolutions] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { organizationId: actor.organizationId, patientId: plan.patientId, treatmentPlanId },
        select: { id: true, startAt: true, status: true, professionalId: true },
        orderBy: { startAt: "desc" },
        take: 100
      }),
      this.prisma.orthodonticControl.findMany({
        where: { organizationId: actor.organizationId, patientId: plan.patientId, treatmentPlanId },
        select: { id: true, sequenceNumber: true, clinicalDate: true, status: true, professionalId: true },
        orderBy: { clinicalDate: "desc" },
        take: 100
      }),
      this.prisma.clinicalEvolution.findMany({
        where: { patientId: plan.patientId, treatmentPlanId, branchId: { in: actor.branchIds } },
        select: {
          id: true,
          createdAt: true,
          signedAt: true,
          annulledAt: true,
          professionalId: true,
          notes: true
        },
        orderBy: { createdAt: "desc" },
        take: 100
      })
    ]);
    return { appointments, controls, evolutions };
  }

  async create(
    actor: AuthUser,
    treatmentPlanId: string,
    dto: CreatePhotographicSessionDto,
    idempotencyKey?: string
  ) {
    const plan = await this.ensureMutablePlan(actor, treatmentPlanId);
    const branchId = dto.branchId ?? plan.branchId;
    const professionalId = dto.professionalId ?? plan.professionalId;
    assertBranchAccess(actor, branchId);
    await this.ensureProfessional(actor.organizationId, professionalId);
    if (idempotencyKey) {
      const existing = await this.prisma.photographicSession.findUnique({
        where: { idempotencyKey },
        include: SESSION_INCLUDE
      });
      if (existing) {
        if (
          existing.treatmentPlanId !== treatmentPlanId ||
          existing.organizationId !== actor.organizationId
        ) {
          throw new ConflictException("Idempotency key already belongs to another photographic session");
        }
        return existing;
      }
    }
    for (const link of dto.links ?? []) await this.validateLink(actor, plan, link);
    const sessionType = dto.sessionType ?? PhotographicSessionType.FOLLOW_UP;
    const name = dto.name?.trim() || (await this.nextSessionName(treatmentPlanId, sessionType));

    const created = await this.prisma.$transaction(
      async (tx) => {
        const session = await tx.photographicSession.create({
          data: {
            organizationId: actor.organizationId,
            patientId: plan.patientId,
            treatmentPlanId,
            branchId,
            professionalId,
            name,
            sessionType,
            clinicalDate: this.dateOnly(dto.clinicalDate),
            notes: dto.notes?.trim() || null,
            createdById: actor.id,
            updatedById: actor.id,
            idempotencyKey: idempotencyKey?.trim() || null,
            links: dto.links?.length
              ? {
                  create: dto.links.map((link) => ({
                    linkedEntityType: link.linkedEntityType,
                    linkedEntityId: link.linkedEntityId,
                    relationshipType: link.relationshipType?.trim() || "CLINICAL_CONTEXT",
                    createdById: actor.id
                  }))
                }
              : undefined
          },
          include: SESSION_INCLUDE
        });
        await this.audit(tx, actor, session, "create_photographic_session", undefined, session);
        return session;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return created;
  }

  async update(actor: AuthUser, sessionId: string, dto: UpdatePhotographicSessionDto) {
    const session = await this.ensureMutableSession(actor, sessionId);
    const branchId = dto.branchId ?? session.branchId;
    const professionalId = dto.professionalId ?? session.professionalId;
    assertBranchAccess(actor, branchId);
    await this.ensureProfessional(actor.organizationId, professionalId);
    const result = await this.prisma.photographicSession.updateMany({
      where: { id: session.id, version: dto.version },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.sessionType !== undefined ? { sessionType: dto.sessionType } : {}),
        ...(dto.clinicalDate !== undefined ? { clinicalDate: this.dateOnly(dto.clinicalDate) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        branchId,
        professionalId,
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    if (!result.count) throw new ConflictException("Photographic session was modified by another user");
    const updated = await this.get(actor, session.id);
    await this.audit(this.prisma, actor, session, "update_photographic_session", session, updated);
    return updated;
  }

  async complete(actor: AuthUser, sessionId: string, version: number) {
    const session = await this.ensureMutableSession(actor, sessionId);
    const [requiredCount, readyCount] = await Promise.all([
      this.prisma.photographicSlot.count({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
          isRequired: true,
          code: { not: "UNCLASSIFIED" }
        }
      }),
      this.prisma.photographicSessionImage.count({
        where: {
          sessionId,
          voidedAt: null,
          status: PhotographicImageStatus.READY,
          slot: { isRequired: true, isActive: true, code: { not: "UNCLASSIFIED" } }
        }
      })
    ]);
    if (!requiredCount || readyCount < requiredCount) {
      throw new BadRequestException(
        `Template requires ${requiredCount} ready positions and currently has ${readyCount}`
      );
    }
    const result = await this.prisma.photographicSession.updateMany({
      where: { id: session.id, version },
      data: {
        status: PhotographicSessionStatus.COMPLETE,
        completedAt: new Date(),
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    if (!result.count) throw new ConflictException("Photographic session was modified by another user");
    const updated = await this.get(actor, sessionId);
    await this.audit(this.prisma, actor, session, "complete_photographic_session", session, updated);
    return updated;
  }

  async voidSession(actor: AuthUser, sessionId: string, dto: VoidPhotographicRecordDto) {
    const session = await this.ensureMutableSession(actor, sessionId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.photographicSession.updateMany({
        where: { id: session.id, version: dto.version },
        data: {
          status: PhotographicSessionStatus.VOIDED,
          voidedAt: new Date(),
          voidedById: actor.id,
          voidReason: dto.reason.trim(),
          updatedById: actor.id,
          version: { increment: 1 }
        }
      });
      if (!changed.count) throw new ConflictException("Photographic session was modified by another user");
      await tx.photographicSessionImage.updateMany({
        where: { sessionId, voidedAt: null },
        data: {
          status: PhotographicImageStatus.VOIDED,
          voidedAt: new Date(),
          voidedById: actor.id,
          voidReason: dto.reason.trim(),
          version: { increment: 1 }
        }
      });
      const row = await tx.photographicSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: SESSION_INCLUDE
      });
      await this.audit(tx, actor, row, "void_photographic_session", session, row, dto.reason);
      return row;
    });
    return updated;
  }

  async uploadInitialImage(
    actor: AuthUser,
    treatmentPlanId: string,
    dto: UploadPhotographicImageDto,
    file?: UploadedImage
  ) {
    const plan = await this.ensureMutablePlan(actor, treatmentPlanId);
    const existing = await this.prisma.photographicSession.count({
      where: { treatmentPlanId, status: { not: PhotographicSessionStatus.VOIDED } }
    });
    if (existing)
      throw new ConflictException(
        "Plan already has a photographic session; upload into the selected session"
      );
    await this.ensureDefaultSlots(actor.organizationId);
    const slot = await this.ensureSlot(actor.organizationId, dto.slotId);
    const prepared = await this.storage.prepareAndStore({
      organizationId: actor.organizationId,
      patientId: plan.patientId,
      originalName: file?.originalname ?? "clinical-photo",
      declaredMimeType: file?.mimetype,
      buffer: file?.buffer
    });
    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          const race = await tx.photographicSession.count({
            where: { treatmentPlanId, status: { not: PhotographicSessionStatus.VOIDED } }
          });
          if (race) throw new ConflictException("Another user created the initial photographic session");
          const session = await tx.photographicSession.create({
            data: {
              organizationId: actor.organizationId,
              patientId: plan.patientId,
              treatmentPlanId,
              branchId: plan.branchId,
              professionalId: plan.professionalId,
              name: "Inicial",
              sessionType: PhotographicSessionType.INITIAL,
              clinicalDate: this.dateOnly(new Date().toISOString()),
              createdById: actor.id,
              updatedById: actor.id
            }
          });
          await this.createPreparedImage(tx, actor.id, session, slot.id, prepared);
          await this.audit(tx, actor, session, "create_initial_photographic_image", undefined, {
            sessionId: session.id,
            slotId: slot.id,
            checksum: prepared.checksum
          });
          return session;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      return this.get(actor, created.id);
    } catch (error) {
      await this.storage.cleanup([prepared.original, prepared.preview, prepared.thumbnail]);
      throw error;
    }
  }

  async uploadImage(
    actor: AuthUser,
    sessionId: string,
    dto: UploadPhotographicImageDto,
    file?: UploadedImage
  ) {
    const session = await this.ensureMutableSession(actor, sessionId);
    const slot = await this.ensureSlot(actor.organizationId, dto.slotId);
    const prepared = await this.storage.prepareAndStore({
      organizationId: actor.organizationId,
      patientId: session.patientId,
      originalName: file?.originalname ?? "clinical-photo",
      declaredMimeType: file?.mimetype,
      buffer: file?.buffer
    });
    try {
      const duplicate = await this.prisma.photographicSessionImage.findFirst({
        where: {
          sessionId,
          checksum: prepared.checksum,
          voidedAt: null,
          status: { in: ACTIVE_IMAGE_STATUSES }
        }
      });
      if (duplicate) throw new ConflictException("The same image is already present in this template");
      const saved = await this.prisma.$transaction(
        async (tx) => {
          const active = await tx.photographicSessionImage.findFirst({
            where: { sessionId, slotId: slot.id, voidedAt: null, status: { in: ACTIVE_IMAGE_STATUSES } }
          });
          if (active && active.id !== dto.replaceImageId) {
            throw new ConflictException("Position already has an active image; use replace");
          }
          if (
            active &&
            !actor.permissions.includes("photographic_photos.replace") &&
            !actor.permissions.includes("system.manage_all")
          ) {
            throw new ForbiddenException("Replacing a photographic image requires an additional permission");
          }
          if (active && dto.expectedVersion && active.version !== dto.expectedVersion) {
            throw new ConflictException("Image was modified by another user");
          }
          if (active) {
            await tx.photographicSessionImage.update({
              where: { id: active.id },
              data: { status: PhotographicImageStatus.REPLACED, version: { increment: 1 } }
            });
          }
          const image = await this.createPreparedImage(tx, actor.id, session, slot.id, prepared, active?.id);
          await this.recalculateStatus(tx, session.id, actor.id);
          await this.audit(
            tx,
            actor,
            session,
            active ? "replace_photographic_image" : "upload_photographic_image",
            active,
            image
          );
          return image;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      return saved;
    } catch (error) {
      await this.storage.cleanup([prepared.original, prepared.preview, prepared.thumbnail]);
      throw error;
    }
  }

  async updateTransformations(actor: AuthUser, imageId: string, dto: UpdatePhotographicTransformationsDto) {
    const image = await this.ensureImage(actor, imageId);
    const edited = await this.storage.storeEdited({
      organizationId: actor.organizationId,
      patientId: image.session.patientId,
      originalFileName: image.originalFile.fileName,
      originalName: image.originalFile.originalName,
      transformations: {
        rotation: dto.rotation,
        cropX: dto.cropX,
        cropY: dto.cropY,
        cropWidth: dto.cropWidth,
        cropHeight: dto.cropHeight,
        zoom: dto.zoom,
        brightness: dto.brightness,
        contrast: dto.contrast
      }
    });
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const editedFile = await tx.fileAttachment.create({
          data: this.fileData(actor.id, image.session, edited)
        });
        const result = await tx.photographicSessionImage.updateMany({
          where: {
            id: image.id,
            version: dto.version,
            voidedAt: null,
            status: PhotographicImageStatus.READY
          },
          data: {
            editedFileId: editedFile.id,
            transformationsJson: this.json(dto),
            version: { increment: 1 }
          }
        });
        if (!result.count) throw new ConflictException("Image was modified by another user");
        const row = await tx.photographicSessionImage.findUniqueOrThrow({
          where: { id: image.id },
          include: { editedFile: true }
        });
        await this.audit(tx, actor, image.session, "edit_photographic_image", image.transformationsJson, dto);
        return row;
      });
      return updated;
    } catch (error) {
      await this.storage.cleanup([edited]);
      throw error;
    }
  }

  async voidImage(actor: AuthUser, imageId: string, dto: VoidPhotographicRecordDto) {
    const image = await this.ensureImage(actor, imageId);
    const result = await this.prisma.photographicSessionImage.updateMany({
      where: { id: image.id, version: dto.version, voidedAt: null },
      data: {
        status: PhotographicImageStatus.VOIDED,
        voidedAt: new Date(),
        voidedById: actor.id,
        voidReason: dto.reason.trim(),
        version: { increment: 1 }
      }
    });
    if (!result.count) throw new ConflictException("Image was modified by another user");
    await this.recalculateStatus(this.prisma, image.sessionId, actor.id);
    await this.audit(
      this.prisma,
      actor,
      image.session,
      "void_photographic_image",
      image,
      { reason: dto.reason },
      dto.reason
    );
    return this.get(actor, image.sessionId);
  }

  async createLink(actor: AuthUser, sessionId: string, dto: CreatePhotographicLinkDto) {
    const session = await this.ensureMutableSession(actor, sessionId);
    const plan = await this.ensureMutablePlan(actor, session.treatmentPlanId);
    await this.validateLink(actor, plan, dto);
    const existing = await this.prisma.photographicSessionLink.findFirst({
      where: {
        sessionId,
        linkedEntityType: dto.linkedEntityType,
        linkedEntityId: dto.linkedEntityId,
        removedAt: null
      }
    });
    if (existing) return existing;
    const created = await this.prisma.photographicSessionLink.create({
      data: {
        sessionId,
        linkedEntityType: dto.linkedEntityType,
        linkedEntityId: dto.linkedEntityId,
        relationshipType: dto.relationshipType?.trim() || "CLINICAL_CONTEXT",
        createdById: actor.id
      }
    });
    await this.audit(this.prisma, actor, session, "link_photographic_session", undefined, created);
    return created;
  }

  async removeLink(actor: AuthUser, linkId: string, reason: string) {
    const link = await this.prisma.photographicSessionLink.findFirst({
      where: {
        id: linkId,
        removedAt: null,
        session: { organizationId: actor.organizationId, branchId: { in: actor.branchIds } }
      },
      include: { session: true }
    });
    if (!link) throw new NotFoundException("Photographic link not found");
    await this.ensureMutablePlan(actor, link.session.treatmentPlanId);
    const updated = await this.prisma.photographicSessionLink.update({
      where: { id: link.id },
      data: { removedAt: new Date(), removedById: actor.id, removalReason: reason.trim() }
    });
    await this.audit(this.prisma, actor, link.session, "unlink_photographic_session", link, updated, reason);
    return updated;
  }

  async updatePolicy(actor: AuthUser, treatmentPlanId: string, dto: UpdatePhotographicPolicyDto) {
    const plan = await this.ensureMutablePlan(actor, treatmentPlanId);
    if (dto.frequency === PhotographicFrequency.CUSTOM && !dto.customIntervalDays) {
      throw new BadRequestException("Custom photographic frequency requires an interval in days");
    }
    const policy = await this.prisma.photographicPolicy.upsert({
      where: { treatmentPlanId },
      create: {
        organizationId: actor.organizationId,
        treatmentPlanId,
        frequency: dto.frequency,
        customIntervalDays: dto.frequency === PhotographicFrequency.CUSTOM ? dto.customIntervalDays : null,
        updatedById: actor.id
      },
      update: {
        frequency: dto.frequency,
        customIntervalDays: dto.frequency === PhotographicFrequency.CUSTOM ? dto.customIntervalDays : null,
        reminderDismissedAt: null,
        updatedById: actor.id
      }
    });
    await this.audit(this.prisma, actor, plan, "update_photographic_policy", undefined, policy);
    return policy;
  }

  async dismissReminder(actor: AuthUser, treatmentPlanId: string, dto: DismissPhotographicReminderDto) {
    await this.ensurePlan(actor, treatmentPlanId);
    return this.prisma.photographicPolicy.upsert({
      where: { treatmentPlanId },
      create: {
        organizationId: actor.organizationId,
        treatmentPlanId,
        frequency: PhotographicFrequency.NONE,
        reminderDismissedAt: dto.until ? new Date(dto.until) : new Date(),
        updatedById: actor.id
      },
      update: { reminderDismissedAt: dto.until ? new Date(dto.until) : new Date(), updatedById: actor.id }
    });
  }

  async createMobileUpload(actor: AuthUser, sessionId: string) {
    const session = await this.ensureMutableSession(actor, sessionId);
    const invitationToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.photographicUploadSession.updateMany({
        where: {
          photographicSessionId: sessionId,
          status: { in: [PhotographicUploadSessionStatus.ACTIVE, PhotographicUploadSessionStatus.CLAIMED] }
        },
        data: { status: PhotographicUploadSessionStatus.REVOKED, revokedAt: new Date() }
      });
      const upload = await tx.photographicUploadSession.create({
        data: {
          photographicSessionId: sessionId,
          tokenHash: this.tokenHash(invitationToken),
          expiresAt,
          createdById: actor.id
        }
      });
      await this.audit(tx, actor, session, "create_mobile_photographic_upload", undefined, {
        uploadSessionId: upload.id,
        expiresAt
      });
    });
    const baseUrl = (
      this.config.get<string>("WEB_APP_URL") ||
      this.config.get<string>("FRONTEND_URL") ||
      "http://localhost:5173"
    ).replace(/\/$/, "");
    return { uploadUrl: `${baseUrl}/mobile/photographic-upload/${invitationToken}`, expiresAt };
  }

  async claimMobileUpload(token: string) {
    const tokenHash = this.tokenHash(token);
    const upload = await this.prisma.photographicUploadSession.findUnique({
      where: { tokenHash },
      include: { photographicSession: true }
    });
    if (
      !upload ||
      upload.status === PhotographicUploadSessionStatus.REVOKED ||
      upload.status === PhotographicUploadSessionStatus.COMPLETED
    ) {
      throw new NotFoundException("Mobile upload invitation is not available");
    }
    if (upload.expiresAt <= new Date()) {
      await this.prisma.photographicUploadSession.update({
        where: { id: upload.id },
        data: { status: PhotographicUploadSessionStatus.EXPIRED }
      });
      throw new BadRequestException("Mobile upload invitation expired");
    }
    let uploadToken = token;
    if (upload.status === PhotographicUploadSessionStatus.ACTIVE) {
      uploadToken = randomBytes(32).toString("base64url");
      await this.prisma.photographicUploadSession.update({
        where: { id: upload.id },
        data: {
          tokenHash: this.tokenHash(uploadToken),
          status: PhotographicUploadSessionStatus.CLAIMED,
          claimedAt: new Date()
        }
      });
    }
    const slots = (await this.ensureDefaultSlots(upload.photographicSession.organizationId)).filter(
      (slot) => slot.code !== "UNCLASSIFIED"
    );
    return {
      uploadToken,
      expiresAt: upload.expiresAt,
      session: {
        id: upload.photographicSession.id,
        name: upload.photographicSession.name,
        clinicalDate: upload.photographicSession.clinicalDate
      },
      slots
    };
  }

  async uploadMobileImage(token: string, dto: UploadPhotographicImageDto, file?: UploadedImage) {
    const upload = await this.ensureClaimedMobileUpload(token);
    const session = upload.photographicSession;
    const slot = await this.ensureSlot(session.organizationId, dto.slotId);
    const prepared = await this.storage.prepareAndStore({
      organizationId: session.organizationId,
      patientId: session.patientId,
      originalName: file?.originalname ?? "mobile-clinical-photo",
      declaredMimeType: file?.mimetype,
      buffer: file?.buffer
    });
    try {
      const image = await this.prisma.$transaction(
        async (tx) => {
          const active = await tx.photographicSessionImage.findFirst({
            where: {
              sessionId: session.id,
              slotId: slot.id,
              voidedAt: null,
              status: { in: ACTIVE_IMAGE_STATUSES }
            }
          });
          if (active && active.id !== dto.replaceImageId)
            throw new ConflictException("Position already contains an image");
          if (active)
            await tx.photographicSessionImage.update({
              where: { id: active.id },
              data: { status: PhotographicImageStatus.REPLACED, version: { increment: 1 } }
            });
          const saved = await this.createPreparedImage(
            tx,
            upload.createdById,
            session,
            slot.id,
            prepared,
            active?.id
          );
          await this.recalculateStatus(tx, session.id, upload.createdById);
          await tx.photographicUploadSession.update({
            where: { id: upload.id },
            data: { usedAt: new Date() }
          });
          await tx.auditLog.create({
            data: {
              organizationId: session.organizationId,
              userId: upload.createdById,
              actorUserId: upload.createdById,
              entity: "PhotographicSessionImage",
              entityId: saved.id,
              action: "mobile_upload_photographic_image",
              after: this.json({
                sessionId: session.id,
                patientId: session.patientId,
                treatmentPlanId: session.treatmentPlanId,
                slotId: slot.id,
                correlationId: randomUUID()
              })
            }
          });
          return saved;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      return image;
    } catch (error) {
      await this.storage.cleanup([prepared.original, prepared.preview, prepared.thumbnail]);
      throw error;
    }
  }

  async completeMobileUpload(token: string) {
    const upload = await this.ensureClaimedMobileUpload(token);
    await this.prisma.photographicUploadSession.update({
      where: { id: upload.id },
      data: { status: PhotographicUploadSessionStatus.COMPLETED, usedAt: new Date() }
    });
    return { completed: true };
  }

  private async createPreparedImage(
    tx: Prisma.TransactionClient,
    uploadedById: string,
    session: { id: string; organizationId: string; patientId: string; treatmentPlanId: string },
    slotId: string,
    prepared: PreparedPhotographicImage,
    replacedImageId?: string
  ) {
    const [originalFile, previewFile, thumbnailFile] = await Promise.all([
      tx.fileAttachment.create({ data: this.fileData(uploadedById, session, prepared.original) }),
      tx.fileAttachment.create({ data: this.fileData(uploadedById, session, prepared.preview) }),
      tx.fileAttachment.create({ data: this.fileData(uploadedById, session, prepared.thumbnail) })
    ]);
    return tx.photographicSessionImage.create({
      data: {
        sessionId: session.id,
        slotId,
        originalFileId: originalFile.id,
        previewFileId: previewFile.id,
        thumbnailFileId: thumbnailFile.id,
        checksum: prepared.checksum,
        mimeType: prepared.mimeType,
        width: prepared.width,
        height: prepared.height,
        status: PhotographicImageStatus.READY,
        uploadedById,
        replacedImageId
      },
      include: { slot: true, originalFile: true, previewFile: true, thumbnailFile: true, editedFile: true }
    });
  }

  private fileData(
    uploadedById: string,
    session: { organizationId: string; patientId: string; treatmentPlanId: string },
    file: StoredPhotographicFile
  ) {
    return {
      id: file.id,
      organizationId: session.organizationId,
      patientId: session.patientId,
      treatmentPlanId: session.treatmentPlanId,
      uploadedById,
      fileName: file.fileName,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      url: file.url,
      category: file.category
    } satisfies Prisma.FileAttachmentUncheckedCreateInput;
  }

  private async recalculateStatus(
    tx: Prisma.TransactionClient | PrismaService,
    sessionId: string,
    actorId: string
  ) {
    const session = await tx.photographicSession.findUnique({ where: { id: sessionId } });
    if (
      !session ||
      session.status === PhotographicSessionStatus.VOIDED ||
      session.status === PhotographicSessionStatus.ARCHIVED
    )
      return;
    const [required, ready] = await Promise.all([
      tx.photographicSlot.count({
        where: {
          organizationId: session.organizationId,
          isRequired: true,
          isActive: true,
          code: { not: "UNCLASSIFIED" }
        }
      }),
      tx.photographicSessionImage.count({
        where: {
          sessionId,
          status: PhotographicImageStatus.READY,
          voidedAt: null,
          slot: { isRequired: true, isActive: true, code: { not: "UNCLASSIFIED" } }
        }
      })
    ]);
    const isComplete = required > 0 && ready >= required;
    await tx.photographicSession.update({
      where: { id: sessionId },
      data: {
        status: isComplete ? PhotographicSessionStatus.COMPLETE : PhotographicSessionStatus.INCOMPLETE,
        completedAt: isComplete ? (session.completedAt ?? new Date()) : null,
        updatedById: actorId,
        version: { increment: 1 }
      }
    });
  }

  private async ensureDefaultSlots(organizationId: string) {
    await this.prisma.$transaction(
      DEFAULT_SLOTS.map(([code, label, group, sortOrder, rowNumber, columnNumber, orientation]) =>
        this.prisma.photographicSlot.upsert({
          where: { organizationId_code: { organizationId, code } },
          create: {
            organizationId,
            code,
            label,
            group,
            sortOrder,
            rowNumber,
            columnNumber,
            isRequired: true,
            recommendedOrientation: orientation
          },
          update: {}
        })
      )
    );
    await this.prisma.photographicSlot.upsert({
      where: { organizationId_code: { organizationId, code: "UNCLASSIFIED" } },
      create: {
        organizationId,
        code: "UNCLASSIFIED",
        label: "Pendiente de clasificar",
        group: "UNCLASSIFIED",
        sortOrder: 999,
        rowNumber: 99,
        columnNumber: 1,
        isRequired: false
      },
      update: {}
    });
    return this.prisma.photographicSlot.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: "asc" }
    });
  }

  private async importLegacyFiles(
    actor: AuthUser,
    plan: { id: string; patientId: string; branchId: string; professionalId: string },
    unclassifiedSlot: { id: string }
  ) {
    const files = await this.prisma.fileAttachment.findMany({
      where: {
        organizationId: actor.organizationId,
        patientId: plan.patientId,
        treatmentPlanId: plan.id,
        category: "ORTHODONTIC_PHOTO",
        deletedAt: null,
        photographicOriginalImage: null
      },
      orderBy: { createdAt: "asc" }
    });
    for (const [index, file] of files.entries()) {
      await this.prisma.$transaction(async (tx) => {
        const session = await tx.photographicSession.create({
          data: {
            organizationId: actor.organizationId,
            patientId: plan.patientId,
            treatmentPlanId: plan.id,
            branchId: plan.branchId,
            professionalId: plan.professionalId,
            name: files.length === 1 ? "Importada" : `Importada ${index + 1}`,
            sessionType: PhotographicSessionType.IMPORTED,
            clinicalDate: file.createdAt,
            status: PhotographicSessionStatus.INCOMPLETE,
            notes: "Archivo heredado pendiente de clasificar",
            createdById: file.uploadedById,
            updatedById: actor.id
          }
        });
        await tx.photographicSessionImage.create({
          data: {
            sessionId: session.id,
            slotId: unclassifiedSlot.id,
            originalFileId: file.id,
            checksum: `legacy:${file.id}`,
            mimeType: file.mimeType,
            width: 0,
            height: 0,
            status: PhotographicImageStatus.READY,
            uploadedById: file.uploadedById,
            uploadedAt: file.createdAt
          }
        });
        await this.audit(tx, actor, session, "import_legacy_photographic_file", undefined, {
          fileAttachmentId: file.id
        });
      });
    }
  }

  private async ensurePlan(actor: AuthUser, treatmentPlanId: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: {
        id: treatmentPlanId,
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        kind: "ORTHODONTICS"
      },
      select: {
        id: true,
        organizationId: true,
        patientId: true,
        branchId: true,
        professionalId: true,
        status: true,
        completedAt: true
      }
    });
    if (!plan) throw new NotFoundException("Orthodontic treatment plan not found");
    return plan;
  }

  private async ensureMutablePlan(actor: AuthUser, treatmentPlanId: string) {
    const plan = await this.ensurePlan(actor, treatmentPlanId);
    if (CLOSED_PLAN_STATUSES.has(plan.status))
      throw new ConflictException("Closed treatment plan cannot modify photographic templates");
    return plan;
  }

  private async ensureSession(actor: AuthUser, sessionId: string) {
    const session = await this.prisma.photographicSession.findFirst({
      where: { id: sessionId, organizationId: actor.organizationId, branchId: { in: actor.branchIds } }
    });
    if (!session) throw new NotFoundException("Photographic session not found");
    return session;
  }

  private async ensureMutableSession(actor: AuthUser, sessionId: string) {
    const session = await this.ensureSession(actor, sessionId);
    if (
      session.status === PhotographicSessionStatus.VOIDED ||
      session.status === PhotographicSessionStatus.ARCHIVED
    ) {
      throw new ConflictException("Archived or voided photographic session cannot be modified");
    }
    await this.ensureMutablePlan(actor, session.treatmentPlanId);
    return session;
  }

  private async ensureImage(actor: AuthUser, imageId: string) {
    const image = await this.prisma.photographicSessionImage.findFirst({
      where: {
        id: imageId,
        voidedAt: null,
        session: { organizationId: actor.organizationId, branchId: { in: actor.branchIds } }
      },
      include: { session: true, originalFile: true }
    });
    if (!image) throw new NotFoundException("Photographic image not found");
    await this.ensureMutablePlan(actor, image.session.treatmentPlanId);
    return image;
  }

  private async ensureSlot(organizationId: string, slotId: string) {
    const slot = await this.prisma.photographicSlot.findFirst({
      where: { id: slotId, organizationId, isActive: true }
    });
    if (!slot || slot.code === "UNCLASSIFIED")
      throw new NotFoundException("Active photographic position not found");
    return slot;
  }

  private async ensureProfessional(organizationId: string, professionalId: string) {
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, organizationId, isActive: true }
    });
    if (!professional) throw new BadRequestException("Professional is not active in this organization");
  }

  private async validateLink(
    actor: AuthUser,
    plan: { id: string; patientId: string },
    link: CreatePhotographicLinkDto
  ) {
    let exists = false;
    if (link.linkedEntityType === PhotographicLinkedEntityType.APPOINTMENT) {
      exists = Boolean(
        await this.prisma.appointment.findFirst({
          where: {
            id: link.linkedEntityId,
            organizationId: actor.organizationId,
            patientId: plan.patientId,
            treatmentPlanId: plan.id,
            branchId: { in: actor.branchIds }
          },
          select: { id: true }
        })
      );
    } else if (link.linkedEntityType === PhotographicLinkedEntityType.ORTHODONTIC_CONTROL) {
      exists = Boolean(
        await this.prisma.orthodonticControl.findFirst({
          where: {
            id: link.linkedEntityId,
            organizationId: actor.organizationId,
            patientId: plan.patientId,
            treatmentPlanId: plan.id,
            branchId: { in: actor.branchIds }
          },
          select: { id: true }
        })
      );
    } else {
      exists = Boolean(
        await this.prisma.clinicalEvolution.findFirst({
          where: {
            id: link.linkedEntityId,
            patientId: plan.patientId,
            treatmentPlanId: plan.id,
            branchId: { in: actor.branchIds }
          },
          select: { id: true }
        })
      );
    }
    if (!exists)
      throw new BadRequestException(
        "Linked clinical entity must belong to the same patient and treatment plan"
      );
  }

  private async ensureClaimedMobileUpload(token: string) {
    const upload = await this.prisma.photographicUploadSession.findUnique({
      where: { tokenHash: this.tokenHash(token) },
      include: { photographicSession: true }
    });
    if (!upload || upload.status !== PhotographicUploadSessionStatus.CLAIMED)
      throw new ForbiddenException("Mobile upload token is invalid");
    if (upload.expiresAt <= new Date()) {
      await this.prisma.photographicUploadSession.update({
        where: { id: upload.id },
        data: { status: PhotographicUploadSessionStatus.EXPIRED }
      });
      throw new ForbiddenException("Mobile upload token expired");
    }
    if (upload.failedAttempts >= 10) throw new ForbiddenException("Mobile upload token is locked");
    return upload;
  }

  private async nextSessionName(treatmentPlanId: string, type: PhotographicSessionType) {
    if (type === PhotographicSessionType.INITIAL) return "Inicial";
    if (type === PhotographicSessionType.FINAL) return "Final";
    const count = await this.prisma.photographicSession.count({
      where: { treatmentPlanId, sessionType: type, status: { not: PhotographicSessionStatus.VOIDED } }
    });
    if (type === PhotographicSessionType.REEVALUATION) return `Reevaluacion ${count + 1}`;
    return `Control ${count + 1}`;
  }

  private async buildReminder(
    plan: { id: string; status: string; completedAt: Date | null },
    sessions: Array<{ sessionType: PhotographicSessionType; clinicalDate: Date }>,
    policy: {
      frequency: PhotographicFrequency;
      customIntervalDays: number | null;
      reminderDismissedAt: Date | null;
    } | null
  ) {
    const frequency = policy?.frequency ?? PhotographicFrequency.NONE;
    if (frequency === PhotographicFrequency.NONE) return null;
    if (policy?.reminderDismissedAt && policy.reminderDismissedAt > new Date()) return null;
    const latest = sessions.at(-1)?.clinicalDate;
    let due = !latest;
    if (frequency === PhotographicFrequency.INITIAL_AND_FINAL) {
      due =
        !sessions.some((session) => session.sessionType === PhotographicSessionType.INITIAL) ||
        (plan.status === "COMPLETED" &&
          !sessions.some((session) => session.sessionType === PhotographicSessionType.FINAL));
    } else if (frequency === PhotographicFrequency.EVERY_CONTROL) {
      const latestControl = await this.prisma.orthodonticControl.findFirst({
        where: { treatmentPlanId: plan.id, status: "COMPLETED" },
        orderBy: { clinicalDate: "desc" },
        select: { clinicalDate: true }
      });
      due = Boolean(latestControl && (!latest || latestControl.clinicalDate > latest));
    } else if (latest) {
      const days =
        frequency === PhotographicFrequency.EVERY_3_MONTHS
          ? 90
          : frequency === PhotographicFrequency.EVERY_6_MONTHS
            ? 180
            : frequency === PhotographicFrequency.EVERY_12_MONTHS
              ? 365
              : (policy?.customIntervalDays ?? 0);
      due = days > 0 && Date.now() - latest.getTime() >= days * 86_400_000;
    }
    return due ? { message: "Se recomienda registrar una nueva plantilla fotografica.", frequency } : null;
  }

  private tokenHash(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private dateOnly(value: string) {
    const date = new Date(value.length === 10 ? `${value}T12:00:00.000Z` : value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Clinical date is invalid");
    return date;
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private async audit(
    tx: Prisma.TransactionClient | PrismaService,
    actor: AuthUser,
    context: { id: string; patientId?: string; treatmentPlanId?: string; branchId?: string },
    action: string,
    before?: unknown,
    after?: unknown,
    reason?: string
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        actorUserId: actor.id,
        entity: "PhotographicSession",
        entityId: context.id,
        action,
        before: before === undefined ? undefined : this.json(before),
        after: this.json({
          patientId: context.patientId,
          treatmentPlanId: context.treatmentPlanId,
          branchId: context.branchId,
          value: after,
          reason,
          correlationId: randomUUID()
        })
      }
    });
  }
}
