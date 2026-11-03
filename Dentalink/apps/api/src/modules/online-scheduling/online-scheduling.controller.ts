import { Controller, Get, Body, Patch, Post, Param, Req, UseGuards, Query } from '@nestjs/common';
import { OnlineSchedulingService } from './online-scheduling.service';
import { UpdateOnlineSchedulingDto } from './dto/update-online-scheduling.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user';

@Controller('online-scheduling')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OnlineSchedulingController {
  constructor(private readonly onlineSchedulingService: OnlineSchedulingService) {}

  @Get('config')
  @RequirePermissions('schedules.read')
  async getConfig(@Req() req: { user: AuthUser }, @Query('mode') mode?: 'ONLINE' | 'EXPRESS') {
    return this.onlineSchedulingService.getConfig(req.user.organizationId, mode);
  }

  @Patch('config')
  @RequirePermissions('schedules.update')
  async updateConfig(@Req() req: { user: AuthUser }, @Body() dto: UpdateOnlineSchedulingDto) {
    return this.onlineSchedulingService.updateConfig(req.user.organizationId, dto, req.user.id);
  }

  @Post('config/regenerate-slug')
  @RequirePermissions('schedules.update')
  async regenerateSlug(@Req() req: { user: AuthUser }) {
    return this.onlineSchedulingService.regenerateSlug(req.user.organizationId);
  }

  @Get('preview/:slug')
  @RequirePermissions('schedules.read')
  async getPreviewBySlug(@Req() req: { user: AuthUser }, @Param('slug') slug: string) {
    return this.onlineSchedulingService.getPreviewBySlug(slug, req.user.organizationId);
  }

  @Get('campaigns')
  @RequirePermissions('schedules.read')
  async getCampaigns(@Req() req: { user: AuthUser }) {
    return this.onlineSchedulingService.getCampaigns(req.user.organizationId);
  }

  @Post('campaigns')
  @RequirePermissions('schedules.update')
  async createCampaign(@Req() req: { user: AuthUser }, @Body() dto: CreateCampaignDto) {
    return this.onlineSchedulingService.createCampaign(req.user.organizationId, dto);
  }

  @Patch('campaigns/:id')
  @RequirePermissions('schedules.update')
  async deleteCampaign(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.onlineSchedulingService.deleteCampaign(req.user.organizationId, id);
  }

  @Get('dashboard/stats')
  @RequirePermissions('schedules.read')
  async getDashboardStats(
    @Req() req: { user: AuthUser },
    @Query('period') period?: string,
    @Query('grain') grain?: string
  ) {
    return this.onlineSchedulingService.getDashboardStats(req.user.organizationId, period, grain);
  }
}
