import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateOnlineSchedulingDto } from './dto/update-online-scheduling.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
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

  async getCampaigns(organizationId: string) {
    return this.prisma.onlineSchedulingCampaign.findMany({
      where: { organizationId },
      include: {
        professional: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createCampaign(organizationId: string, dto: CreateCampaignDto) {
    const existing = await this.prisma.onlineSchedulingCampaign.findUnique({
      where: { organizationId_code: { organizationId, code: dto.code } }
    });

    if (existing) {
      throw new BadRequestException('Ya existe una campaña con este código');
    }

    return this.prisma.onlineSchedulingCampaign.create({
      data: {
        organizationId,
        name: dto.name,
        code: dto.code,
        professionalId: dto.professionalId || null,
      }
    });
  }

  async deleteCampaign(organizationId: string, id: string) {
    const campaign = await this.prisma.onlineSchedulingCampaign.findFirst({
      where: { id, organizationId }
    });

    if (!campaign) {
      throw new NotFoundException('Campaña no encontrada');
    }

    return this.prisma.onlineSchedulingCampaign.delete({
      where: { id }
    });
  }

  async getDashboardStats(organizationId: string, period = '30', grain = 'day') {
    const now = new Date();
    const daysLimit = Number(period);
    const startDate = new Date();
    startDate.setDate(now.getDate() - daysLimit);

    const events = await this.prisma.onlineSchedulingEvent.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    const campaigns = await this.prisma.onlineSchedulingCampaign.findMany({
      where: { organizationId },
    });

    // Summary
    const visits = events.filter((e: any) => e.eventType === 'VISIT');
    const conversions = events.filter((e: any) => e.eventType === 'CONVERSION');
    const totalVisits = visits.length;
    const totalConversions = conversions.length;
    const conversionRate = totalVisits > 0 ? (totalConversions / totalVisits) * 100 : 0;

    // Group by Day (Grain is fixed to day in this simple implementation)
    const byDayMap = new Map<string, { date: string; visitas: number; citas: number }>();
    
    // Fill all days in the range to avoid gaps
    for (let i = daysLimit; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const formattedDate = d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
      byDayMap.set(dateStr, { date: formattedDate, visitas: 0, citas: 0 });
    }

    for (const event of events) {
      const dateStr = event.createdAt.toISOString().split('T')[0];
      const entry = byDayMap.get(dateStr);
      if (entry) {
        if (event.eventType === 'VISIT') entry.visitas++;
        else if (event.eventType === 'CONVERSION') entry.citas++;
      }
    }

    const byDay = Array.from(byDayMap.values());

    // Group by Campaign
    const byCampaignMap = new Map<string, any>();
    
    for (const camp of campaigns) {
      byCampaignMap.set(camp.code, {
        campaignCode: camp.code,
        campaignName: camp.name,
        visits: 0,
        appointments: 0,
        conversionRate: 0,
      });
    }
    
    for (const event of events) {
      if (!event.campaignCode) continue;
      let entry = byCampaignMap.get(event.campaignCode);
      if (!entry) {
        entry = {
          campaignCode: event.campaignCode,
          campaignName: event.campaignCode,
          visits: 0,
          appointments: 0,
          conversionRate: 0,
        };
        byCampaignMap.set(event.campaignCode, entry);
      }
      if (event.eventType === 'VISIT') entry.visits++;
      else if (event.eventType === 'CONVERSION') entry.appointments++;
    }

    for (const entry of byCampaignMap.values()) {
      entry.conversionRate = entry.visits > 0 ? (entry.appointments / entry.visits) * 100 : 0;
    }

    const byCampaign = Array.from(byCampaignMap.values());

    return {
      summary: {
        visits: totalVisits,
        appointments: totalConversions,
        conversionRate,
      },
      byDay,
      byCampaign,
    };
  }
}
