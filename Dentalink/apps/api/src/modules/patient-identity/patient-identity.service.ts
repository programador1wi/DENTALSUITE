import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { Prisma, type Patient } from "@prisma/client";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { AppointmentsService } from "../appointments/appointments.service";
import {
  AddFamilyContactDto,
  AddFamilyMemberDto,
  AddBookingFamilyMemberDto,
  BookResolvedAppointmentDto,
  CreateBookingFamilyDto,
  CreateFamilyMemberPatientDto,
  CreateBookingIdentitySessionDto,
  CreateFamilyGrantDto,
  CreateFamilyGroupDto,
  DuplicateCheckDto,
  EndContactLinkDto,
  ExecuteMergeDto,
  LinkPatientPhoneDto,
  LookupBookingFamilyMemberDto,
  MergePreviewDto,
  ReviewDuplicateCandidateDto,
  SelectBookingPatientDto,
  TransferContactLinkDto,
  UpdateFamilyMemberDto,
  UpdateIdentityConfigDto,
  VerifyBookingIdentityDto,
  VerifyBookingContactDto,
  VerifyContactPointDto
} from "./dto/patient-identity.dto";
import { PhoneNormalizationService } from "./phone-normalization.service";

type CandidateSummary = {
  patientId: string;
  maskedName: string;
  displayName?: string;
  ageReference?: string;
  relationship?: string | null;
  familyGroupId?: string;
  permissions?: {
    canBookAppointments: boolean;
    canRescheduleAppointments: boolean;
    canCancelAppointments: boolean;
    canReceiveReminders: boolean;
    canViewAppointmentSummary: boolean;
    canViewFinancialInformation: boolean;
    canViewClinicalInformation: boolean;
    canSignConsents: boolean;
  };
};

const ACTIVE_LINK_WHERE = () => ({ OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }] });
const SELECTION_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class PatientIdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly phoneNormalization: PhoneNormalizationService,
    private readonly appointmentsService: AppointmentsService
  ) {}

  async getConfig(organizationId: string) {
    return this.prisma.patientIdentityConfig.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {}
    });
  }

  async updateConfig(actor: AuthUser, dto: UpdateIdentityConfigDto) {
    const current = await this.getConfig(actor.organizationId);
    const updated = await this.prisma.patientIdentityConfig.update({
      where: { organizationId: actor.organizationId },
      data: {
        ...dto,
        defaultCountry: dto.defaultCountry?.toUpperCase()
      }
    });
    await this.audit(
      actor.organizationId,
      actor.id,
      "PatientIdentityConfig",
      updated.id,
      "update",
      current,
      updated
    );
    return updated;
  }

  async normalizePhone(organizationId: string, phone: string, country?: string) {
    const config = await this.getConfig(organizationId);
    return this.phoneNormalization.normalize(phone, country ?? config.defaultCountry);
  }

  private async upsertContactPoint(organizationId: string, phone: string, country?: string) {
    const normalized = await this.normalizePhone(organizationId, phone, country);
    const contactPoint = await this.prisma.contactPoint.upsert({
      where: {
        organizationId_type_normalizedValue: {
          organizationId,
          type: "PHONE",
          normalizedValue: normalized.normalizedValue
        }
      },
      create: {
        organizationId,
        type: "PHONE",
        rawValue: normalized.rawValue,
        normalizedValue: normalized.normalizedValue,
        countryCode: normalized.countryCode,
        nationalNumber: normalized.nationalNumber,
        callingCode: normalized.callingCode,
        phoneType: normalized.phoneType,
        status: "UNVERIFIED"
      },
      update: {
        rawValue: normalized.rawValue,
        countryCode: normalized.countryCode,
        nationalNumber: normalized.nationalNumber,
        callingCode: normalized.callingCode,
        phoneType: normalized.phoneType,
        version: { increment: 1 }
      }
    });
    return { contactPoint, normalized };
  }

  async linkPatientPhone(actor: AuthUser, dto: LinkPatientPhoneDto) {
    await this.ensurePatient(actor.organizationId, dto.patientId, actor.branchIds);
    const { contactPoint, normalized } = await this.upsertContactPoint(
      actor.organizationId,
      dto.phone,
      dto.country
    );
    const role = dto.role ?? "PERSONAL";
    const otherLinks = await this.prisma.patientContactLink.findMany({
      where: {
        organizationId: actor.organizationId,
        contactPointId: contactPoint.id,
        patientId: { not: dto.patientId },
        ...ACTIVE_LINK_WHERE()
      },
      select: { patientId: true }
    });
    if (otherLinks.length && role !== "SHARED_FAMILY") {
      throw new ConflictException({
        code: "PHONE_REQUIRES_FAMILY_GROUP",
        message:
          "El teléfono ya está vinculado. Solo puede compartirse mediante un grupo familiar autorizado."
      });
    }
    let familyContactActorPatientId: string | undefined;
    if (role === "SHARED_FAMILY") {
      if (!dto.familyGroupId) {
        throw new ConflictException({
          code: "FAMILY_GROUP_REQUIRED",
          message: "Selecciona el grupo familiar que compartirá este teléfono."
        });
      }
      const familyPatients = await this.prisma.familyGroupMember.findMany({
        where: {
          organizationId: actor.organizationId,
          familyGroupId: dto.familyGroupId,
          patientId: { in: [dto.patientId, ...otherLinks.map((link) => link.patientId)] },
          consentStatus: "ACCEPTED",
          OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          familyGroup: { status: "ACTIVE" }
        },
        select: { patientId: true, role: true }
      });
      const authorizedIds = new Set(familyPatients.map((member) => member.patientId));
      if (
        ![dto.patientId, ...otherLinks.map((link) => link.patientId)].every((patientId) =>
          authorizedIds.has(patientId)
        )
      ) {
        throw new ConflictException({
          code: "PHONE_FAMILY_AUTHORIZATION_REQUIRED",
          message: "Los pacientes vinculados al teléfono no pertenecen al mismo grupo familiar activo."
        });
      }
      familyContactActorPatientId =
        familyPatients.find((member) => member.role === "GROUP_OWNER")?.patientId ??
        familyPatients.find((member) => ["GROUP_MANAGER", "GUARDIAN"].includes(member.role))?.patientId;
      if (!familyContactActorPatientId) {
        throw new ConflictException({
          code: "FAMILY_CONTACT_ACTOR_REQUIRED",
          message: "El grupo necesita un responsable autorizado para usar el teléfono compartido."
        });
      }
    }

    const link = await this.prisma.$transaction(async (tx) => {
      if (role === "SHARED_FAMILY" && dto.familyGroupId && familyContactActorPatientId) {
        const contactCount = await tx.familyGroupContact.count({
          where: { familyGroupId: dto.familyGroupId }
        });
        await tx.familyGroupContact.upsert({
          where: {
            familyGroupId_contactPointId: {
              familyGroupId: dto.familyGroupId,
              contactPointId: contactPoint.id
            }
          },
          create: {
            organizationId: actor.organizationId,
            familyGroupId: dto.familyGroupId,
            contactPointId: contactPoint.id,
            actorPatientId: familyContactActorPatientId,
            isPrimary: contactCount === 0
          },
          update: {}
        });
      }
      if (dto.isPrimary) {
        await tx.patientContactLink.updateMany({
          where: { patientId: dto.patientId, isPrimary: true },
          data: { isPrimary: false, version: { increment: 1 } }
        });
      }
      const row = await tx.patientContactLink.upsert({
        where: {
          patientId_contactPointId_role: { patientId: dto.patientId, contactPointId: contactPoint.id, role }
        },
        create: {
          organizationId: actor.organizationId,
          patientId: dto.patientId,
          contactPointId: contactPoint.id,
          role,
          isPrimary: dto.isPrimary ?? false,
          canReceiveReminders: dto.canReceiveReminders ?? true,
          consentStatus: dto.consentStatus ?? (role === "PERSONAL" ? "ACCEPTED" : "PENDING")
        },
        update: {
          isPrimary: dto.isPrimary,
          canReceiveReminders: dto.canReceiveReminders,
          consentStatus: dto.consentStatus,
          validUntil: null,
          version: { increment: 1 }
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "PatientContactLink",
          entityId: row.id,
          action: "link_phone",
          after: {
            patientId: dto.patientId,
            contactPointId: contactPoint.id,
            role,
            normalized: normalized.normalizedValue
          }
        }
      });
      return row;
    });

    const relationshipCount = await this.prisma.patientContactLink.count({
      where: {
        contactPointId: contactPoint.id,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }]
      }
    });
    const resolvedContactPoint =
      relationshipCount > 1 && contactPoint.status !== "REVOKED"
        ? await this.prisma.contactPoint.update({
            where: { id: contactPoint.id },
            data: { status: "FAMILY_SHARED", version: { increment: 1 } }
          })
        : contactPoint;
    return { contactPoint: resolvedContactPoint, link, relationshipCount };
  }

  async verifyContactPoint(actor: AuthUser, contactPointId: string, dto: VerifyContactPointDto) {
    const contactPoint = await this.ensureContactPoint(actor.organizationId, contactPointId);
    if (contactPoint.status === "REVOKED") throw new ConflictException("El medio de contacto estÃ¡ revocado");
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.contactPoint.updateMany({
        where: { id: contactPointId, organizationId: actor.organizationId, version: dto.expectedVersion },
        data: {
          ...(dto.outcome === "VERIFIED"
            ? {
                status: ["FAMILY_SHARED", "AMBIGUOUS"].includes(contactPoint.status)
                  ? contactPoint.status
                  : "VERIFIED",
                verifiedAt: new Date(),
                provider: dto.provider
              }
            : {}),
          version: { increment: 1 }
        }
      });
      if (!claimed.count) throw new ConflictException("El medio de contacto fue modificado por otro usuario");
      const event = await tx.contactVerificationEvent.create({
        data: {
          organizationId: actor.organizationId,
          contactPointId,
          method: dto.method,
          outcome: dto.outcome,
          provider: dto.provider,
          providerEventId: dto.providerEventId,
          actorType: "USER",
          actorId: actor.id,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "ContactPoint",
          entityId: contactPointId,
          action: "verify_contact",
          before: { status: contactPoint.status, version: contactPoint.version },
          after: { outcome: dto.outcome, method: dto.method, provider: dto.provider }
        }
      });
      return event;
    });
  }

  async endContactLink(actor: AuthUser, linkId: string, dto: EndContactLinkDto) {
    const link = await this.prisma.patientContactLink.findFirst({
      where: {
        id: linkId,
        organizationId: actor.organizationId,
        patient: { branchId: { in: actor.branchIds } }
      }
    });
    if (!link) throw new NotFoundException("VÃ­nculo de contacto no encontrado");
    const result = await this.prisma.patientContactLink.updateMany({
      where: { id: link.id, version: dto.expectedVersion },
      data: { validUntil: new Date(), isPrimary: false, consentStatus: "REVOKED", version: { increment: 1 } }
    });
    if (!result.count) throw new ConflictException("El vÃ­nculo fue modificado por otro usuario");
    await this.audit(actor.organizationId, actor.id, "PatientContactLink", link.id, "end_link", link, {
      reason: dto.reason
    });
    return this.prisma.patientContactLink.findUnique({
      where: { id: link.id },
      include: { contactPoint: true }
    });
  }

  async transferContactLink(actor: AuthUser, linkId: string, dto: TransferContactLinkDto) {
    const [link] = await Promise.all([
      this.prisma.patientContactLink.findFirst({
        where: {
          id: linkId,
          organizationId: actor.organizationId,
          patient: { branchId: { in: actor.branchIds } }
        }
      }),
      this.ensurePatient(actor.organizationId, dto.toPatientId, actor.branchIds)
    ]);
    if (!link) throw new NotFoundException("VÃ­nculo de contacto no encontrado");
    if (link.patientId === dto.toPatientId)
      throw new BadRequestException("El contacto ya pertenece a ese paciente");
    const role = dto.role ?? link.role;
    const transferred = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.patientContactLink.updateMany({
        where: { id: link.id, version: dto.expectedVersion },
        data: {
          validUntil: new Date(),
          isPrimary: false,
          consentStatus: "REVOKED",
          version: { increment: 1 }
        }
      });
      if (!claimed.count) throw new ConflictException("El vÃ­nculo fue modificado por otro usuario");
      const target = await tx.patientContactLink.upsert({
        where: {
          patientId_contactPointId_role: {
            patientId: dto.toPatientId,
            contactPointId: link.contactPointId,
            role
          }
        },
        create: {
          organizationId: actor.organizationId,
          patientId: dto.toPatientId,
          contactPointId: link.contactPointId,
          role,
          isPrimary: false,
          canReceiveReminders: link.canReceiveReminders,
          consentStatus: "PENDING"
        },
        update: { validUntil: null, consentStatus: "PENDING", version: { increment: 1 } }
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "PatientContactLink",
          entityId: target.id,
          action: "transfer_link",
          reason: dto.reason,
          before: { linkId: link.id, patientId: link.patientId },
          after: { patientId: dto.toPatientId, contactPointId: link.contactPointId, role }
        }
      });
      return target;
    });
    return transferred;
  }

  async backfillPatientContacts(actor: AuthUser, patientId?: string) {
    const patients = await this.prisma.patient.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        deletedAt: null,
        ...(patientId ? { id: patientId } : {}),
        OR: [{ phone: { not: null } }, { alternatePhone: { not: null } }]
      },
      select: { id: true, phone: true, alternatePhone: true }
    });
    let linked = 0;
    const failures: Array<{ patientId: string; field: string; reason: string }> = [];
    for (const patient of patients) {
      for (const [field, value, role, primary] of [
        ["phone", patient.phone, "PERSONAL", true],
        ["alternatePhone", patient.alternatePhone, "PERSONAL", false]
      ] as const) {
        if (!value) continue;
        try {
          await this.linkPatientPhone(actor, {
            patientId: patient.id,
            phone: value,
            role,
            isPrimary: primary,
            consentStatus: "ACCEPTED"
          });
          linked += 1;
        } catch (error) {
          failures.push({
            patientId: patient.id,
            field,
            reason: error instanceof Error ? error.message : "INVALID_PHONE"
          });
        }
      }
    }
    return { patients: patients.length, linked, failures };
  }

  async syncPatientPhones(
    actor: AuthUser,
    patientId: string,
    phone?: string | null,
    alternatePhone?: string | null
  ) {
    await this.ensurePatient(actor.organizationId, patientId, actor.branchIds);
    const desired: Array<{ value: string; isPrimary: boolean }> = [];
    if (phone?.trim()) desired.push({ value: phone, isPrimary: true });
    if (alternatePhone?.trim() && alternatePhone.replace(/\D/g, "") !== phone?.replace(/\D/g, "")) {
      desired.push({ value: alternatePhone, isPrimary: false });
    }
    const contactPointIds: string[] = [];
    for (const item of desired) {
      const result = await this.linkPatientPhone(actor, {
        patientId,
        phone: item.value,
        role: "PERSONAL",
        isPrimary: item.isPrimary,
        consentStatus: "ACCEPTED"
      });
      contactPointIds.push(result.contactPoint.id);
    }
    await this.prisma.patientContactLink.updateMany({
      where: {
        patientId,
        role: "PERSONAL",
        validUntil: null,
        ...(contactPointIds.length ? { contactPointId: { notIn: contactPointIds } } : {})
      },
      data: { validUntil: new Date(), isPrimary: false, version: { increment: 1 } }
    });
    return this.getPatientIdentity(actor, patientId);
  }

  async getPatientIdentity(actor: AuthUser, patientId: string) {
    await this.ensurePatient(actor.organizationId, patientId, actor.branchIds);
    const [contacts, memberships] = await Promise.all([
      this.prisma.patientContactLink.findMany({
        where: { patientId },
        include: { contactPoint: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
      }),
      this.prisma.familyGroupMember.findMany({
        where: { patientId },
        include: {
          familyGroup: {
            include: {
              contacts: { include: { contactPoint: true } },
              members: {
                include: {
                  patient: { select: { id: true, firstName: true, lastName: true, birthDate: true } }
                }
              },
              bookingGrants: true
            }
          }
        }
      })
    ]);
    return { contacts, memberships };
  }

  async createFamilyGroup(actor: AuthUser, dto: CreateFamilyGroupDto) {
    await this.assertFeature(actor.organizationId, "familyGroupsEnabled");
    const ownerPatient = await this.ensurePatient(actor.organizationId, dto.ownerPatientId, actor.branchIds);
    const contact = dto.primaryContact
      ? await this.upsertContactPoint(
          actor.organizationId,
          dto.primaryContact.phone,
          dto.primaryContact.country
        )
      : undefined;

    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.familyGroup.create({
        data: {
          organizationId: actor.organizationId,
          name: this.normalizeText(dto.name),
          holderPatientId: dto.ownerPatientId,
          branchId: ownerPatient.branchId,
          createdById: actor.id,
          members: {
            create: {
              organizationId: actor.organizationId,
              patientId: dto.ownerPatientId,
              role: "GROUP_OWNER",
              consentStatus: "ACCEPTED"
            }
          },
          ...(contact
            ? {
                contacts: {
                  create: {
                    organizationId: actor.organizationId,
                    contactPointId: contact.contactPoint.id,
                    actorPatientId: dto.ownerPatientId,
                    isPrimary: true
                  }
                },
                bookingGrants: {
                  create: {
                    organizationId: actor.organizationId,
                    actorContactPointId: contact.contactPoint.id,
                    patientId: dto.ownerPatientId,
                    consentStatus: "ACCEPTED",
                    canBook: true,
                    canReschedule: true,
                    canCancel: true,
                    canReceiveReminders: true,
                    canViewAppointmentSummary: true,
                    canViewFinancialInformation: false,
                    canViewClinicalInformation: false,
                    canSignConsents: false
                  }
                }
              }
            : {})
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "FamilyGroup",
          entityId: created.id,
          action: "create",
          after: {
            name: created.name,
            familyCode: created.familyCode,
            ownerPatientId: dto.ownerPatientId,
            contactPointId: contact?.contactPoint.id
          }
        }
      });
      return created;
    });
    if (contact) {
      await this.prisma.contactPoint.update({
        where: { id: contact.contactPoint.id },
        data: { status: "FAMILY_SHARED", version: { increment: 1 } }
      });
    }
    return this.getFamilyGroup(actor, group.id);
  }

  async getFamilyGroup(actor: AuthUser, id: string) {
    const group = await this.prisma.familyGroup.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        members: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, birthDate: true, status: true } }
          }
        },
        contacts: { include: { contactPoint: true } },
        bookingGrants: true
      }
    });
    if (!group) throw new NotFoundException("Grupo familiar no encontrado");
    return group;
  }

  async addFamilyMember(actor: AuthUser, familyGroupId: string, dto: AddFamilyMemberDto) {
    await this.assertFeature(actor.organizationId, "familyGroupsEnabled");
    const [group] = await Promise.all([
      this.getFamilyGroup(actor, familyGroupId),
      this.ensurePatient(actor.organizationId, dto.patientId, actor.branchIds)
    ]);
    const isMinor = await this.isMinor(dto.patientId);
    if (dto.role === "MINOR" && !isMinor) throw new BadRequestException("El paciente no es menor de edad");
    if (dto.role !== "MINOR" && isMinor && dto.role === "ADULT_MEMBER")
      throw new BadRequestException("Un menor no puede registrarse como adulto");
    const consentStatus = isMinor ? "ACCEPTED" : (dto.consentStatus ?? "PENDING");
    const primaryContact = group.contacts.find((contact) => contact.isPrimary) ?? group.contacts[0];
    const member = await this.prisma.$transaction(async (tx) => {
      const created = await tx.familyGroupMember.create({
        data: {
          organizationId: actor.organizationId,
          familyGroupId,
          patientId: dto.patientId,
          role: dto.role,
          relationship: dto.relationship?.trim(),
          consentStatus
        }
      });
      if (primaryContact) {
        await tx.familyBookingGrant.upsert({
          where: {
            familyGroupId_actorContactPointId_patientId: {
              familyGroupId,
              actorContactPointId: primaryContact.contactPointId,
              patientId: dto.patientId
            }
          },
          create: {
            organizationId: actor.organizationId,
            familyGroupId,
            actorContactPointId: primaryContact.contactPointId,
            patientId: dto.patientId,
            canBook: consentStatus === "ACCEPTED",
            canReceiveReminders: true,
            canViewAppointmentSummary: consentStatus === "ACCEPTED",
            consentStatus
          },
          update: {
            canBook: consentStatus === "ACCEPTED",
            canReceiveReminders: true,
            canViewAppointmentSummary: consentStatus === "ACCEPTED",
            consentStatus,
            validUntil: null,
            version: { increment: 1 }
          }
        });
      }
      return created;
    });
    await this.audit(
      actor.organizationId,
      actor.id,
      "FamilyGroupMember",
      member.id,
      "add_member",
      null,
      member
    );
    return member;
  }

  async createFamilyMemberPatient(actor: AuthUser, familyGroupId: string, dto: CreateFamilyMemberPatientDto) {
    await this.assertFeature(actor.organizationId, "familyGroupsEnabled");
    const group = await this.getFamilyGroup(actor, familyGroupId);
    const primaryContact = group.contacts.find((contact) => contact.isPrimary) ?? group.contacts[0];
    if (!primaryContact) {
      throw new ConflictException(
        "El grupo familiar necesita un telefono compartido antes de crear integrantes"
      );
    }
    await this.ensureBranch(actor.organizationId, dto.branchId, actor.branchIds);
    const matches = await this.findFamilyPersonMatches(
      actor.organizationId,
      dto.branchId,
      dto.firstName,
      dto.lastName,
      dto.birthDate
    );
    if (!dto.existingPatientId && matches.length) {
      throw new ConflictException({
        code: "FAMILY_MEMBER_MATCHES_FOUND",
        message:
          "Existe una ficha con el mismo nombre, apellidos y nacimiento. Vinculala en lugar de crear otra.",
        matches: matches.map((match) => ({
          patientId: match.id,
          displayName: `${match.firstName} ${match.lastName}`,
          ageReference: this.ageReference(match.birthDate)
        }))
      });
    }
    if (dto.existingPatientId && !matches.some((match) => match.id === dto.existingPatientId)) {
      throw new ForbiddenException("El paciente seleccionado no coincide con nombre, apellidos y nacimiento");
    }
    const birthDate = new Date(dto.birthDate);
    const isMinor = this.isMinorBirthDate(birthDate);
    const role = dto.role ?? (isMinor ? "MINOR" : "ADULT_MEMBER");
    if (role === "MINOR" && !isMinor) throw new BadRequestException("El paciente no es menor de edad");
    if (role === "ADULT_MEMBER" && isMinor)
      throw new BadRequestException("Un menor no puede registrarse como adulto");
    const consentStatus = isMinor ? "ACCEPTED" : (dto.consentStatus ?? "PENDING");
    const canBook = consentStatus === "ACCEPTED";
    const existingPatient = dto.existingPatientId
      ? await this.ensurePatient(actor.organizationId, dto.existingPatientId, actor.branchIds)
      : undefined;
    const patient = await this.prisma.$transaction(async (tx) => {
      const resolvedPatient =
        existingPatient ??
        (await tx.patient.create({
          data: {
            organizationId: actor.organizationId,
            branchId: dto.branchId,
            firstName: this.normalizeText(dto.firstName),
            lastName: this.normalizeText(dto.lastName),
            birthDate,
            gender: dto.gender?.trim(),
            status: "PROVISIONAL"
          }
        }));
      await this.upsertFamilyMemberAccess(tx, {
        organizationId: actor.organizationId,
        familyGroupId,
        patientId: resolvedPatient.id,
        contactPointId: primaryContact.contactPoint.id,
        role,
        relationship: dto.relationship,
        consentStatus,
        canBook,
        canReceiveReminders: true
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "FamilyGroupMember",
          entityId: resolvedPatient.id,
          action: dto.existingPatientId ? "link_existing_member" : "create_member_patient",
          after: {
            familyGroupId,
            patientId: resolvedPatient.id,
            contactPointId: primaryContact.contactPoint.id,
            isMinor,
            consentStatus
          }
        }
      });
      return resolvedPatient;
    });
    return {
      patientId: patient.id,
      familyGroupId,
      consentStatus,
      displayName: `${patient.firstName} ${patient.lastName}`,
      ageReference: this.ageReference(patient.birthDate)
    };
  }

  async updateFamilyMember(
    actor: AuthUser,
    familyGroupId: string,
    memberId: string,
    dto: UpdateFamilyMemberDto
  ) {
    const member = await this.prisma.familyGroupMember.findFirst({
      where: { id: memberId, familyGroupId, organizationId: actor.organizationId }
    });
    if (!member) throw new NotFoundException("Integrante no encontrado");
    const result = await this.prisma.familyGroupMember.updateMany({
      where: { id: memberId, version: dto.expectedVersion },
      data: {
        role: dto.role,
        relationship: dto.relationship?.trim(),
        consentStatus: dto.consentStatus,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        version: { increment: 1 }
      }
    });
    if (!result.count) throw new ConflictException("El integrante fue modificado por otro usuario");
    const updated = await this.prisma.familyGroupMember.findUniqueOrThrow({ where: { id: memberId } });
    if (dto.consentStatus) {
      const accepted = dto.consentStatus === "ACCEPTED";
      await this.prisma.familyBookingGrant.updateMany({
        where: { familyGroupId, patientId: member.patientId },
        data: {
          consentStatus: dto.consentStatus,
          ...(!accepted
            ? {
                canBook: false,
                canReschedule: false,
                canCancel: false,
                canReceiveReminders: false,
                canViewAppointmentSummary: false,
                canViewFinancialInformation: false,
                canViewClinicalInformation: false,
                canSignConsents: false
              }
            : {}),
          version: { increment: 1 }
        }
      });
      await this.prisma.patientContactLink.updateMany({
        where: { patientId: member.patientId, role: "SHARED_FAMILY", validUntil: null },
        data: {
          consentStatus: dto.consentStatus,
          ...(!accepted ? { canReceiveReminders: false } : {}),
          version: { increment: 1 }
        }
      });
    }
    await this.audit(
      actor.organizationId,
      actor.id,
      "FamilyGroupMember",
      memberId,
      "update_member",
      member,
      updated
    );
    return updated;
  }

  async addFamilyContact(actor: AuthUser, familyGroupId: string, dto: AddFamilyContactDto) {
    const group = await this.getFamilyGroup(actor, familyGroupId);
    const defaultActor = group.members.find((member) => member.role === "GROUP_OWNER")?.patientId;
    const actorPatientId = dto.actorPatientId ?? defaultActor;
    if (
      !actorPatientId ||
      !group.members.some(
        (member) =>
          member.patientId === actorPatientId &&
          member.consentStatus === "ACCEPTED" &&
          ["GROUP_OWNER", "GROUP_MANAGER", "GUARDIAN"].includes(member.role)
      )
    ) {
      throw new BadRequestException("El responsable del contacto debe ser integrante autorizado del grupo");
    }
    const { contactPoint } = await this.upsertContactPoint(actor.organizationId, dto.phone, dto.country);
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary)
        await tx.familyGroupContact.updateMany({ where: { familyGroupId }, data: { isPrimary: false } });
      return tx.familyGroupContact.upsert({
        where: { familyGroupId_contactPointId: { familyGroupId, contactPointId: contactPoint.id } },
        create: {
          organizationId: actor.organizationId,
          familyGroupId,
          contactPointId: contactPoint.id,
          actorPatientId,
          isPrimary: dto.isPrimary ?? false
        },
        update: { isPrimary: dto.isPrimary, actorPatientId }
      });
    });
    await this.prisma.contactPoint.update({
      where: { id: contactPoint.id },
      data: { status: "FAMILY_SHARED", version: { increment: 1 } }
    });
    await this.audit(actor.organizationId, actor.id, "FamilyGroupContact", row.id, "add_contact", null, row);
    return row;
  }

  async createFamilyGrant(actor: AuthUser, familyGroupId: string, dto: CreateFamilyGrantDto) {
    const [, , , member, familyContact] = await Promise.all([
      this.getFamilyGroup(actor, familyGroupId),
      this.ensurePatient(actor.organizationId, dto.patientId, actor.branchIds),
      this.ensureContactPoint(actor.organizationId, dto.actorContactPointId),
      this.prisma.familyGroupMember.findFirst({
        where: {
          organizationId: actor.organizationId,
          familyGroupId,
          patientId: dto.patientId,
          OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }]
        },
        select: { id: true }
      }),
      this.prisma.familyGroupContact.findFirst({
        where: {
          organizationId: actor.organizationId,
          familyGroupId,
          contactPointId: dto.actorContactPointId
        },
        select: { id: true }
      })
    ]);
    if (!member)
      throw new BadRequestException("El permiso solo puede asignarse a un integrante activo del grupo");
    if (!familyContact) throw new BadRequestException("El teléfono actor no pertenece al grupo familiar");
    const grant = await this.prisma.familyBookingGrant.upsert({
      where: {
        familyGroupId_actorContactPointId_patientId: {
          familyGroupId,
          actorContactPointId: dto.actorContactPointId,
          patientId: dto.patientId
        }
      },
      create: {
        organizationId: actor.organizationId,
        familyGroupId,
        actorContactPointId: dto.actorContactPointId,
        patientId: dto.patientId,
        canBook: dto.canBook ?? true,
        canReschedule: dto.canReschedule ?? false,
        canCancel: dto.canCancel ?? false,
        canReceiveReminders: dto.canReceiveReminders ?? true,
        canViewAppointmentSummary: dto.canViewAppointmentSummary ?? false,
        canViewFinancialInformation: dto.canViewFinancialInformation ?? false,
        canViewClinicalInformation: dto.canViewClinicalInformation ?? false,
        canSignConsents: dto.canSignConsents ?? false,
        consentStatus: dto.consentStatus ?? "PENDING"
      },
      update: {
        canBook: dto.canBook,
        canReschedule: dto.canReschedule,
        canCancel: dto.canCancel,
        canReceiveReminders: dto.canReceiveReminders,
        canViewAppointmentSummary: dto.canViewAppointmentSummary,
        canViewFinancialInformation: dto.canViewFinancialInformation,
        canViewClinicalInformation: dto.canViewClinicalInformation,
        canSignConsents: dto.canSignConsents,
        consentStatus: dto.consentStatus,
        validUntil: null,
        version: { increment: 1 }
      }
    });
    await this.audit(
      actor.organizationId,
      actor.id,
      "FamilyBookingGrant",
      grant.id,
      "upsert_grant",
      null,
      grant
    );
    return grant;
  }

  async duplicateCheck(organizationId: string, dto: DuplicateCheckDto, branchIds?: string[]) {
    const normalizedPhone = dto.phone
      ? (await this.normalizePhone(organizationId, dto.phone, dto.country)).normalizedValue
      : undefined;
    const email = dto.email?.trim().toLowerCase();
    const documentNumber = this.normalizeIdentifier(dto.documentNumber);
    const firstName = this.normalizeIdentity(dto.firstName);
    const lastName = this.normalizeIdentity(dto.lastName);
    const birthDate = dto.birthDate ? new Date(dto.birthDate) : undefined;

    const candidates = await this.prisma.patient.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(branchIds?.length
          ? { branchId: { in: branchIds } }
          : dto.branchId
            ? { branchId: dto.branchId }
            : {}),
        ...(dto.excludePatientId ? { id: { not: dto.excludePatientId } } : {}),
        OR: [
          normalizedPhone ? { phone: normalizedPhone.replace(/^\+/, "") } : undefined,
          normalizedPhone
            ? { contactLinks: { some: { contactPoint: { normalizedValue: normalizedPhone } } } }
            : undefined,
          email ? { email } : undefined,
          documentNumber
            ? { documentNumber: { equals: dto.documentNumber?.trim(), mode: "insensitive" } }
            : undefined,
          {
            AND: [
              { firstName: { equals: dto.firstName.trim(), mode: "insensitive" } },
              { lastName: { equals: dto.lastName.trim(), mode: "insensitive" } }
            ]
          }
        ].filter(Boolean) as Prisma.PatientWhereInput[]
      },
      select: {
        id: true,
        branchId: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        documentType: true,
        documentNumber: true,
        email: true,
        phone: true,
        status: true,
        contactLinks: { include: { contactPoint: true } }
      },
      take: 25,
      orderBy: { createdAt: "desc" }
    });

    const matches = candidates
      .map((candidate) => {
        const reasons: string[] = [];
        let confidence = 0;
        const candidateDocument = this.normalizeIdentifier(candidate.documentNumber);
        if (documentNumber && candidateDocument === documentNumber) {
          confidence += 60;
          reasons.push("DOCUMENT_EXACT");
        }
        const candidatePhones = new Set([
          candidate.phone ? `+${candidate.phone.replace(/\D/g, "")}` : "",
          ...candidate.contactLinks.map((link) => link.contactPoint.normalizedValue)
        ]);
        if (normalizedPhone && candidatePhones.has(normalizedPhone)) {
          confidence += 25;
          reasons.push("PHONE_EXACT");
        }
        if (email && candidate.email?.trim().toLowerCase() === email) {
          confidence += 20;
          reasons.push("EMAIL_EXACT");
        }
        if (
          this.normalizeIdentity(candidate.firstName) === firstName &&
          this.normalizeIdentity(candidate.lastName) === lastName
        ) {
          confidence += 20;
          reasons.push("NAME_EXACT");
        }
        if (
          birthDate &&
          candidate.birthDate?.toISOString().slice(0, 10) === birthDate.toISOString().slice(0, 10)
        ) {
          confidence += 25;
          reasons.push("BIRTH_DATE_EXACT");
        }
        const classification =
          confidence >= 80 ? "HIGH_CONFIDENCE" : confidence >= 45 ? "POSSIBLE_MATCH" : "LOW_CONFIDENCE";
        return { ...candidate, confidence: Math.min(confidence, 100), classification, reasons };
      })
      .filter((candidate) => candidate.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);

    return {
      decision: matches.some(
        (match) => match.reasons.includes("DOCUMENT_EXACT") && match.reasons.includes("NAME_EXACT")
      )
        ? "BLOCK_VERIFIED_IDENTITY"
        : matches.some((match) => match.reasons.includes("PHONE_EXACT"))
          ? "PHONE_REQUIRES_FAMILY_FLOW"
          : matches.length
            ? "REVIEW_REQUIRED"
            : "NO_MATCH",
      matches
    };
  }

  async listDuplicateCandidates(actor: AuthUser, status = "OPEN") {
    return this.prisma.patientDuplicateCandidate.findMany({
      where: { organizationId: actor.organizationId, status },
      include: {
        patientA: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthDate: true,
            documentNumber: true,
            phone: true,
            email: true
          }
        },
        patientB: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthDate: true,
            documentNumber: true,
            phone: true,
            email: true
          }
        }
      },
      orderBy: [{ confidence: "desc" }, { createdAt: "desc" }]
    });
  }

  async listBookingIdentityIncidents(actor: AuthUser, status = "OPEN") {
    return this.prisma.bookingIdentityIncident.findMany({
      where: { organizationId: actor.organizationId, status },
      include: {
        session: {
          select: {
            id: true,
            source: true,
            conversationId: true,
            status: true,
            resolution: true,
            createdAt: true,
            contactPoint: { select: { normalizedValue: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  async reviewDuplicateCandidate(actor: AuthUser, id: string, dto: ReviewDuplicateCandidateDto) {
    const candidate = await this.prisma.patientDuplicateCandidate.findFirst({
      where: { id, organizationId: actor.organizationId }
    });
    if (!candidate) throw new NotFoundException("Candidato duplicado no encontrado");
    const result = await this.prisma.patientDuplicateCandidate.updateMany({
      where: { id, organizationId: actor.organizationId, version: dto.expectedVersion },
      data: {
        status: dto.status,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewReason: dto.reason.trim(),
        version: { increment: 1 }
      }
    });
    if (!result.count) throw new ConflictException("El candidato fue modificado por otro usuario");
    const updated = await this.prisma.patientDuplicateCandidate.findUniqueOrThrow({ where: { id } });
    await this.audit(
      actor.organizationId,
      actor.id,
      "PatientDuplicateCandidate",
      id,
      "review",
      candidate,
      updated
    );
    return updated;
  }

  async recordDuplicateCandidates(actor: AuthUser, patientId: string) {
    const patient = await this.ensurePatient(actor.organizationId, patientId, actor.branchIds);
    const result = await this.duplicateCheck(
      actor.organizationId,
      {
        branchId: patient.branchId,
        excludePatientId: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        birthDate: patient.birthDate?.toISOString().slice(0, 10),
        documentType: patient.documentType ?? undefined,
        documentNumber: patient.documentNumber ?? undefined,
        email: patient.email ?? undefined,
        phone: patient.phone ?? undefined
      },
      actor.branchIds
    );
    for (const match of result.matches) {
      const [patientAId, patientBId] = [patient.id, match.id].sort();
      await this.prisma.patientDuplicateCandidate.upsert({
        where: {
          organizationId_patientAId_patientBId: {
            organizationId: actor.organizationId,
            patientAId,
            patientBId
          }
        },
        create: {
          organizationId: actor.organizationId,
          patientAId,
          patientBId,
          classification: match.classification,
          confidence: match.confidence,
          reasons: match.reasons
        },
        update: {
          classification: match.classification,
          confidence: match.confidence,
          reasons: match.reasons,
          version: { increment: 1 }
        }
      });
    }
    return { recorded: result.matches.length, decision: result.decision };
  }

  async getDataQuality(actor: AuthUser) {
    const [
      unlinkedLegacyPhones,
      failureAudits,
      activeLinks,
      groupedLinks,
      familyGroups,
      openDuplicates,
      openSessions,
      openIncidents,
      config
    ] = await Promise.all([
      this.prisma.patient.findMany({
        where: {
          organizationId: actor.organizationId,
          branchId: { in: actor.branchIds },
          deletedAt: null,
          phone: { not: null },
          contactLinks: { none: { validUntil: null } }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          branch: { select: { name: true } }
        },
        orderBy: { updatedAt: "desc" },
        take: 200
      }),
      this.prisma.auditLog.findMany({
        where: {
          organizationId: actor.organizationId,
          entity: "Patient",
          action: "patient_contact_backfill_failed",
          entityId: { not: null }
        },
        select: { entityId: true, after: true },
        distinct: ["entityId"]
      }),
      this.prisma.patientContactLink.count({
        where: { organizationId: actor.organizationId, validUntil: null }
      }),
      this.prisma.patientContactLink.groupBy({
        by: ["contactPointId"],
        where: { organizationId: actor.organizationId, validUntil: null },
        _count: { _all: true }
      }),
      this.prisma.familyGroup.count({ where: { organizationId: actor.organizationId, status: "ACTIVE" } }),
      this.prisma.patientDuplicateCandidate.count({
        where: { organizationId: actor.organizationId, status: "OPEN" }
      }),
      this.prisma.bookingIdentitySession.count({
        where: {
          organizationId: actor.organizationId,
          status: { in: ["PENDING", "VERIFIED", "AMBIGUOUS"] },
          expiresAt: { gt: new Date() }
        }
      }),
      this.prisma.bookingIdentityIncident.count({
        where: { organizationId: actor.organizationId, status: "OPEN" }
      }),
      this.getConfig(actor.organizationId)
    ]);
    const auditedIds = failureAudits.flatMap((row) => (row.entityId ? [row.entityId] : []));
    const auditedPatients = auditedIds.length
      ? await this.prisma.patient.findMany({
          where: {
            id: { in: auditedIds },
            organizationId: actor.organizationId,
            branchId: { in: actor.branchIds },
            deletedAt: null
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            alternatePhone: true,
            branch: { select: { name: true } }
          }
        })
      : [];
    const failuresByPatient = new Map(
      failureAudits.flatMap((row) => {
        if (!row.entityId || !row.after || Array.isArray(row.after) || typeof row.after !== "object")
          return [];
        return [[row.entityId, row.after] as const];
      })
    );
    const invalidLegacyPhones = [
      ...new Map(
        [...unlinkedLegacyPhones, ...auditedPatients].map((patient) => [
          patient.id,
          { ...patient, validationFailure: failuresByPatient.get(patient.id) ?? null }
        ])
      ).values()
    ];
    const sharedGroups = groupedLinks.filter((group) => group._count._all > 1);
    return {
      summary: {
        invalidLegacyPhones: invalidLegacyPhones.length,
        activeLinks,
        sharedContactPoints: sharedGroups.length,
        patientsOnSharedContacts: sharedGroups.reduce((sum, group) => sum + group._count._all, 0),
        familyGroups,
        openDuplicates,
        openIdentitySessions: openSessions,
        openIdentityIncidents: openIncidents
      },
      invalidLegacyPhones,
      config
    };
  }

  async createSession(organizationId: string, dto: CreateBookingIdentitySessionDto) {
    const config = await this.getConfig(organizationId);
    const source = dto.source.trim().toUpperCase();
    if (source === "WHATSAPP" && !config.whatsappResolutionEnabled && !config.shadowMode) {
      throw new ServiceUnavailableException("Resolución de identidad para WhatsApp no está habilitada");
    }
    if (source === "PUBLIC_BOOKING" && !config.publicBookingResolutionEnabled && !config.shadowMode) {
      throw new ServiceUnavailableException("Resolución de identidad para Agenda Online no está habilitada");
    }
    const normalized = await this.normalizePhone(organizationId, dto.phone, dto.country);
    if (dto.conversationId) {
      const existing = await this.prisma.bookingIdentitySession.findUnique({
        where: {
          organizationId_source_conversationId: { organizationId, source, conversationId: dto.conversationId }
        },
        include: { contactPoint: true }
      });
      if (existing && existing.expiresAt > new Date()) {
        if (existing.contactPoint?.normalizedValue !== normalized.normalizedValue) {
          throw new ConflictException("La conversación ya está asociada a otro teléfono");
        }
        if (
          existing.selectedPatientId &&
          existing.selectionExpiresAt &&
          existing.selectionExpiresAt <= new Date()
        ) {
          await this.prisma.bookingIdentitySession.update({
            where: { id: existing.id },
            data: {
              selectedPatientId: null,
              selectedAt: null,
              selectionExpiresAt: null,
              status: "EXPIRED",
              version: { increment: 1 }
            }
          });
          throw new ConflictException("La selección del paciente expiró; inicia una nueva resolución");
        }
        return this.sessionResponse(existing);
      }
    }
    const { contactPoint } = await this.upsertContactPoint(organizationId, dto.phone, dto.country);
    const requiresContactVerification = source === "WHATSAPP" && !dto.channelVerified;
    const resolution = requiresContactVerification
      ? { resolution: "CONTACT_VERIFICATION_REQUIRED", confidence: 0, candidates: [] as CandidateSummary[] }
      : await this.resolveContactCandidates(organizationId, contactPoint.id);
    const now = new Date();
    const session = await this.prisma.bookingIdentitySession.create({
      data: {
        organizationId,
        contactPointId: contactPoint.id,
        source,
        conversationId: dto.conversationId,
        channelMessageId: dto.channelMessageId,
        status: resolution.resolution === "AMBIGUOUS" ? "AMBIGUOUS" : "PENDING",
        resolution: resolution.resolution,
        familyGroupId: "familyGroupId" in resolution ? resolution.familyGroupId : undefined,
        bookingActorPatientId: "actorPatientId" in resolution ? resolution.actorPatientId : undefined,
        confidence: resolution.confidence,
        contactVerifiedAt: dto.channelVerified ? now : undefined,
        contactVerificationMethod: dto.channelVerified
          ? (dto.verificationMethod ?? "WHATSAPP_SESSION")
          : undefined,
        metadata: {
          candidateCount: resolution.candidates.length,
          candidatePatientIds: resolution.candidates.map((candidate) => candidate.patientId)
        },
        expiresAt: new Date(now.getTime() + 30 * 60 * 1000)
      }
    });
    if (resolution.resolution === "AMBIGUOUS") {
      await this.prisma.contactPoint.update({
        where: { id: contactPoint.id },
        data: { status: "AMBIGUOUS", version: { increment: 1 } }
      });
    }
    if (dto.channelVerified) {
      await this.recordChannelVerification(
        organizationId,
        contactPoint.id,
        dto.verificationMethod ?? "WHATSAPP_SESSION",
        dto.providerEventId
      );
    }
    if (resolution.resolution === "AMBIGUOUS") {
      await this.ensureAmbiguityIncident(
        session.id,
        organizationId,
        "DUPLICATE_PHONE_WITHOUT_COMMON_FAMILY",
        undefined,
        {
          contactPointId: contactPoint.id
        }
      );
    }
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        entity: "BookingIdentitySession",
        entityId: session.id,
        action: "create",
        after: { source, resolution: session.resolution, candidateCount: resolution.candidates.length }
      }
    });
    const visibleCandidates =
      source === "WHATSAPP" && dto.channelVerified
        ? resolution.candidates
        : resolution.candidates.map((candidate) => ({
            patientId: candidate.patientId,
            maskedName: candidate.maskedName,
            relationship: candidate.relationship,
            familyGroupId: candidate.familyGroupId
          }));
    return {
      ...(await this.sessionResponse(session)),
      candidates:
        requiresContactVerification || resolution.resolution === "AMBIGUOUS" ? [] : visibleCandidates
    };
  }

  async verifyBookingContact(organizationId: string, sessionId: string, dto: VerifyBookingContactDto) {
    if (!dto.verified) throw new ForbiddenException("La verificación del teléfono no fue confirmada");
    const session = await this.getOpenSession(organizationId, sessionId);
    if (!session.contactPointId) throw new ConflictException("La sesión no tiene teléfono asociado");
    if (session.status === "SELECTED") return this.sessionResponse(session);
    const resolution = await this.resolveContactCandidates(organizationId, session.contactPointId);
    const verifiedAt = new Date();
    const updated = await this.prisma.bookingIdentitySession.update({
      where: { id: session.id },
      data: {
        status: resolution.resolution === "AMBIGUOUS" ? "AMBIGUOUS" : "PENDING",
        resolution: resolution.resolution,
        familyGroupId: resolution.familyGroupId,
        bookingActorPatientId: resolution.actorPatientId,
        confidence: resolution.confidence,
        contactVerifiedAt: verifiedAt,
        contactVerificationMethod: dto.method,
        lastActionAt: verifiedAt,
        metadata: {
          candidateCount: resolution.candidates.length,
          candidatePatientIds: resolution.candidates.map((candidate) => candidate.patientId)
        },
        version: { increment: 1 }
      }
    });
    if (resolution.resolution === "AMBIGUOUS") {
      await this.prisma.contactPoint.update({
        where: { id: session.contactPointId },
        data: { status: "AMBIGUOUS", version: { increment: 1 } }
      });
    }
    await this.recordChannelVerification(
      organizationId,
      session.contactPointId,
      dto.method,
      dto.providerEventId,
      dto.provider
    );
    if (resolution.resolution === "AMBIGUOUS") {
      await this.ensureAmbiguityIncident(
        session.id,
        organizationId,
        "DUPLICATE_PHONE_WITHOUT_COMMON_FAMILY",
        undefined,
        {
          contactPointId: session.contactPointId
        }
      );
    }
    return {
      ...(await this.sessionResponse(updated)),
      prompt: resolution.resolution === "FAMILY_SHARED" ? "¿Para quién deseas agendar?" : undefined,
      candidates: resolution.resolution === "AMBIGUOUS" ? [] : resolution.candidates
    };
  }

  async lookupBookingFamilyMember(
    organizationId: string,
    sessionId: string,
    dto: LookupBookingFamilyMemberDto
  ) {
    const session = await this.requireManageableFamilySession(organizationId, sessionId);
    const matches = await this.prisma.patient.findMany({
      where: {
        organizationId,
        branchId: dto.branchId,
        deletedAt: null,
        status: { notIn: ["INACTIVE", "MERGED"] },
        firstName: { equals: dto.firstName.trim(), mode: "insensitive" },
        lastName: { equals: dto.lastName.trim(), mode: "insensitive" },
        birthDate: new Date(dto.birthDate)
      },
      select: { id: true, firstName: true, lastName: true, birthDate: true },
      take: 10
    });
    const memberIds = matches.length
      ? new Set(
          (
            await this.prisma.familyGroupMember.findMany({
              where: {
                familyGroupId: session.familyGroupId!,
                patientId: { in: matches.map((match) => match.id) }
              },
              select: { patientId: true }
            })
          ).map((member) => member.patientId)
        )
      : new Set<string>();
    return {
      status: matches.length ? "MATCHES_FOUND" : "NO_MATCH",
      matches: matches.map((match) => ({
        patientId: match.id,
        displayName: `${match.firstName} ${match.lastName}`,
        ageReference: this.ageReference(match.birthDate),
        alreadyMember: memberIds.has(match.id)
      }))
    };
  }

  async createBookingFamily(
    organizationId: string,
    sessionId: string,
    dto: CreateBookingFamilyDto,
    idempotencyKey?: string
  ) {
    const existingIdempotent = await this.getIdempotentResponse(
      organizationId,
      "BOOKING_CREATE_FAMILY",
      idempotencyKey,
      { sessionId, dto }
    );
    if (existingIdempotent) return existingIdempotent;
    const session = await this.getOpenSession(organizationId, sessionId);
    if (session.source === "WHATSAPP" && !session.contactVerifiedAt)
      throw new ForbiddenException("Debes verificar el telefono antes de crear la familia");
    if (!session.contactPointId) throw new ConflictException("La sesion no tiene telefono asociado");
    if (["AMBIGUOUS", "FAMILY_SHARED"].includes(session.resolution)) {
      throw new ConflictException("La sesion ya tiene resolucion familiar o requiere revision manual");
    }
    await this.ensureBranch(organizationId, dto.branchId);
    const responsibleMatches = await this.findFamilyPersonMatches(
      organizationId,
      dto.branchId,
      dto.responsible.firstName,
      dto.responsible.lastName,
      dto.responsible.birthDate
    );
    if (
      dto.responsible.existingPatientId &&
      !responsibleMatches.some((match) => match.id === dto.responsible.existingPatientId)
    ) {
      throw new ForbiddenException(
        "El responsable seleccionado no coincide con nombre, apellidos y nacimiento"
      );
    }
    if (!dto.responsible.existingPatientId && responsibleMatches.length > 1) {
      throw new ConflictException({
        code: "RESPONSIBLE_MATCHES_FOUND",
        message: "Hay mas de una ficha posible para el responsable. Se requiere seleccion explicita.",
        matches: responsibleMatches.map((match) => ({
          patientId: match.id,
          displayName: `${match.firstName} ${match.lastName}`,
          ageReference: this.ageReference(match.birthDate)
        }))
      });
    }
    const selectedResponsible =
      dto.responsible.existingPatientId ??
      (responsibleMatches.length === 1 ? responsibleMatches[0].id : undefined);
    const memberInputs = dto.members ?? [];
    const duplicateMember = await this.findDuplicateMemberInput(organizationId, dto.branchId, memberInputs);
    if (duplicateMember) {
      throw new ConflictException({
        code: "FAMILY_MEMBER_MATCHES_FOUND",
        message: "Un integrante coincide con una ficha existente. Vincula explicitamente esa ficha.",
        matches: duplicateMember.matches.map((match) => ({
          patientId: match.id,
          displayName: `${match.firstName} ${match.lastName}`,
          ageReference: this.ageReference(match.birthDate)
        }))
      });
    }
    const now = new Date();
    const contactPointId = session.contactPointId;
    const result = await this.prisma.$transaction(async (tx) => {
      const responsibleBirthDate = new Date(dto.responsible.birthDate);
      const responsible = selectedResponsible
        ? await tx.patient.findFirstOrThrow({
            where: { id: selectedResponsible, organizationId, deletedAt: null }
          })
        : await tx.patient.create({
            data: {
              organizationId,
              branchId: dto.branchId,
              firstName: this.normalizeText(dto.responsible.firstName),
              lastName: this.normalizeText(dto.responsible.lastName),
              birthDate: responsibleBirthDate,
              gender: dto.responsible.gender?.trim(),
              phone: session.contactPoint?.normalizedValue.replace(/^\+/, ""),
              status: "PROVISIONAL"
            }
          });
      const group = await tx.familyGroup.create({
        data: {
          organizationId,
          name: this.normalizeText(
            dto.groupName || `Familia ${responsible.lastName || responsible.firstName}`
          ),
          createdById: "booking-bot",
          contacts: {
            create: {
              organizationId,
              contactPointId,
              actorPatientId: responsible.id,
              isPrimary: true
            }
          }
        }
      });
      await tx.contactPoint.update({
        where: { id: contactPointId },
        data: { status: "FAMILY_SHARED", version: { increment: 1 } }
      });
      await this.upsertFamilyMemberAccess(tx, {
        organizationId,
        familyGroupId: group.id,
        patientId: responsible.id,
        contactPointId,
        role: "GROUP_OWNER",
        relationship: "Responsable",
        consentStatus: "ACCEPTED",
        canBook: true,
        canReschedule: true,
        canCancel: true,
        canReceiveReminders: true
      });
      const members = [];
      for (const memberInput of memberInputs) {
        const birthDate = new Date(memberInput.birthDate);
        const isMinor = this.isMinorBirthDate(birthDate);
        const patient = memberInput.existingPatientId
          ? await tx.patient.findFirstOrThrow({
              where: { id: memberInput.existingPatientId, organizationId, deletedAt: null }
            })
          : await tx.patient.create({
              data: {
                organizationId,
                branchId: dto.branchId,
                firstName: this.normalizeText(memberInput.firstName),
                lastName: this.normalizeText(memberInput.lastName),
                birthDate,
                gender: memberInput.gender?.trim(),
                status: "PROVISIONAL"
              }
            });
        const consentStatus = isMinor ? "ACCEPTED" : "PENDING";
        await this.upsertFamilyMemberAccess(tx, {
          organizationId,
          familyGroupId: group.id,
          patientId: patient.id,
          contactPointId,
          role: isMinor ? "MINOR" : "ADULT_MEMBER",
          relationship: memberInput.relationship,
          consentStatus,
          canBook: consentStatus === "ACCEPTED",
          canReceiveReminders: true
        });
        members.push({
          patientId: patient.id,
          displayName: `${patient.firstName} ${patient.lastName}`,
          relationship: memberInput.relationship,
          ageReference: this.ageReference(patient.birthDate),
          consentStatus
        });
      }
      const selectableIds = new Set([
        responsible.id,
        ...members.filter((m) => m.consentStatus === "ACCEPTED").map((m) => m.patientId)
      ]);
      const selectedPatientId =
        dto.selectPatientId && selectableIds.has(dto.selectPatientId) ? dto.selectPatientId : undefined;
      const updatedSession = await tx.bookingIdentitySession.update({
        where: { id: session.id },
        data: {
          familyGroupId: group.id,
          bookingActorPatientId: responsible.id,
          selectedPatientId,
          selectedAt: selectedPatientId ? now : null,
          selectionExpiresAt: selectedPatientId ? this.selectionExpiry(session.expiresAt, now) : null,
          status: selectedPatientId ? "SELECTED" : "PENDING",
          resolution: "FAMILY_SHARED",
          resolutionMethod: selectedPatientId ? "NEW_FAMILY_SELECTED" : "NEW_FAMILY_CREATED",
          confidence: 95,
          metadata: {
            candidatePatientIds: [responsible.id, ...members.map((member) => member.patientId)],
            candidateCount: 1 + members.length
          },
          lastActionAt: now,
          version: { increment: 1 }
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          entity: "FamilyGroup",
          entityId: group.id,
          action: "create_from_booking",
          after: {
            sessionId: session.id,
            contactPointId,
            responsiblePatientId: responsible.id,
            memberCount: members.length
          }
        }
      });
      return {
        ...(await this.sessionResponse(updatedSession)),
        familyGroupId: group.id,
        bookingActorPatientId: responsible.id,
        prompt: "¿Para quién deseas agendar?",
        candidates: [
          {
            patientId: responsible.id,
            displayName: `${responsible.firstName} ${responsible.lastName}`,
            relationship: "Responsable",
            ageReference: this.ageReference(responsible.birthDate),
            familyGroupId: group.id
          },
          ...members.map((member) => ({ ...member, familyGroupId: group.id }))
        ]
      };
    });
    await this.storeIdempotentResponse(
      organizationId,
      "BOOKING_CREATE_FAMILY",
      idempotencyKey,
      { sessionId, dto },
      result
    );
    return result;
  }

  async addBookingFamilyMember(
    organizationId: string,
    sessionId: string,
    dto: AddBookingFamilyMemberDto,
    idempotencyKey?: string
  ) {
    const existingIdempotent = await this.getIdempotentResponse(
      organizationId,
      "BOOKING_ADD_FAMILY_MEMBER",
      idempotencyKey,
      { sessionId, dto }
    );
    if (existingIdempotent) return existingIdempotent;
    const session = await this.requireManageableFamilySession(organizationId, sessionId);
    const lookup = await this.lookupBookingFamilyMember(organizationId, sessionId, dto);
    if (!dto.existingPatientId && lookup.matches.length) return lookup;
    if (dto.existingPatientId && !lookup.matches.some((match) => match.patientId === dto.existingPatientId)) {
      throw new ForbiddenException("El paciente seleccionado no coincide con nombre, apellidos y nacimiento");
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, organizationId, deletedAt: null, status: "ACTIVE" },
      select: { id: true }
    });
    if (!branch) throw new BadRequestException("Sucursal no válida para el nuevo familiar");
    const birthDate = new Date(dto.birthDate);
    const isMinor = this.isMinorBirthDate(birthDate);
    const priorMembership = dto.existingPatientId
      ? await this.prisma.familyGroupMember.findUnique({
          where: {
            familyGroupId_patientId: {
              familyGroupId: session.familyGroupId!,
              patientId: dto.existingPatientId
            }
          },
          select: { consentStatus: true }
        })
      : null;
    const consentStatus = isMinor || priorMembership?.consentStatus === "ACCEPTED" ? "ACCEPTED" : "PENDING";
    const canBook = consentStatus === "ACCEPTED";
    const existingPatient = dto.existingPatientId
      ? await this.ensurePatient(organizationId, dto.existingPatientId)
      : undefined;
    const role = isMinor ? "MINOR" : "ADULT_MEMBER";
    const patient = await this.prisma.$transaction(async (tx) => {
      const resolvedPatient =
        existingPatient ??
        (await tx.patient.create({
          data: {
            organizationId,
            branchId: dto.branchId,
            firstName: this.normalizeText(dto.firstName),
            lastName: this.normalizeText(dto.lastName),
            birthDate,
            status: "PROVISIONAL"
          }
        }));
      await this.upsertFamilyMemberAccess(tx, {
        organizationId,
        familyGroupId: session.familyGroupId!,
        patientId: resolvedPatient.id,
        contactPointId: session.contactPointId!,
        role,
        relationship: dto.relationship,
        consentStatus,
        canBook,
        canReceiveReminders: canBook
      });
      if (canBook) {
        const now = new Date();
        await tx.bookingIdentitySession.update({
          where: { id: session.id },
          data: {
            selectedPatientId: resolvedPatient.id,
            selectedAt: now,
            selectionExpiresAt: this.selectionExpiry(session.expiresAt, now),
            status: "SELECTED",
            resolutionMethod: "NEW_FAMILY_MEMBER",
            lastActionAt: now,
            version: { increment: 1 }
          }
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId,
          entity: "FamilyGroupMember",
          entityId: resolvedPatient.id,
          action: dto.existingPatientId ? "link_existing_from_booking" : "create_from_booking",
          after: {
            familyGroupId: session.familyGroupId,
            patientId: resolvedPatient.id,
            isMinor,
            consentStatus
          }
        }
      });
      return resolvedPatient;
    });
    const result = {
      status: canBook ? "SELECTED" : "CONSENT_REQUIRED",
      patientId: patient.id,
      familyGroupId: session.familyGroupId,
      consentStatus,
      displayName: `${patient.firstName} ${patient.lastName}`,
      ageReference: this.ageReference(patient.birthDate)
    };
    await this.storeIdempotentResponse(
      organizationId,
      "BOOKING_ADD_FAMILY_MEMBER",
      idempotencyKey,
      { sessionId, dto },
      result
    );
    return result;
  }

  async verifySession(organizationId: string, sessionId: string, dto: VerifyBookingIdentityDto) {
    const session = await this.getOpenSession(organizationId, sessionId);
    if (session.source === "WHATSAPP" && !session.contactVerifiedAt) {
      throw new ForbiddenException("Debes verificar el teléfono antes de resolver la identidad");
    }
    if (session.status === "AMBIGUOUS" || session.resolution === "AMBIGUOUS") {
      throw new ConflictException("La identidad requiere revisión manual de recepción");
    }
    if (!dto.documentNumber && !(dto.firstName && dto.lastName && dto.birthDate)) {
      throw new BadRequestException("Se requiere documento o nombre, apellidos y nacimiento");
    }
    const candidateIds = this.candidateIdsFromMetadata(session.metadata);
    const matches = await this.prisma.patient.findMany({
      where: {
        id: { in: candidateIds },
        organizationId,
        deletedAt: null,
        ...(dto.documentNumber
          ? { documentNumber: { equals: dto.documentNumber.trim(), mode: "insensitive" } }
          : {
              firstName: { equals: dto.firstName!.trim(), mode: "insensitive" },
              lastName: { equals: dto.lastName!.trim(), mode: "insensitive" },
              birthDate: new Date(dto.birthDate!)
            })
      },
      select: { id: true, firstName: true, lastName: true }
    });
    const outcome = matches.length === 1 ? "VERIFIED" : matches.length ? "AMBIGUOUS" : "NO_MATCH";
    const updated = await this.prisma.bookingIdentitySession.update({
      where: { id: session.id },
      data: {
        status: outcome === "VERIFIED" ? "VERIFIED" : outcome === "AMBIGUOUS" ? "AMBIGUOUS" : "PENDING",
        resolution:
          outcome === "VERIFIED"
            ? "SINGLE_VERIFIED_MATCH"
            : outcome === "AMBIGUOUS"
              ? "AMBIGUOUS"
              : "MANUAL_REVIEW_REQUIRED",
        confidence: outcome === "VERIFIED" ? 90 : 0,
        attempts: { increment: 1 },
        resolutionMethod: dto.documentNumber ? "DOCUMENT" : "NAME_BIRTH_DATE",
        metadata: {
          candidateCount: matches.length,
          candidatePatientIds: matches.map((patient) => patient.id)
        },
        lastActionAt: new Date(),
        version: { increment: 1 }
      }
    });
    if (outcome === "AMBIGUOUS") {
      await this.ensureAmbiguityIncident(
        session.id,
        organizationId,
        "IDENTITY_ATTRIBUTES_STILL_AMBIGUOUS",
        session.familyGroupId ?? undefined
      );
    }
    return {
      ...(await this.sessionResponse(updated)),
      candidates:
        outcome === "VERIFIED"
          ? matches.map((patient) => ({ patientId: patient.id, maskedName: this.maskName(patient) }))
          : []
    };
  }

  async selectSessionPatient(organizationId: string, sessionId: string, dto: SelectBookingPatientDto) {
    const session = await this.getOpenSession(organizationId, sessionId);
    if (session.source === "WHATSAPP" && !session.contactVerifiedAt)
      throw new ForbiddenException("Debes verificar el teléfono primero");
    if (session.status === "AMBIGUOUS" || session.resolution === "AMBIGUOUS") {
      throw new ConflictException("La conversación está bloqueada para revisión manual");
    }
    if (session.status === "SELECTED" && session.selectedPatientId === dto.patientId)
      return this.sessionResponse(session);
    const authorization = await this.authorizeSessionPatient(session, dto.patientId);
    const now = new Date();
    const updated = await this.prisma.bookingIdentitySession.update({
      where: { id: session.id },
      data: {
        selectedPatientId: dto.patientId,
        familyGroupId: authorization.familyGroupId,
        bookingActorPatientId: authorization.actorPatientId ?? session.bookingActorPatientId,
        status: "SELECTED",
        resolutionMethod: dto.resolutionMethod ?? "EXPLICIT_SELECTION",
        confidence: Math.max(session.confidence, 85),
        selectedAt: now,
        selectionExpiresAt: this.selectionExpiry(session.expiresAt, now),
        lastActionAt: now,
        version: { increment: 1 }
      }
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        entity: "BookingIdentitySession",
        entityId: session.id,
        action: session.selectedPatientId ? "change_selected_patient" : "select_patient",
        before: session.selectedPatientId ? { patientId: session.selectedPatientId } : undefined,
        after: {
          patientId: dto.patientId,
          familyGroupId: authorization.familyGroupId,
          method: updated.resolutionMethod
        }
      }
    });
    return this.sessionResponse(updated);
  }

  async getSelectedPatientForSession(organizationId: string, sessionId: string) {
    const session = await this.getOpenSession(organizationId, sessionId);
    if (session.status !== "SELECTED" || !session.selectedPatientId) {
      throw new ConflictException("La sesión todavía no tiene un paciente seleccionado");
    }
    const patient = await this.ensurePatient(organizationId, session.selectedPatientId);
    return { session, patient };
  }

  async getSessionState(organizationId: string, sessionId: string) {
    return this.getOpenSession(organizationId, sessionId);
  }

  async attachNewPatientToSession(organizationId: string, sessionId: string, patientId: string) {
    const session = await this.getOpenSession(organizationId, sessionId);
    if (!["NO_MATCH", "MANUAL_REVIEW_REQUIRED"].includes(session.resolution)) {
      throw new ConflictException("La sesión tiene candidatos existentes y no permite crear otra ficha");
    }
    await this.ensurePatient(organizationId, patientId);
    const now = new Date();
    return this.prisma.bookingIdentitySession.update({
      where: { id: session.id },
      data: {
        selectedPatientId: patientId,
        status: "SELECTED",
        resolutionMethod: "NEW_PROVISIONAL_PATIENT",
        confidence: 70,
        selectedAt: now,
        selectionExpiresAt: this.selectionExpiry(session.expiresAt, now),
        lastActionAt: now,
        version: { increment: 1 }
      },
      include: { contactPoint: true }
    });
  }

  async bookResolvedAppointment(
    organizationId: string,
    sessionId: string,
    dto: BookResolvedAppointmentDto,
    idempotencyKey: string,
    correlationId?: string
  ) {
    if (!idempotencyKey?.trim()) throw new BadRequestException("idempotency-key es obligatorio");
    const sessionRecord = await this.prisma.bookingIdentitySession.findFirst({
      where: { id: sessionId, organizationId }
    });
    if (!sessionRecord) throw new NotFoundException("Sesión de identidad no encontrada");
    const requestHash = createHash("sha256").update(JSON.stringify({ sessionId, dto })).digest("hex");
    const existing = await this.prisma.bookingIdempotency.findUnique({
      where: {
        organizationId_source_idempotencyKey: { organizationId, source: sessionRecord.source, idempotencyKey }
      }
    });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new ConflictException("La clave de idempotencia fue usada con otro contenido");
      if (existing.appointmentId) {
        if (existing.status !== "COMPLETED") {
          await this.completeBookingContext(
            sessionRecord,
            existing.appointmentId,
            existing.id,
            correlationId
          );
        }
        const retryActor = await this.getSystemActor(organizationId, dto.branchId);
        return this.appointmentsService.findOne(retryActor, existing.appointmentId);
      }
      throw new ConflictException("La solicitud ya está siendo procesada");
    }
    const session = await this.getOpenSession(organizationId, sessionId);
    if (session.status !== "SELECTED" || !session.selectedPatientId)
      throw new ConflictException("Debe seleccionar explícitamente al paciente");
    const familyAuthorization = session.familyGroupId
      ? await this.authorizeSessionPatient(session, session.selectedPatientId)
      : undefined;
    const actor = await this.getSystemActor(organizationId, dto.branchId);
    let idempotency;
    try {
      idempotency = await this.prisma.bookingIdempotency.create({
        data: { organizationId, source: session.source, idempotencyKey, requestHash }
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const raced = await this.prisma.bookingIdempotency.findUnique({
        where: {
          organizationId_source_idempotencyKey: { organizationId, source: session.source, idempotencyKey }
        }
      });
      if (!raced || raced.requestHash !== requestHash)
        throw new ConflictException("La clave de idempotencia fue usada con otro contenido");
      if (raced.appointmentId) {
        if (raced.status !== "COMPLETED") {
          await this.completeBookingContext(
            session,
            raced.appointmentId,
            raced.id,
            correlationId,
            familyAuthorization?.relationship
          );
        }
        return this.appointmentsService.findOne(actor, raced.appointmentId);
      }
      throw new ConflictException("La solicitud ya está siendo procesada");
    }
    let createdAppointmentId: string | undefined;
    try {
      const appointment = await this.appointmentsService.create(actor, {
        branchId: dto.branchId,
        patientId: session.selectedPatientId,
        professionalId: dto.professionalId,
        chairId: dto.chairId,
        chairIndex: dto.chairIndex,
        attendanceMode: dto.attendanceMode,
        specialtyId: dto.specialtyId,
        title: dto.title,
        reason: dto.reason,
        status: dto.status,
        startAt: dto.startAt,
        endAt: dto.endAt,
        durationMinutes: dto.durationMinutes,
        notes: dto.notes
      });
      createdAppointmentId = appointment.id;
      await this.completeBookingContext(
        session,
        appointment.id,
        idempotency.id,
        correlationId,
        familyAuthorization?.relationship
      );
      return appointment;
    } catch (error) {
      await this.prisma.bookingIdempotency
        .update({
          where: { id: idempotency.id },
          data: createdAppointmentId
            ? {
                status: "METADATA_PENDING",
                appointmentId: createdAppointmentId,
                response: { appointmentId: createdAppointmentId }
              }
            : { status: "FAILED" }
        })
        .catch(() => undefined);
      throw error;
    }
  }

  private async completeBookingContext(
    session: {
      id: string;
      organizationId: string;
      bookingActorPatientId: string | null;
      contactPointId: string | null;
      familyGroupId: string | null;
      source: string;
      resolutionMethod: string | null;
      confidence: number;
      conversationId: string | null;
    },
    appointmentId: string,
    idempotencyId: string,
    correlationId?: string,
    relationship?: string
  ) {
    const actorData = {
      organizationId: session.organizationId,
      actorType: session.familyGroupId ? "FAMILY_MEMBER" : "CHANNEL_CONTACT",
      actorPatientId: session.bookingActorPatientId,
      contactPointId: session.contactPointId,
      familyGroupId: session.familyGroupId,
      relationship,
      bookingSource: session.source,
      identityResolutionMethod: session.resolutionMethod ?? "EXPLICIT_SELECTION",
      identityConfidence: session.confidence,
      conversationId: session.conversationId,
      correlationId
    };
    await this.prisma.$transaction([
      this.prisma.appointmentBookingActor.upsert({
        where: { appointmentId },
        create: { appointmentId, ...actorData },
        update: actorData
      }),
      this.prisma.bookingIdempotency.update({
        where: { id: idempotencyId },
        data: { status: "COMPLETED", appointmentId, response: { appointmentId } }
      }),
      this.prisma.bookingIdentitySession.update({
        where: { id: session.id },
        data: { status: "COMPLETED", version: { increment: 1 } }
      })
    ]);
  }

  async createMergePreview(actor: AuthUser, dto: MergePreviewDto) {
    await this.assertFeature(actor.organizationId, "safeMergeEnabled");
    if (dto.targetPatientId === dto.sourcePatientId)
      throw new BadRequestException("Selecciona pacientes distintos");
    const [target, source] = await Promise.all([
      this.ensurePatient(actor.organizationId, dto.targetPatientId, actor.branchIds, true),
      this.ensurePatient(actor.organizationId, dto.sourcePatientId, actor.branchIds, true)
    ]);
    const counts = await this.mergeDependencyCounts(dto.sourcePatientId);
    const preview = {
      target: this.patientSnapshot(target),
      source: this.patientSnapshot(source),
      counts,
      warnings: [
        ...(target.branchId !== source.branchId ? ["DIFFERENT_BRANCHES"] : []),
        ...(target.documentNumber && source.documentNumber && target.documentNumber !== source.documentNumber
          ? ["DOCUMENT_CONFLICT"]
          : [])
      ]
    };
    const merge = await this.prisma.patientMerge.create({
      data: {
        organizationId: actor.organizationId,
        targetPatientId: target.id,
        sourcePatientId: source.id,
        reason: dto.reason.trim(),
        preview,
        correlationId: dto.correlationId
      }
    });
    await this.audit(actor.organizationId, actor.id, "PatientMerge", merge.id, "preview", null, preview);
    return merge;
  }

  async executeMerge(actor: AuthUser, mergeId: string, dto: ExecuteMergeDto) {
    await this.assertFeature(actor.organizationId, "safeMergeEnabled");
    const merge = await this.prisma.patientMerge.findFirst({
      where: { id: mergeId, organizationId: actor.organizationId }
    });
    if (!merge) throw new NotFoundException("Vista previa de fusión no encontrada");
    if (merge.status !== "PREVIEW") throw new ConflictException("La fusión ya fue procesada");
    if (merge.version !== dto.expectedVersion)
      throw new ConflictException("La vista previa cambió; vuelve a generarla");

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.patientMerge.updateMany({
        where: { id: merge.id, status: "PREVIEW", version: dto.expectedVersion },
        data: { status: "PROCESSING", version: { increment: 1 } }
      });
      if (!claimed.count) throw new ConflictException("La fusión ya está en proceso");

      const relationRows = await this.captureMergeRelations(
        tx,
        merge.id,
        merge.sourcePatientId,
        merge.targetPatientId
      );
      if (relationRows.length) await tx.patientMergeRelation.createMany({ data: relationRows });

      await Promise.all([
        tx.patientContact.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.patientMedicalAlert.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.patientNote.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.appointment.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.medicalCondition.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.allergy.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.medication.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.clinicalEvolution.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.prescription.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.clinicalDocument.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.odontogramRecord.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.toothCondition.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.toothProcedure.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.periodontalChart.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.treatmentPlan.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.budget.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.payment.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.paymentLink.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.installmentPlan.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.installment.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.refund.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.collectionCase.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.patientTask.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.fileAttachment.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.radiographyAnalysis.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.consent.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.labOrder.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.communicationJob.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.survey.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.chatMessage.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.telemedicineSession.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.documentRequirement.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.aiRequest.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.patientLedgerEntry.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.financialDocument.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.coverageCase.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.patientBenefitCoverage.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.patientBenefitCoverageValidation.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.patientBenefitCoverageAudit.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.patientBenefitCoverageDocument.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.payrollDiscount.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.inventoryMovement.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.inventoryProductSale.updateMany({
          where: { patientId: merge.sourcePatientId },
          data: { patientId: merge.targetPatientId }
        }),
        tx.bookingIdentitySession.updateMany({
          where: { selectedPatientId: merge.sourcePatientId },
          data: { selectedPatientId: merge.targetPatientId }
        }),
        tx.appointmentBookingActor.updateMany({
          where: { actorPatientId: merge.sourcePatientId },
          data: { actorPatientId: merge.targetPatientId }
        })
      ]);

      await this.mergeUniquePatientRelations(tx, merge.sourcePatientId, merge.targetPatientId);
      const target = await tx.patient.findUniqueOrThrow({ where: { id: merge.targetPatientId } });
      const source = await tx.patient.findUniqueOrThrow({ where: { id: merge.sourcePatientId } });
      await tx.patient.update({
        where: { id: target.id },
        data: {
          agreementId: target.agreementId ?? source.agreementId,
          phone: target.phone ?? source.phone,
          email: target.email ?? source.email,
          birthDate: target.birthDate ?? source.birthDate
        }
      });
      await tx.patient.update({
        where: { id: source.id },
        data: { status: "MERGED", deletedAt: new Date() }
      });
      await tx.patientDuplicateCandidate.updateMany({
        where: {
          organizationId: actor.organizationId,
          OR: [
            { patientAId: target.id, patientBId: source.id },
            { patientAId: source.id, patientBId: target.id }
          ]
        },
        data: {
          status: "MERGED",
          reviewedById: actor.id,
          reviewedAt: new Date(),
          reviewReason: merge.reason,
          version: { increment: 1 }
        }
      });
      await tx.patientMerge.update({
        where: { id: merge.id },
        data: {
          status: "COMPLETED",
          executedById: actor.id,
          executedAt: new Date(),
          version: { increment: 1 }
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "PatientMerge",
          entityId: merge.id,
          action: "execute",
          reason: merge.reason,
          after: {
            targetPatientId: target.id,
            sourcePatientId: source.id,
            relationCount: relationRows.length
          }
        }
      });
    });
    return this.prisma.patientMerge.findUnique({ where: { id: merge.id }, include: { relations: true } });
  }

  private async resolveContactCandidates(organizationId: string, contactPointId: string) {
    const now = new Date();
    const [links, familyContacts] = await Promise.all([
      this.prisma.patientContactLink.findMany({
        where: {
          organizationId,
          contactPointId,
          ...ACTIVE_LINK_WHERE(),
          patient: { deletedAt: null, status: { notIn: ["INACTIVE", "MERGED"] } }
        },
        include: { patient: { select: { id: true, firstName: true, lastName: true, birthDate: true } } }
      }),
      this.prisma.familyGroupContact.findMany({
        where: {
          organizationId,
          contactPointId,
          familyGroup: { status: "ACTIVE" }
        },
        include: {
          familyGroup: {
            include: {
              members: {
                where: { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
                include: {
                  patient: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      birthDate: true,
                      deletedAt: true,
                      status: true
                    }
                  }
                }
              },
              bookingGrants: {
                where: {
                  actorContactPointId: contactPointId,
                  canBook: true,
                  consentStatus: "ACCEPTED",
                  validFrom: { lte: now },
                  OR: [{ validUntil: null }, { validUntil: { gt: now } }]
                }
              }
            }
          }
        }
      })
    ]);
    if (familyContacts.length > 1) {
      return {
        resolution: "AMBIGUOUS",
        confidence: 0,
        familyGroupId: undefined,
        actorPatientId: undefined,
        candidates: [] as CandidateSummary[]
      };
    }
    const familyContact = familyContacts[0];
    if (familyContact) {
      const members = new Map(familyContact.familyGroup.members.map((member) => [member.patientId, member]));
      if (links.some((link) => !members.has(link.patientId))) {
        return {
          resolution: "AMBIGUOUS",
          confidence: 0,
          familyGroupId: undefined,
          actorPatientId: undefined,
          candidates: [] as CandidateSummary[]
        };
      }
      const candidates = familyContact.familyGroup.bookingGrants.flatMap((grant) => {
        const member = members.get(grant.patientId);
        if (
          !member ||
          member.consentStatus !== "ACCEPTED" ||
          member.patient.deletedAt ||
          ["INACTIVE", "MERGED"].includes(member.patient.status)
        )
          return [];
        return [
          {
            patientId: member.patientId,
            maskedName: this.maskName(member.patient),
            displayName: `${member.patient.firstName} ${member.patient.lastName}`,
            ageReference: this.ageReference(member.patient.birthDate),
            relationship: member.relationship ?? member.role,
            familyGroupId: familyContact.familyGroupId,
            permissions: {
              canBookAppointments: grant.canBook,
              canRescheduleAppointments: grant.canReschedule,
              canCancelAppointments: grant.canCancel,
              canReceiveReminders: grant.canReceiveReminders,
              canViewAppointmentSummary: grant.canViewAppointmentSummary,
              canViewFinancialInformation: grant.canViewFinancialInformation,
              canViewClinicalInformation: grant.canViewClinicalInformation,
              canSignConsents: grant.canSignConsents
            }
          } satisfies CandidateSummary
        ];
      });
      const owner = familyContact.familyGroup.members.find((member) => member.role === "GROUP_OWNER");
      return {
        resolution: "FAMILY_SHARED",
        confidence: 95,
        familyGroupId: familyContact.familyGroupId,
        actorPatientId: familyContact.actorPatientId ?? owner?.patientId,
        candidates
      };
    }
    if (links.length > 1) {
      return {
        resolution: "AMBIGUOUS",
        confidence: 0,
        familyGroupId: undefined,
        actorPatientId: undefined,
        candidates: [] as CandidateSummary[]
      };
    }
    const candidates: CandidateSummary[] = links.map((link) => ({
      patientId: link.patientId,
      maskedName: this.maskName(link.patient),
      relationship: link.role
    }));
    return {
      resolution: candidates.length ? "SINGLE_CONTACT_MATCH" : "NO_MATCH",
      confidence: candidates.length ? 60 : 0,
      familyGroupId: undefined,
      actorPatientId: undefined,
      candidates
    };
  }

  private async sessionResponse(session: {
    id: string;
    status: string;
    resolution: string;
    confidence: number;
    expiresAt: Date;
    selectedPatientId: string | null;
    familyGroupId?: string | null;
    bookingActorPatientId?: string | null;
    contactVerifiedAt?: Date | null;
    selectionExpiresAt?: Date | null;
  }) {
    return {
      id: session.id,
      status: session.status,
      resolution: session.resolution,
      confidence: session.confidence,
      expiresAt: session.expiresAt,
      hasSelectedPatient: Boolean(session.selectedPatientId),
      selectedPatientId: session.selectedPatientId ?? undefined,
      familyGroupId: session.familyGroupId ?? undefined,
      bookingActorPatientId: session.bookingActorPatientId ?? undefined,
      contactVerified: Boolean(session.contactVerifiedAt),
      selectionExpiresAt: session.selectionExpiresAt ?? undefined
    };
  }

  private async getOpenSession(organizationId: string, id: string) {
    const session = await this.prisma.bookingIdentitySession.findFirst({
      where: { id, organizationId },
      include: { contactPoint: true }
    });
    if (!session) throw new NotFoundException("Sesión de identidad no encontrada");
    if (session.expiresAt <= new Date()) throw new ConflictException("La sesión de identidad expiró");
    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(session.status))
      throw new ConflictException("La sesión ya terminó");
    if (session.selectedPatientId && session.selectionExpiresAt && session.selectionExpiresAt <= new Date()) {
      await this.prisma.bookingIdentitySession.update({
        where: { id: session.id },
        data: {
          selectedPatientId: null,
          selectedAt: null,
          selectionExpiresAt: null,
          status: "EXPIRED",
          version: { increment: 1 }
        }
      });
      throw new ConflictException("La selección del paciente expiró; inicia una nueva resolución");
    }
    return session;
  }

  private async authorizeSessionPatient(
    session: {
      organizationId: string;
      contactPointId: string | null;
      familyGroupId: string | null;
      bookingActorPatientId: string | null;
      resolution: string;
      metadata: Prisma.JsonValue | null;
    },
    patientId: string
  ) {
    if (session.familyGroupId) {
      if (!session.contactPointId) throw new ForbiddenException("El grupo no tiene contacto verificado");
      const grant = await this.prisma.familyBookingGrant.findFirst({
        where: {
          organizationId: session.organizationId,
          familyGroupId: session.familyGroupId,
          actorContactPointId: session.contactPointId,
          patientId,
          canBook: true,
          consentStatus: "ACCEPTED",
          validFrom: { lte: new Date() },
          OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }]
        }
      });
      if (!grant)
        throw new ForbiddenException(
          "El integrante no tiene permiso para agendar o no otorgó consentimiento"
        );
      const member = await this.prisma.familyGroupMember.findFirst({
        where: {
          familyGroupId: session.familyGroupId,
          patientId,
          consentStatus: "ACCEPTED",
          OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }]
        },
        select: { relationship: true, role: true }
      });
      if (!member) throw new ForbiddenException("El integrante no está activo en el grupo familiar");
      return {
        familyGroupId: session.familyGroupId,
        actorPatientId: session.bookingActorPatientId ?? undefined,
        relationship: member.relationship ?? member.role
      };
    }
    if (session.resolution !== "SINGLE_VERIFIED_MATCH") {
      throw new ForbiddenException("La identidad individual debe verificarse antes de seleccionar paciente");
    }
    if (!this.candidateIdsFromMetadata(session.metadata).includes(patientId)) {
      throw new ForbiddenException("El paciente no está autorizado para esta conversación");
    }
    return { familyGroupId: undefined, actorPatientId: undefined, relationship: undefined };
  }

  private async requireManageableFamilySession(organizationId: string, sessionId: string) {
    const session = await this.getOpenSession(organizationId, sessionId);
    if (!session.contactVerifiedAt)
      throw new ForbiddenException("Debes verificar el teléfono antes de gestionar familiares");
    if (
      !session.familyGroupId ||
      !session.contactPointId ||
      !session.bookingActorPatientId ||
      session.resolution !== "FAMILY_SHARED"
    ) {
      throw new ConflictException("La conversación no corresponde a un grupo familiar autorizado");
    }
    const manager = await this.prisma.familyGroupMember.findFirst({
      where: {
        familyGroupId: session.familyGroupId,
        patientId: session.bookingActorPatientId,
        role: { in: ["GROUP_OWNER", "GROUP_MANAGER", "GUARDIAN"] },
        consentStatus: "ACCEPTED",
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }]
      },
      select: { id: true }
    });
    if (!manager) throw new ForbiddenException("El responsable no puede agregar familiares");
    return session;
  }

  private async recordChannelVerification(
    organizationId: string,
    contactPointId: string,
    method: string,
    providerEventId?: string,
    provider?: string
  ) {
    if (providerEventId) {
      const existing = await this.prisma.contactVerificationEvent.findFirst({
        where: { organizationId, providerEventId, outcome: "VERIFIED" },
        select: { id: true }
      });
      if (existing) return;
    }
    const contactPoint = await this.ensureContactPoint(organizationId, contactPointId);
    await this.prisma.$transaction([
      this.prisma.contactPoint.update({
        where: { id: contactPointId },
        data: {
          verifiedAt: new Date(),
          provider: provider ?? method,
          status: ["FAMILY_SHARED", "AMBIGUOUS"].includes(contactPoint.status)
            ? contactPoint.status
            : "VERIFIED",
          version: { increment: 1 }
        }
      }),
      this.prisma.contactVerificationEvent.create({
        data: {
          organizationId,
          contactPointId,
          method,
          outcome: "VERIFIED",
          provider: provider ?? method,
          providerEventId,
          actorType: "BOOKING_CHANNEL"
        }
      })
    ]);
  }

  private async ensureAmbiguityIncident(
    sessionId: string,
    organizationId: string,
    reasonCode: string,
    familyGroupId?: string,
    metadata?: Prisma.InputJsonValue
  ) {
    return this.prisma.bookingIdentityIncident.upsert({
      where: { sessionId },
      create: { organizationId, sessionId, familyGroupId, reasonCode, metadata, privacyMode: true },
      update: { reasonCode, metadata, status: "OPEN", privacyMode: true }
    });
  }

  private candidateIdsFromMetadata(metadata: Prisma.JsonValue | null) {
    if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") return [];
    const value = metadata as Record<string, Prisma.JsonValue>;
    return Array.isArray(value.candidatePatientIds)
      ? value.candidatePatientIds.filter((id): id is string => typeof id === "string")
      : [];
  }

  private ageReference(birthDate?: Date | null) {
    if (!birthDate) return "Edad no registrada";
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const beforeBirthday =
      now.getMonth() < birthDate.getMonth() ||
      (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate());
    if (beforeBirthday) age -= 1;
    return `${Math.max(age, 0)} años`;
  }

  private isMinorBirthDate(birthDate: Date) {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 18);
    return birthDate > cutoff;
  }

  private selectionExpiry(sessionExpiresAt: Date, selectedAt: Date) {
    return new Date(Math.min(sessionExpiresAt.getTime(), selectedAt.getTime() + SELECTION_TTL_MS));
  }

  private async assertFeature(organizationId: string, key: "familyGroupsEnabled" | "safeMergeEnabled") {
    const config = await this.getConfig(organizationId);
    if (!config[key]) throw new ServiceUnavailableException(`Feature flag ${key} no está habilitado`);
  }

  private async ensureBranch(organizationId: string, branchId: string, branchIds?: string[]) {
    if (branchIds?.length && !branchIds.includes(branchId)) {
      throw new ForbiddenException("La sucursal no pertenece al usuario");
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId, deletedAt: null, status: "ACTIVE" },
      select: { id: true }
    });
    if (!branch) throw new BadRequestException("Sucursal no valida");
    return branch;
  }

  private async findFamilyPersonMatches(
    organizationId: string,
    branchId: string,
    firstName: string,
    lastName: string,
    birthDate: string
  ) {
    return this.prisma.patient.findMany({
      where: {
        organizationId,
        branchId,
        deletedAt: null,
        status: { notIn: ["INACTIVE", "MERGED"] },
        firstName: { equals: firstName.trim(), mode: "insensitive" },
        lastName: { equals: lastName.trim(), mode: "insensitive" },
        birthDate: new Date(birthDate)
      },
      select: { id: true, firstName: true, lastName: true, birthDate: true },
      take: 10
    });
  }

  private async findDuplicateMemberInput(
    organizationId: string,
    branchId: string,
    members: Array<{ existingPatientId?: string; firstName: string; lastName: string; birthDate: string }>
  ) {
    for (const member of members) {
      if (member.existingPatientId) continue;
      const matches = await this.findFamilyPersonMatches(
        organizationId,
        branchId,
        member.firstName,
        member.lastName,
        member.birthDate
      );
      if (matches.length) return { member, matches };
    }
    return null;
  }

  private async upsertFamilyMemberAccess(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      familyGroupId: string;
      patientId: string;
      contactPointId: string;
      role: string;
      relationship: string;
      consentStatus: string;
      canBook: boolean;
      canReschedule?: boolean;
      canCancel?: boolean;
      canReceiveReminders: boolean;
    }
  ) {
    await tx.familyGroupMember.upsert({
      where: { familyGroupId_patientId: { familyGroupId: input.familyGroupId, patientId: input.patientId } },
      create: {
        organizationId: input.organizationId,
        familyGroupId: input.familyGroupId,
        patientId: input.patientId,
        role: input.role,
        relationship: input.relationship.trim(),
        consentStatus: input.consentStatus
      },
      update: {
        role: input.role,
        relationship: input.relationship.trim(),
        consentStatus: input.consentStatus,
        validUntil: null,
        version: { increment: 1 }
      }
    });
    await tx.familyBookingGrant.upsert({
      where: {
        familyGroupId_actorContactPointId_patientId: {
          familyGroupId: input.familyGroupId,
          actorContactPointId: input.contactPointId,
          patientId: input.patientId
        }
      },
      create: {
        organizationId: input.organizationId,
        familyGroupId: input.familyGroupId,
        actorContactPointId: input.contactPointId,
        patientId: input.patientId,
        canBook: input.canBook,
        canReschedule: input.canReschedule ?? false,
        canCancel: input.canCancel ?? false,
        canReceiveReminders: input.canReceiveReminders,
        canViewAppointmentSummary: input.canBook,
        consentStatus: input.consentStatus
      },
      update: {
        canBook: input.canBook,
        canReschedule: input.canReschedule,
        canCancel: input.canCancel,
        canReceiveReminders: input.canReceiveReminders,
        canViewAppointmentSummary: input.canBook,
        consentStatus: input.consentStatus,
        validUntil: null,
        version: { increment: 1 }
      }
    });
    await tx.patientContactLink.upsert({
      where: {
        patientId_contactPointId_role: {
          patientId: input.patientId,
          contactPointId: input.contactPointId,
          role: "SHARED_FAMILY"
        }
      },
      create: {
        organizationId: input.organizationId,
        patientId: input.patientId,
        contactPointId: input.contactPointId,
        role: "SHARED_FAMILY",
        isPrimary: false,
        canReceiveReminders: input.canReceiveReminders,
        consentStatus: input.consentStatus
      },
      update: {
        validUntil: null,
        consentStatus: input.consentStatus,
        canReceiveReminders: input.canReceiveReminders,
        version: { increment: 1 }
      }
    });
  }

  private idempotencyHash(payload: unknown) {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  private async getIdempotentResponse(
    organizationId: string,
    source: string,
    idempotencyKey: string | undefined,
    payload: unknown
  ) {
    if (!idempotencyKey?.trim()) return null;
    const requestHash = this.idempotencyHash(payload);
    const existing = await this.prisma.bookingIdempotency.findUnique({
      where: {
        organizationId_source_idempotencyKey: {
          organizationId,
          source,
          idempotencyKey: idempotencyKey.trim()
        }
      }
    });
    if (!existing) {
      try {
        await this.prisma.bookingIdempotency.create({
          data: {
            organizationId,
            source,
            idempotencyKey: idempotencyKey.trim(),
            requestHash,
            status: "PROCESSING"
          }
        });
        return null;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        const raced = await this.prisma.bookingIdempotency.findUnique({
          where: {
            organizationId_source_idempotencyKey: {
              organizationId,
              source,
              idempotencyKey: idempotencyKey.trim()
            }
          }
        });
        if (!raced || raced.requestHash !== requestHash)
          throw new ConflictException("La clave de idempotencia fue usada con otro contenido");
        if (raced.response) return raced.response;
        throw new ConflictException("La solicitud ya esta siendo procesada");
      }
    }
    if (existing.requestHash !== requestHash)
      throw new ConflictException("La clave de idempotencia fue usada con otro contenido");
    if (existing.response) return existing.response;
    throw new ConflictException("La solicitud ya esta siendo procesada");
  }

  private async storeIdempotentResponse(
    organizationId: string,
    source: string,
    idempotencyKey: string | undefined,
    payload: unknown,
    response: unknown
  ) {
    if (!idempotencyKey?.trim()) return;
    await this.prisma.bookingIdempotency.upsert({
      where: {
        organizationId_source_idempotencyKey: {
          organizationId,
          source,
          idempotencyKey: idempotencyKey.trim()
        }
      },
      create: {
        organizationId,
        source,
        idempotencyKey: idempotencyKey.trim(),
        requestHash: this.idempotencyHash(payload),
        status: "COMPLETED",
        response: response as Prisma.InputJsonValue
      },
      update: { status: "COMPLETED", response: response as Prisma.InputJsonValue }
    });
  }

  private async ensurePatient(
    organizationId: string,
    id: string,
    branchIds?: string[],
    allowInactive = false
  ): Promise<Patient> {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id,
        organizationId,
        ...(branchIds?.length ? { branchId: { in: branchIds } } : {}),
        ...(!allowInactive ? { deletedAt: null, status: { notIn: ["INACTIVE", "MERGED"] } } : {})
      }
    });
    if (!patient) throw new NotFoundException("Paciente no encontrado");
    return patient;
  }

  private async ensureContactPoint(organizationId: string, id: string) {
    const row = await this.prisma.contactPoint.findFirst({ where: { id, organizationId } });
    if (!row) throw new NotFoundException("Medio de contacto no encontrado");
    return row;
  }

  private async isMinor(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { birthDate: true }
    });
    if (!patient?.birthDate) return false;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 18);
    return patient.birthDate > cutoff;
  }

  private async getSystemActor(organizationId: string, branchId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        organizationId,
        isActive: true,
        status: "ACTIVE",
        deletedAt: null,
        branches: { some: { branchId } }
      },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        branches: true,
        permissions: { include: { permission: true } }
      },
      orderBy: { email: "asc" }
    });
    if (!user) throw new InternalServerErrorException("No hay actor del sistema configurado para reservas");
    const permissions = new Set<string>();
    user.permissions.forEach((entry) => permissions.add(entry.permissionId));
    user.role?.permissions.forEach((entry) => permissions.add(entry.permissionId));
    user.roles.forEach((entry) =>
      entry.role.permissions.forEach((permission) => permissions.add(permission.permissionId))
    );
    return {
      id: user.id,
      organizationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleIds: [
        ...new Set([...(user.roleId ? [user.roleId] : []), ...user.roles.map((entry) => entry.roleId)])
      ],
      roleNames: [
        ...new Set([
          ...(user.role?.name ? [user.role.name] : []),
          ...user.roles.map((entry) => entry.role.name)
        ])
      ],
      permissions: [...permissions],
      branchIds: user.branches.map((entry) => entry.branchId)
    };
  }

  private async mergeDependencyCounts(sourcePatientId: string) {
    const [
      appointments,
      treatmentPlans,
      payments,
      documents,
      communications,
      contacts,
      memberships,
      ledgers,
      coverages
    ] = await Promise.all([
      this.prisma.appointment.count({ where: { patientId: sourcePatientId } }),
      this.prisma.treatmentPlan.count({ where: { patientId: sourcePatientId } }),
      this.prisma.payment.count({ where: { patientId: sourcePatientId } }),
      this.prisma.clinicalDocument.count({ where: { patientId: sourcePatientId } }),
      this.prisma.communicationJob.count({ where: { patientId: sourcePatientId } }),
      this.prisma.patientContactLink.count({ where: { patientId: sourcePatientId } }),
      this.prisma.familyGroupMember.count({ where: { patientId: sourcePatientId } }),
      this.prisma.patientLedgerEntry.count({ where: { patientId: sourcePatientId } }),
      this.prisma.patientBenefitCoverage.count({ where: { patientId: sourcePatientId } })
    ]);
    return {
      appointments,
      treatmentPlans,
      payments,
      documents,
      communications,
      contacts,
      memberships,
      ledgers,
      coverages
    };
  }

  private async captureMergeRelations(
    tx: Prisma.TransactionClient,
    mergeId: string,
    sourcePatientId: string,
    targetPatientId: string
  ) {
    const [appointments, treatmentPlans, payments, documents] = await Promise.all([
      tx.appointment.findMany({ where: { patientId: sourcePatientId }, select: { id: true } }),
      tx.treatmentPlan.findMany({ where: { patientId: sourcePatientId }, select: { id: true } }),
      tx.payment.findMany({ where: { patientId: sourcePatientId }, select: { id: true } }),
      tx.clinicalDocument.findMany({ where: { patientId: sourcePatientId }, select: { id: true } })
    ]);
    return [
      ...appointments.map((row) => ({
        mergeId,
        entity: "Appointment",
        recordId: row.id,
        oldPatientId: sourcePatientId,
        newPatientId: targetPatientId
      })),
      ...treatmentPlans.map((row) => ({
        mergeId,
        entity: "TreatmentPlan",
        recordId: row.id,
        oldPatientId: sourcePatientId,
        newPatientId: targetPatientId
      })),
      ...payments.map((row) => ({
        mergeId,
        entity: "Payment",
        recordId: row.id,
        oldPatientId: sourcePatientId,
        newPatientId: targetPatientId
      })),
      ...documents.map((row) => ({
        mergeId,
        entity: "ClinicalDocument",
        recordId: row.id,
        oldPatientId: sourcePatientId,
        newPatientId: targetPatientId
      }))
    ];
  }

  private async mergeUniquePatientRelations(
    tx: Prisma.TransactionClient,
    sourcePatientId: string,
    targetPatientId: string
  ) {
    const [targetAddress, targetHistory, sourceLinks, sourceMemberships, sourceGrants] = await Promise.all([
      tx.patientAddress.findUnique({ where: { patientId: targetPatientId } }),
      tx.medicalHistory.findUnique({ where: { patientId: targetPatientId } }),
      tx.patientContactLink.findMany({ where: { patientId: sourcePatientId } }),
      tx.familyGroupMember.findMany({ where: { patientId: sourcePatientId } }),
      tx.familyBookingGrant.findMany({ where: { patientId: sourcePatientId } })
    ]);
    if (!targetAddress)
      await tx.patientAddress.updateMany({
        where: { patientId: sourcePatientId },
        data: { patientId: targetPatientId }
      });
    if (!targetHistory)
      await tx.medicalHistory.updateMany({
        where: { patientId: sourcePatientId },
        data: { patientId: targetPatientId }
      });
    for (const link of sourceLinks) {
      await tx.patientContactLink.upsert({
        where: {
          patientId_contactPointId_role: {
            patientId: targetPatientId,
            contactPointId: link.contactPointId,
            role: link.role
          }
        },
        create: { ...link, id: undefined, patientId: targetPatientId },
        update: {
          isPrimary: link.isPrimary,
          canReceiveReminders: link.canReceiveReminders,
          consentStatus: link.consentStatus,
          version: { increment: 1 }
        }
      });
      await tx.patientContactLink.delete({ where: { id: link.id } });
    }
    for (const member of sourceMemberships) {
      await tx.familyGroupMember.upsert({
        where: {
          familyGroupId_patientId: { familyGroupId: member.familyGroupId, patientId: targetPatientId }
        },
        create: { ...member, id: undefined, patientId: targetPatientId },
        update: {
          role: member.role,
          relationship: member.relationship,
          consentStatus: member.consentStatus,
          version: { increment: 1 }
        }
      });
      await tx.familyGroupMember.delete({ where: { id: member.id } });
    }
    for (const grant of sourceGrants) {
      await tx.familyBookingGrant.upsert({
        where: {
          familyGroupId_actorContactPointId_patientId: {
            familyGroupId: grant.familyGroupId,
            actorContactPointId: grant.actorContactPointId,
            patientId: targetPatientId
          }
        },
        create: { ...grant, id: undefined, patientId: targetPatientId },
        update: {
          canBook: grant.canBook,
          canReschedule: grant.canReschedule,
          canCancel: grant.canCancel,
          canReceiveReminders: grant.canReceiveReminders,
          consentStatus: grant.consentStatus,
          version: { increment: 1 }
        }
      });
      await tx.familyBookingGrant.delete({ where: { id: grant.id } });
    }
  }

  private patientSnapshot(patient: Patient) {
    return {
      id: patient.id,
      branchId: patient.branchId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      birthDate: patient.birthDate,
      documentType: patient.documentType,
      documentNumber: patient.documentNumber,
      email: patient.email,
      phone: patient.phone,
      status: patient.status,
      updatedAt: patient.updatedAt
    };
  }

  private maskName(patient: { firstName: string; lastName: string }) {
    const mask = (value: string) =>
      `${value.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(value.length - 1, 6)))}`;
    return `${mask(patient.firstName)} ${mask(patient.lastName)}`;
  }

  private normalizeText(value: string) {
    return value.trim().replace(/\s+/g, " ");
  }

  private normalizeIdentity(value?: string | null) {
    return this.normalizeText(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  private normalizeIdentifier(value?: string | null) {
    return (value ?? "")
      .trim()
      .replace(/[\s.-]/g, "")
      .toUpperCase();
  }

  private async audit(
    organizationId: string,
    actorUserId: string,
    entity: string,
    entityId: string,
    action: string,
    before: unknown,
    after: unknown
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId,
        entity,
        entityId,
        action,
        before: before as Prisma.InputJsonValue,
        after: after as Prisma.InputJsonValue
      }
    });
  }
}
