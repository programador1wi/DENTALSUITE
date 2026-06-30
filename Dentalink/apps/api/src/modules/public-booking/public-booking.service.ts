import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { PublicAvailabilityQueryDto, PublicCreateAppointmentDto } from './dto/public-booking.dto';
import { AuthUser } from '../../common/types/auth-user';
import { AppointmentStatus } from '@prisma/client';

@Injectable()
export class PublicBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsService: AppointmentsService
  ) {}

private async getSystemActor(organizationId: string): Promise<AuthUser> {
    const owner = await this.prisma.user.findFirst({
      where: {
        organizationId,
        isActive: true,
        roles: { some: { role: { code: "OWNER" } } }
      },
      include: {
        roles: { include: { role: { include: { permissions: true } } } },
        branches: true,
        permissions: true,
      }
    });

    if (!owner) throw new BadRequestException('Organization has no owner configured');

    const explicitPerms = owner.permissions.map((p) => p.permissionId);
    const rolePerms = owner.roles.flatMap((r) => r.role.permissions.map((p) => p.permissionId));

    return {
      id: owner.id,
      email: owner.email,
      firstName: owner.firstName,
      lastName: owner.lastName,
      organizationId,
      branchIds: owner.branches.map(b => b.branchId),
      roleIds: owner.roles.map(r => r.roleId),
      roleNames: owner.roles.map(r => r.role.name),
      permissions: [...new Set([...explicitPerms, ...rolePerms])],
    };
  }

  async getConfig(slug: string) {
    const config = await this.prisma.onlineSchedulingConfig.findUnique({ where: { slug } });
    if (!config || !config.isEnabled) throw new NotFoundException('Booking page not found or disabled');

    const branches = await this.prisma.branch.findMany({
      where: {
        organizationId: config.organizationId,
        status: 'ACTIVE',
        id: config.allowedBranches.length > 0 ? { in: config.allowedBranches } : undefined
      },
      select: { id: true, name: true }
    });

    const professionals = await this.prisma.professional.findMany({
      where: {
        organizationId: config.organizationId,
        status: 'ACTIVE',
        id: config.allowedProfessionals.length > 0 ? { in: config.allowedProfessionals } : undefined
      },
      select: { id: true, firstName: true, lastName: true }
    });

    return { ...config, branches, professionals };
  }

  async getAvailability(slug: string, query: PublicAvailabilityQueryDto) {
    const config = await this.prisma.onlineSchedulingConfig.findUnique({ where: { slug } });
    if (!config || !config.isEnabled) throw new NotFoundException('Booking page not found or disabled');

    if (config.allowedBranches.length > 0 && !config.allowedBranches.includes(query.branchId)) {
      throw new BadRequestException('Branch not allowed for online scheduling');
    }

    if (config.allowedProfessionals.length > 0 && !config.allowedProfessionals.includes(query.professionalId)) {
      throw new BadRequestException('Professional not allowed for online scheduling');
    }

    const actor = await this.getSystemActor(config.organizationId);
    return this.appointmentsService.availability(actor, query);
  }

  async createAppointment(slug: string, dto: PublicCreateAppointmentDto) {
    const config = await this.prisma.onlineSchedulingConfig.findUnique({ where: { slug } });
    if (!config || !config.isEnabled) throw new NotFoundException('Booking page not found or disabled');

    const actor = await this.getSystemActor(config.organizationId);

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
          documentNumber: dto.patient.documentNumber,
        }
      });
    }

    const startAtDate = new Date(dto.startAt);
    // Asumimos bloques de 15 min. Esto puede perfeccionarse después.
    const durationMinutes = (config.blocksPerAppointment || 1) * 15;
    const endAtDate = new Date(startAtDate.getTime() + durationMinutes * 60000);

    return this.appointmentsService.create(actor, {
      branchId: dto.branchId,
      professionalId: dto.professionalId,
      patientId: patient.id,
      specialtyId: dto.specialtyId,
      startAt: startAtDate.toISOString(),
      endAt: endAtDate.toISOString(),
      durationMinutes,
      status: config.mode === 'EXPRESS' ? AppointmentStatus.SCHEDULED : AppointmentStatus.PENDING_CONFIRMATION,
      title: 'Reserva Online',
      reason: dto.motive,
    });
  }
}
