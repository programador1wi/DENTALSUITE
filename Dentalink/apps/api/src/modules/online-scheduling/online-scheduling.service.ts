import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateOnlineSchedulingDto } from './dto/update-online-scheduling.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class OnlineSchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(organizationId: string, mode: 'ONLINE' | 'EXPRESS' = 'ONLINE') {
    let config = await this.prisma.onlineSchedulingConfig.findUnique({
      where: { organizationId_mode: { organizationId, mode } },
    });

    if (!config) {
      const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
      const baseSlug = org?.slug || 'agenda';
      const slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;
      
      config = await this.prisma.onlineSchedulingConfig.create({
        data: {
          organizationId,
          slug,
          isEnabled: false,
          mode,
          allowedBranches: [],
          allowedProfessionals: [],
          allowedSpecialties: [],
          allowedMotives: [],
          identificationMethod: 'EMAIL',
          requiredPatientFields: ['phone', 'email', 'firstName', 'lastName'],
        },
      });
    }

    return config;
  }

  async updateConfig(organizationId: string, dto: UpdateOnlineSchedulingDto, userId: string) {
    const config = await this.getConfig(organizationId);
    
    const updated = await this.prisma.onlineSchedulingConfig.update({
      where: { id: config.id },
      data: {
        isEnabled: dto.isEnabled,
        mode: dto.mode,
        allowedBranches: dto.allowedBranches,
        allowedProfessionals: dto.allowedProfessionals,
        allowedSpecialties: dto.allowedSpecialties,
        allowedMotives: dto.allowedMotives,
        identificationMethod: dto.identificationMethod,
        requiredPatientFields: dto.requiredPatientFields,
        securityMarginHours: dto.securityMarginHours,
        blocksPerAppointment: dto.blocksPerAppointment,
        maxDaysInAdvance: dto.maxDaysInAdvance,
        maxUnvalidatedAppointmentsPerPatient: dto.maxUnvalidatedAppointmentsPerPatient,
        brandColor: dto.brandColor,
        logoUrl: dto.logoUrl,
        footerText: dto.footerText,
        googleAnalyticsId: dto.googleAnalyticsId,
        redirectUrl: dto.redirectUrl,
        confirmationMessage: dto.confirmationMessage,
      },
    });

    // Auditar cambios sensibles si cambió la habilitación
    if (dto.isEnabled !== undefined && dto.isEnabled !== config.isEnabled) {
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: dto.isEnabled ? 'ENABLE_ONLINE_SCHEDULING' : 'DISABLE_ONLINE_SCHEDULING',
          entity: 'OnlineSchedulingConfig',
          entityId: config.id,
          reason: dto.isEnabled ? 'Agenda online habilitada' : 'Agenda online deshabilitada'
        }
      });
    }

    return updated;
  }

  async regenerateSlug(organizationId: string) {
    const config = await this.getConfig(organizationId);
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    const baseSlug = org?.slug || 'agenda';
    const newSlug = `${baseSlug}-${randomBytes(4).toString('hex')}`;
    
    return this.prisma.onlineSchedulingConfig.update({
      where: { id: config.id },
      data: { slug: newSlug },
    });
  }

  async getPreviewBySlug(slug: string, organizationId: string) {
    const config = await this.prisma.onlineSchedulingConfig.findUnique({
      where: { slug },
    });

    if (!config) {
      throw new NotFoundException('Configuration not found');
    }

    if (config.organizationId !== organizationId) {
      throw new NotFoundException('Configuration does not belong to this organization');
    }

    return config;
  }
}
