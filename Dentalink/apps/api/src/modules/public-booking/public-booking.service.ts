import {
  BadRequestException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { generateUniquePatientNumber } from "../../common/utils/patient-number.util";
import { AppointmentsService } from "../appointments/appointments.service";
import { PatientIdentityService } from "../patient-identity/patient-identity.service";
import { PatientFieldConfigService } from "../patient-field-config/patient-field-config.service";
import {
  PublicAvailabilityQueryDto,
  PublicCreateAppointmentDto,
  PublicIdentityResolveDto,
  UpdatePublicPatientProfileDto
} from "./dto/public-booking.dto";

const PUBLIC_ACTION_ROLE_CODES = ["OWNER", "owner", "SUPER_ADMIN", "super_admin", "ADMIN", "admin"];
const PUBLIC_ACTION_ROLE_NAMES = ["OWNER", "SUPER_ADMIN", "ADMIN"];

@Injectable()
export class PublicBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsService: AppointmentsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly patientIdentityService: PatientIdentityService,
    private readonly patientFieldConfig: PatientFieldConfigService
  ) {}

  private async getSystemActor(organizationId: string, branchId?: string): Promise<AuthUser> {
    const systemActor = await this.prisma.user.findFirst({
      where: {
        organizationId,
        isActive: true,
        status: "ACTIVE",
        deletedAt: null,
        ...(branchId ? { branches: { some: { branchId } } } : {}),
        OR: [
          {
            role: {
              isActive: true,
              deletedAt: null,
              OR: [{ code: { in: PUBLIC_ACTION_ROLE_CODES } }, { name: { in: PUBLIC_ACTION_ROLE_NAMES } }]
            }
          },
          {
            roles: {
              some: {
                role: {
                  isActive: true,
                  deletedAt: null,
                  OR: [{ code: { in: PUBLIC_ACTION_ROLE_CODES } }, { name: { in: PUBLIC_ACTION_ROLE_NAMES } }]
                }
              }
            }
          }
        ]
      },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        branches: true,
        permissions: { include: { permission: true } }
      },
      orderBy: { email: "asc" }
    });

    if (!systemActor) {
      throw new InternalServerErrorException("Public booking system actor is not configured");
    }

    const explicitPerms = systemActor.permissions
      .filter((userPermission) => userPermission.permission.isActive && !userPermission.permission.deletedAt)
      .map((permission) => permission.permissionId);
    const primaryRolePerms =
      systemActor.role?.permissions
        .filter(
          (rolePermission) => rolePermission.permission.isActive && !rolePermission.permission.deletedAt
        )
        .map((permission) => permission.permissionId) ?? [];
    const rolePerms = systemActor.roles.flatMap((role) =>
      role.role.permissions
        .filter(
          (rolePermission) => rolePermission.permission.isActive && !rolePermission.permission.deletedAt
        )
        .map((permission) => permission.permissionId)
    );

    return {
      id: systemActor.id,
      email: systemActor.email,
      firstName: systemActor.firstName,
      lastName: systemActor.lastName,
      organizationId,
      branchIds: systemActor.branches.map((branch) => branch.branchId),
      roleIds: [
        ...new Set([
          ...(systemActor.roleId ? [systemActor.roleId] : []),
          ...systemActor.roles.map((role) => role.roleId)
        ])
      ],
      roleNames: [
        ...new Set([
          ...(systemActor.role?.name ? [systemActor.role.name] : []),
          ...systemActor.roles.map((role) => role.role.name)
        ])
      ],
      permissions: [...new Set([...explicitPerms, ...primaryRolePerms, ...rolePerms])]
    };
  }

  async getConfig(slug: string) {
    const config = await this.prisma.onlineSchedulingConfig.findUnique({
      where: { slug },
      include: {
        organization: {
          select: {
            name: true,
            phone: true,
            email: true,
            logoUrl: true,
            branchBrands: {
              where: { isDefault: true, status: "ACTIVE" },
              select: { name: true, logoUrl: true, primaryColor: true, phone: true, senderEmail: true },
              take: 1
            }
          }
        }
      }
    });
    if (!config || !config.isEnabled) throw new NotFoundException("Booking page not found or disabled");

    const branches = await this.prisma.branch.findMany({
      where: {
        organizationId: config.organizationId,
        status: "ACTIVE",
        id: config.allowedBranches.length > 0 ? { in: config.allowedBranches } : undefined
      },
      select: { id: true, name: true }
    });

    const professionals = await this.prisma.professional.findMany({
      where: {
        organizationId: config.organizationId,
        isActive: true,
        id: config.allowedProfessionals.length > 0 ? { in: config.allowedProfessionals } : undefined
      },
      select: { id: true, firstName: true, lastName: true }
    });

    const specialties = await this.prisma.specialty.findMany({
      where: {
        organizationId: config.organizationId,
        id: config.allowedSpecialties.length > 0 ? { in: config.allowedSpecialties } : undefined
      },
      select: { id: true, name: true }
    });

    const agreements = await this.prisma.agreement.findMany({
      where: {
        organizationId: config.organizationId,
        status: "ACTIVE",
        isActive: true,
        isPublic: true
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });

    const patientFieldConfigs = await this.patientFieldConfig.getByOrganization(config.organizationId);

    const defaultBrand = config.organization.branchBrands[0];
    return {
      ...config,
      brandColor: config.brandColor ?? defaultBrand?.primaryColor ?? undefined,
      logoUrl: config.logoUrl ?? defaultBrand?.logoUrl ?? config.organization.logoUrl ?? undefined,
      footerText:
        config.footerText ??
        [
          defaultBrand?.name ?? config.organization.name,
          defaultBrand?.phone ?? config.organization.phone,
          defaultBrand?.senderEmail ?? config.organization.email
        ]
          .filter(Boolean)
          .join(" - "),
      branches,
      professionals,
      specialties,
      agreements,
      patientFieldConfigs
    };
  }

  async getAvailability(slug: string, query: PublicAvailabilityQueryDto) {
    const config = await this.prisma.onlineSchedulingConfig.findUnique({ where: { slug } });
    if (!config || !config.isEnabled) throw new NotFoundException("Booking page not found or disabled");

    if (config.allowedBranches.length > 0 && !config.allowedBranches.includes(query.branchId)) {
      throw new BadRequestException("Branch not allowed for online scheduling");
    }

    if (
      config.allowedProfessionals.length > 0 &&
      !config.allowedProfessionals.includes(query.professionalId)
    ) {
      throw new BadRequestException("Professional not allowed for online scheduling");
    }

    const actor = await this.getSystemActor(config.organizationId, query.branchId);
    const durationMinutes = (config.blocksPerAppointment || 1) * 15;
    return this.appointmentsService.availability(actor, {
      ...query,
      durationMinutes: durationMinutes.toString()
    });
  }

  async trackEvent(slug: string, eventType: string, campaignCode?: string) {
    const config = await this.prisma.onlineSchedulingConfig.findUnique({ where: { slug } });
    if (!config || !config.isEnabled) throw new NotFoundException("Booking page not found or disabled");

    return this.prisma.onlineSchedulingEvent.create({
      data: {
        organizationId: config.organizationId,
        slug,
        eventType,
        campaignCode: campaignCode || null
      }
    });
  }

  async resolveIdentity(slug: string, dto: PublicIdentityResolveDto) {
    const config = await this.prisma.onlineSchedulingConfig.findUnique({ where: { slug } });
    if (!config || !config.isEnabled) throw new NotFoundException("Booking page not found or disabled");
    if (!dto.patient.phone)
      throw new BadRequestException("El teléfono es obligatorio para resolver la identidad");
    return this.patientIdentityService.createSession(config.organizationId, {
      organizationId: config.organizationId,
      source: "PUBLIC_BOOKING",
      phone: dto.patient.phone,
      conversationId: dto.conversationId
    });
  }

  async verifyIdentity(
    slug: string,
    sessionId: string,
    dto: { firstName?: string; lastName?: string; birthDate?: string; documentNumber?: string }
  ) {
    const config = await this.prisma.onlineSchedulingConfig.findUnique({ where: { slug } });
    if (!config || !config.isEnabled) throw new NotFoundException("Booking page not found or disabled");
    return this.patientIdentityService.verifySession(config.organizationId, sessionId, dto);
  }

  async selectIdentity(slug: string, sessionId: string, patientId: string, familyGroupId?: string) {
    const config = await this.prisma.onlineSchedulingConfig.findUnique({ where: { slug } });
    if (!config || !config.isEnabled) throw new NotFoundException("Booking page not found or disabled");
    return this.patientIdentityService.selectSessionPatient(config.organizationId, sessionId, {
      patientId,
      familyGroupId,
      resolutionMethod: "PUBLIC_EXPLICIT_SELECTION"
    });
  }

  async createAppointment(slug: string, dto: PublicCreateAppointmentDto, idempotencyKey?: string) {
    const config = await this.prisma.onlineSchedulingConfig.findUnique({ where: { slug } });
    if (!config || !config.isEnabled) throw new NotFoundException("Booking page not found or disabled");
    if (!dto.identitySessionId)
      throw new BadRequestException("Debes resolver para quién es la cita antes de continuar");
    if (!idempotencyKey?.trim()) throw new BadRequestException("idempotency-key es obligatorio");

    await this.patientFieldConfig.assertRequiredFields(config.organizationId, "onlineAgenda", {
      legalName: dto.patient.firstName,
      socialName: dto.patient.socialName,
      lastName: dto.patient.lastName,
      curp: dto.patient.documentNumber,
      email: dto.patient.email,
      agreement: dto.patient.agreementId,
      internalNumber: dto.patient.internalNumber,
      sex: dto.patient.sex,
      gender: dto.patient.gender,
      birthDate: dto.patient.birthDate,
      city: dto.patient.address?.city,
      delegation: dto.patient.address?.state,
      address: dto.patient.address?.street,
      fixedPhone: dto.patient.alternatePhone,
      mobilePhone: dto.patient.phone,
      profession: dto.patient.occupation,
      employer: dto.patient.employer,
      observations: dto.patient.observations,
      guardian: dto.patient.guardianName,
      reference: dto.patient.referredBy,
      type: dto.patient.type,
      guardianDocument: dto.patient.guardianDocumentNumber,
      guardianSocialName: dto.patient.guardianSocialName,
      guardianGender: dto.patient.guardianGender
    });

    const actor = await this.getSystemActor(config.organizationId, dto.branchId);
    if (dto.patient.agreementId) {
      const agreement = await this.prisma.agreement.findFirst({
        where: {
          id: dto.patient.agreementId,
          organizationId: config.organizationId,
          status: "ACTIVE",
          isActive: true,
          isPublic: true
        },
        select: { id: true }
      });
      if (!agreement) throw new BadRequestException("Convenio invalido o no disponible");
    }
    let session = await this.patientIdentityService.getSessionState(
      config.organizationId,
      dto.identitySessionId
    );
    let patient = session.selectedPatientId
      ? await this.prisma.patient.findFirst({
          where: { id: session.selectedPatientId, organizationId: config.organizationId, deletedAt: null }
        })
      : null;

    if (!patient) {
      if (session.resolution !== "NO_MATCH") {
        throw new BadRequestException(
          "La identidad es ambigua; verifica o selecciona al paciente antes de reservar"
        );
      }
      const duplicateCheck = await this.patientIdentityService.duplicateCheck(config.organizationId, {
        branchId: dto.branchId,
        firstName: dto.patient.firstName,
        lastName: dto.patient.lastName,
        email: dto.patient.email,
        phone: dto.patient.phone,
        birthDate: dto.patient.birthDate,
        documentType: dto.patient.documentType,
        documentNumber: dto.patient.documentNumber
      });
      if (duplicateCheck.matches.length) {
        throw new BadRequestException(
          "Se encontraron fichas posibles; verifica la identidad antes de crear otra"
        );
      }
      const normalizedPhone = dto.patient.phone
        ? await this.patientIdentityService.normalizePhone(config.organizationId, dto.patient.phone)
        : undefined;
      const patientNumber = await generateUniquePatientNumber(this.prisma);
      patient = await this.prisma.patient.create({
        data: {
          patientNumber,
          organizationId: config.organizationId,
          branchId: dto.branchId,
          agreementId: dto.patient.agreementId?.trim(),
          firstName: dto.patient.firstName.trim().replace(/\s+/g, " "),
          socialName: dto.patient.socialName?.trim(),
          lastName: dto.patient.lastName.trim().replace(/\s+/g, " "),
          internalNumber: dto.patient.internalNumber?.trim(),
          email: dto.patient.email?.trim().toLowerCase(),
          phone: normalizedPhone?.normalizedValue.replace(/^\+/, ""),
          birthDate: dto.patient.birthDate ? new Date(dto.patient.birthDate) : undefined,
          sex: dto.patient.sex?.trim(),
          documentType: dto.patient.documentType?.trim(),
          documentNumber: dto.patient.documentNumber?.trim(),
          gender: dto.patient.gender?.trim(),
          alternatePhone: dto.patient.alternatePhone?.trim(),
          occupation: dto.patient.occupation?.trim(),
          employer: dto.patient.employer?.trim(),
          observations: dto.patient.observations?.trim(),
          referredBy: dto.patient.referredBy?.trim(),
          source: dto.patient.type?.trim(),
          status: "PROVISIONAL"
        }
      });
      if (dto.patient.address && Object.values(dto.patient.address).some((value) => value?.trim())) {
        await this.prisma.patientAddress.create({
          data: {
            patientId: patient.id,
            street: dto.patient.address.street?.trim(),
            city: dto.patient.address.city?.trim(),
            state: dto.patient.address.state?.trim()
          }
        });
      }
      if (dto.patient.guardianName?.trim()) {
        await this.prisma.patientContact.create({
          data: {
            patientId: patient.id,
            name: dto.patient.guardianName.trim(),
            socialName: dto.patient.guardianSocialName?.trim(),
            documentNumber: dto.patient.guardianDocumentNumber?.trim(),
            gender: dto.patient.guardianGender?.trim(),
            relationship: dto.patient.guardianRelationship?.trim(),
            phone: dto.patient.guardianPhone?.trim(),
            email: dto.patient.guardianEmail?.trim(),
            isEmergencyContact: true
          }
        });
      }
      if (normalizedPhone) {
        await this.patientIdentityService.syncPatientPhones(
          actor,
          patient.id,
          normalizedPhone.normalizedValue
        );
      }
      session = await this.patientIdentityService.attachNewPatientToSession(
        config.organizationId,
        session.id,
        patient.id
      );
    }

    const startAtDate = new Date(dto.startAt);
    const durationMinutes = (config.blocksPerAppointment || 1) * 15;
    const endAtDate = new Date(startAtDate.getTime() + durationMinutes * 60000);

    if (config.mode === "ONLINE" && patient) {
      const pendingCount = await this.prisma.appointment.count({
        where: {
          patientId: patient.id,
          organizationId: config.organizationId,
          status: AppointmentStatus.PENDING_CONFIRMATION
        }
      });

      if (pendingCount >= (config.maxUnvalidatedAppointmentsPerPatient || 2)) {
        throw new BadRequestException(
          `Has alcanzado el limite maximo de ${config.maxUnvalidatedAppointmentsPerPatient || 2} citas pendientes de confirmacion.`
        );
      }
    }

    const appointment = await this.patientIdentityService.bookResolvedAppointment(
      config.organizationId,
      session.id,
      {
        branchId: dto.branchId,
        professionalId: dto.professionalId,
        specialtyId: dto.specialtyId,
        startAt: startAtDate.toISOString(),
        endAt: endAtDate.toISOString(),
        durationMinutes,
        status:
          config.mode === "EXPRESS" ? AppointmentStatus.SCHEDULED : AppointmentStatus.PENDING_CONFIRMATION,
        title: "Reserva Online",
        reason: dto.motive
      },
      idempotencyKey,
      dto.campaignCode
    );

    await this.prisma.onlineSchedulingEvent
      .create({
        data: {
          organizationId: config.organizationId,
          slug,
          eventType: "CONVERSION",
          campaignCode: dto.campaignCode || null,
          appointmentId: appointment.id
        }
      })
      .catch((error) => console.error("Error tracking conversion:", error));

    return appointment;
  }

  private verifyEmailToken(id: string, token: string, expectedPurpose?: string) {
    if (!token) throw new BadRequestException("Token is required");
    const secret = this.configService.get<string>("JWT_ACCESS_SECRET") || "secret";
    try {
      const payload = this.jwtService.verify(token, { secret });
      if (payload.sub !== id) throw new UnauthorizedException("Invalid token");
      if (expectedPurpose && payload.purpose !== expectedPurpose)
        throw new UnauthorizedException("Invalid token purpose");
      return payload;
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "TokenExpiredError") throw new GoneException("Token expired");
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Invalid token");
    }
  }

  async getAppointmentDetailsForConfirmation(id: string, token: string) {
    this.verifyEmailToken(id, token);

    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        professional: { select: { firstName: true, lastName: true } },
        branch: { select: { address: true, city: true, state: true, timezone: true } }
      }
    });

    if (!appointment) throw new NotFoundException("Appointment not found");

    const tz = appointment.branch.timezone || "America/Mexico_City";

    return {
      status: appointment.status,
      patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}`.trim(),
      professionalName: `${appointment.professional.firstName} ${appointment.professional.lastName}`.trim(),
      dateStr: new Intl.DateTimeFormat("es-MX", { month: "long", day: "numeric", timeZone: tz }).format(
        appointment.startAt
      ),
      timeStr:
        new Intl.DateTimeFormat("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: tz
        }).format(appointment.startAt) + " hrs",
      address: [appointment.branch.address, appointment.branch.city, appointment.branch.state]
        .filter(Boolean)
        .join(", ")
    };
  }

  async confirmEmail(id: string, token: string) {
    this.verifyEmailToken(id, token);

    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException("Appointment not found");

    const actor = await this.getSystemActor(appointment.organizationId, appointment.branchId);
    await this.appointmentsService.confirmByEmail(actor, id);

    return { success: true };
  }

  async cancelEmail(id: string, token: string) {
    this.verifyEmailToken(id, token);

    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException("Appointment not found");

    const actor = await this.getSystemActor(appointment.organizationId, appointment.branchId);
    await this.appointmentsService.cancel(actor, id, {
      reason: "Cancelado por el paciente via enlace publico de email",
      cancelledBy: "patient"
    });

    return { success: true };
  }

  async getPatientProfile(id: string, token: string) {
    this.verifyEmailToken(id, token, "PATIENT_PROFILE_UPDATE");
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { include: { address: true, contacts: true } },
        branch: { select: { organizationId: true } }
      }
    });

    if (!appointment || !appointment.patient) throw new NotFoundException("Patient not found");
    if (
      appointment.status === "CANCELLED_BY_CLINIC" ||
      appointment.status === "CANCELLED_BY_PATIENT" ||
      appointment.status === "CANCELLED_RESCHEDULED" ||
      appointment.status === "CANCELLED_CONFLICT"
    ) {
      throw new BadRequestException("Cannot update profile for a cancelled appointment");
    }

    const p = appointment.patient;
    const patientFieldConfigs = await this.patientFieldConfig.getByOrganization(
      appointment.branch.organizationId
    );
    const agreements = await this.prisma.agreement.findMany({
      where: {
        organizationId: appointment.branch.organizationId,
        status: "ACTIVE",
        isActive: true,
        isPublic: true
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });
    const guardian = p.contacts?.find((contact) => contact.isEmergencyContact);
    return {
      firstName: p.firstName,
      socialName: p.socialName,
      lastName: p.lastName,
      agreementId: p.agreementId,
      internalNumber: p.internalNumber,
      email: p.email,
      phone: p.phone,
      documentType: p.documentType,
      documentNumber: p.documentNumber,
      birthDate: p.birthDate ? p.birthDate.toISOString() : null,
      sex: p.sex,
      gender: p.gender,
      alternatePhone: p.alternatePhone,
      occupation: p.occupation,
      employer: p.employer,
      observations: p.observations,
      referredBy: p.referredBy,
      type: p.source,
      guardianName: guardian?.name ?? null,
      guardianSocialName: guardian?.socialName ?? null,
      guardianDocumentNumber: guardian?.documentNumber ?? null,
      guardianGender: guardian?.gender ?? null,
      address: p.address
        ? {
            street: p.address.street,
            city: p.address.city,
            state: p.address.state
          }
        : null,
      patientFieldConfigs,
      agreements
    };
  }

  async updatePatientProfile(id: string, token: string, dto: UpdatePublicPatientProfileDto) {
    this.verifyEmailToken(id, token, "PATIENT_PROFILE_UPDATE");
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { patient: { include: { address: true } } }
    });

    if (!appointment || !appointment.patient) throw new NotFoundException("Patient not found");
    if (!dto.privacyNoticeAccepted) throw new BadRequestException("Privacy notice must be accepted");

    await this.patientFieldConfig.assertRequiredFields(appointment.organizationId, "checkIn", {
      legalName: dto.firstName,
      socialName: dto.socialName,
      lastName: dto.lastName,
      curp: dto.documentNumber,
      email: dto.email,
      agreement: dto.agreementId,
      internalNumber: dto.internalNumber,
      sex: dto.sex,
      gender: dto.gender,
      birthDate: dto.birthDate,
      city: dto.address?.city,
      delegation: dto.address?.state,
      address: dto.address?.street,
      fixedPhone: dto.alternatePhone,
      mobilePhone: dto.phone,
      profession: dto.occupation,
      employer: dto.employer,
      observations: dto.observations,
      guardian: dto.guardianName,
      reference: dto.referredBy,
      type: dto.type,
      guardianDocument: dto.guardianDocumentNumber,
      guardianSocialName: dto.guardianSocialName,
      guardianGender: dto.guardianGender
    });

    const patientId = appointment.patient.id;
    const organizationId = appointment.organizationId;

    if (dto.agreementId) {
      const agreement = await this.prisma.agreement.findFirst({
        where: { id: dto.agreementId, organizationId, status: "ACTIVE", isActive: true, isPublic: true },
        select: { id: true }
      });
      if (!agreement) throw new BadRequestException("Convenio invalido o no disponible");
    }

    const dataToUpdate: Prisma.PatientUpdateInput = {};
    if (dto.firstName !== undefined) dataToUpdate.firstName = dto.firstName.trim();
    if (dto.socialName !== undefined) dataToUpdate.socialName = dto.socialName ? dto.socialName.trim() : null;
    if (dto.lastName !== undefined) dataToUpdate.lastName = dto.lastName.trim();
    if (dto.agreementId !== undefined)
      dataToUpdate.agreement = dto.agreementId ? { connect: { id: dto.agreementId } } : { disconnect: true };
    if (dto.internalNumber !== undefined)
      dataToUpdate.internalNumber = dto.internalNumber ? dto.internalNumber.trim() : null;
    if (dto.email !== undefined) dataToUpdate.email = dto.email ? dto.email.trim().toLowerCase() : null;
    if (dto.phone !== undefined) dataToUpdate.phone = dto.phone ? dto.phone.trim() : null;
    if (dto.documentType !== undefined) dataToUpdate.documentType = dto.documentType;
    if (dto.documentNumber !== undefined)
      dataToUpdate.documentNumber = dto.documentNumber ? dto.documentNumber.trim() : null;
    if (dto.birthDate !== undefined) dataToUpdate.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    if (dto.sex !== undefined) dataToUpdate.sex = dto.sex || null;
    if (dto.gender !== undefined) dataToUpdate.gender = dto.gender;
    if (dto.alternatePhone !== undefined)
      dataToUpdate.alternatePhone = dto.alternatePhone ? dto.alternatePhone.trim() : null;
    if (dto.occupation !== undefined) dataToUpdate.occupation = dto.occupation ? dto.occupation.trim() : null;
    if (dto.employer !== undefined) dataToUpdate.employer = dto.employer ? dto.employer.trim() : null;
    if (dto.observations !== undefined)
      dataToUpdate.observations = dto.observations ? dto.observations.trim() : null;
    if (dto.referredBy !== undefined) dataToUpdate.referredBy = dto.referredBy ? dto.referredBy.trim() : null;
    if (dto.type !== undefined) dataToUpdate.source = dto.type ? dto.type.trim() : null;

    if (dto.address !== undefined) {
      dataToUpdate.address = {
        upsert: {
          create: {
            street: dto.address.street || "",
            city: dto.address.city || "",
            state: dto.address.state || ""
          },
          update: {
            ...(dto.address.street !== undefined && { street: dto.address.street }),
            ...(dto.address.city !== undefined && { city: dto.address.city }),
            ...(dto.address.state !== undefined && { state: dto.address.state })
          }
        }
      };
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(dataToUpdate).length > 0) {
        await tx.patient.update({
          where: { id: patientId },
          data: dataToUpdate
        });
      }

      if (dto.guardianName?.trim()) {
        const existingGuardian = await tx.patientContact.findFirst({
          where: { patientId, isEmergencyContact: true },
          select: { id: true }
        });
        if (existingGuardian) {
          await tx.patientContact.update({
            where: { id: existingGuardian.id },
            data: {
              name: dto.guardianName.trim(),
              socialName: dto.guardianSocialName?.trim() || null,
              documentNumber: dto.guardianDocumentNumber?.trim() || null,
              gender: dto.guardianGender?.trim() || null
            }
          });
        } else {
          await tx.patientContact.create({
            data: {
              patientId,
              name: dto.guardianName.trim(),
              socialName: dto.guardianSocialName?.trim(),
              documentNumber: dto.guardianDocumentNumber?.trim(),
              gender: dto.guardianGender?.trim(),
              isEmergencyContact: true
            }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          entityId: patientId,
          entity: "Patient",
          action: "update_public_profile",
          reason: "PUBLIC_PATIENT_PROFILE",
          newValue: { privacyNoticeAccepted: true, updatedFields: Object.keys(dataToUpdate) },
          createdAt: new Date(),
          userId: appointment.createdById
        }
      });
    });

    return { success: true };
  }
}
