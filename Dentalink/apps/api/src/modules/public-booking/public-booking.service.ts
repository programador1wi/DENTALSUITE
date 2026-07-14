import {
  BadRequestException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { AppointmentsService } from "../appointments/appointments.service";
import { PublicAvailabilityQueryDto, PublicCreateAppointmentDto, UpdatePublicPatientProfileDto } from "./dto/public-booking.dto";

const PUBLIC_ACTION_ROLE_CODES = ["OWNER", "owner", "SUPER_ADMIN", "super_admin", "ADMIN", "admin"];
const PUBLIC_ACTION_ROLE_NAMES = ["OWNER", "SUPER_ADMIN", "ADMIN"];

@Injectable()
export class PublicBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsService: AppointmentsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
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
        .filter((rolePermission) => rolePermission.permission.isActive && !rolePermission.permission.deletedAt)
        .map((permission) => permission.permissionId) ?? [];
    const rolePerms = systemActor.roles.flatMap((role) =>
      role.role.permissions
        .filter((rolePermission) => rolePermission.permission.isActive && !rolePermission.permission.deletedAt)
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

    const defaultBrand = config.organization.branchBrands[0];
    return {
      ...config,
      brandColor: config.brandColor ?? defaultBrand?.primaryColor ?? undefined,
      logoUrl: config.logoUrl ?? defaultBrand?.logoUrl ?? config.organization.logoUrl ?? undefined,
      footerText:
        config.footerText ??
        [defaultBrand?.name ?? config.organization.name, defaultBrand?.phone ?? config.organization.phone, defaultBrand?.senderEmail ?? config.organization.email]
          .filter(Boolean)
          .join(" - "),
      branches,
      professionals,
      specialties
    };
  }

  async getAvailability(slug: string, query: PublicAvailabilityQueryDto) {
    const config = await this.prisma.onlineSchedulingConfig.findUnique({ where: { slug } });
    if (!config || !config.isEnabled) throw new NotFoundException("Booking page not found or disabled");

    if (config.allowedBranches.length > 0 && !config.allowedBranches.includes(query.branchId)) {
      throw new BadRequestException("Branch not allowed for online scheduling");
    }

    if (config.allowedProfessionals.length > 0 && !config.allowedProfessionals.includes(query.professionalId)) {
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

  async createAppointment(slug: string, dto: PublicCreateAppointmentDto) {
    const config = await this.prisma.onlineSchedulingConfig.findUnique({ where: { slug } });
    if (!config || !config.isEnabled) throw new NotFoundException("Booking page not found or disabled");

    const actor = await this.getSystemActor(config.organizationId, dto.branchId);

    let patient;
    if (dto.patient.documentNumber) {
      patient = await this.prisma.patient.findFirst({
        where: { organizationId: config.organizationId, documentNumber: dto.patient.documentNumber }
      });
    } else if (dto.patient.email) {
      patient = await this.prisma.patient.findFirst({
        where: { organizationId: config.organizationId, email: dto.patient.email }
      });
    }

    if (!patient) {
      patient = await this.prisma.patient.create({
        data: {
          organizationId: config.organizationId,
          branchId: dto.branchId,
          firstName: dto.patient.firstName,
          lastName: dto.patient.lastName,
          email: dto.patient.email,
          phone: dto.patient.phone,
          documentType: dto.patient.documentType,
          documentNumber: dto.patient.documentNumber
        }
      });
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

    const appointment = await this.appointmentsService.create(actor, {
      branchId: dto.branchId,
      professionalId: dto.professionalId,
      patientId: patient.id,
      specialtyId: dto.specialtyId,
      startAt: startAtDate.toISOString(),
      endAt: endAtDate.toISOString(),
      durationMinutes,
      status: config.mode === "EXPRESS" ? AppointmentStatus.SCHEDULED : AppointmentStatus.PENDING_CONFIRMATION,
      title: "Reserva Online",
      reason: dto.motive
    });

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
      if (expectedPurpose && payload.purpose !== expectedPurpose) throw new UnauthorizedException("Invalid token purpose");
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
      dateStr: new Intl.DateTimeFormat("es-MX", { month: "long", day: "numeric", timeZone: tz }).format(appointment.startAt),
      timeStr: new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(appointment.startAt) + " hrs",
      address: [appointment.branch.address, appointment.branch.city, appointment.branch.state].filter(Boolean).join(", ")
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
    this.verifyEmailToken(id, token, 'PATIENT_PROFILE_UPDATE');
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { include: { address: true, contacts: true } },
        branch: { select: { organizationId: true } }
      }
    });

    if (!appointment || !appointment.patient) throw new NotFoundException('Patient not found');
    if (appointment.status === 'CANCELLED_BY_CLINIC' || appointment.status === 'CANCELLED_BY_PATIENT' || appointment.status === 'CANCELLED_RESCHEDULED' || appointment.status === 'CANCELLED_CONFLICT') {
      throw new BadRequestException('Cannot update profile for a cancelled appointment');
    }

    const p = appointment.patient;
    return {
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      documentType: p.documentType,
      documentNumber: p.documentNumber,
      birthDate: p.birthDate ? p.birthDate.toISOString() : null,
      gender: p.gender,
      alternatePhone: p.alternatePhone,
      address: p.address ? {
        street: p.address.street,
        city: p.address.city,
        state: p.address.state
      } : null
    };
  }

  async updatePatientProfile(id: string, token: string, dto: UpdatePublicPatientProfileDto) {
    this.verifyEmailToken(id, token, 'PATIENT_PROFILE_UPDATE');
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { patient: { include: { address: true } } }
    });

    if (!appointment || !appointment.patient) throw new NotFoundException('Patient not found');
    if (!dto.privacyNoticeAccepted) throw new BadRequestException('Privacy notice must be accepted');

    const patientId = appointment.patient.id;
    const organizationId = appointment.organizationId;

    const dataToUpdate: any = {};
    if (dto.firstName !== undefined) dataToUpdate.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) dataToUpdate.lastName = dto.lastName.trim();
    if (dto.email !== undefined) dataToUpdate.email = dto.email ? dto.email.trim().toLowerCase() : null;
    if (dto.phone !== undefined) dataToUpdate.phone = dto.phone ? dto.phone.trim() : null;
    if (dto.documentType !== undefined) dataToUpdate.documentType = dto.documentType;
    if (dto.documentNumber !== undefined) dataToUpdate.documentNumber = dto.documentNumber ? dto.documentNumber.trim() : null;
    if (dto.birthDate !== undefined) dataToUpdate.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    if (dto.gender !== undefined) dataToUpdate.gender = dto.gender;
    if (dto.alternatePhone !== undefined) dataToUpdate.alternatePhone = dto.alternatePhone ? dto.alternatePhone.trim() : null;

    if (dto.address !== undefined) {
       dataToUpdate.address = {
         upsert: {
           create: {
             street: dto.address.street || '',
             city: dto.address.city || '',
             state: dto.address.state || ''
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

      await tx.auditLog.create({
        data: {
          organizationId,
          entityId: patientId,
          entity: 'Patient',
          action: 'update_public_profile',
          reason: 'PUBLIC_PATIENT_PROFILE',
          newValue: { privacyNoticeAccepted: true, updatedFields: Object.keys(dataToUpdate) },
          createdAt: new Date(),
          userId: appointment.createdById
        }
      });
    });

    return { success: true };
  }
}
