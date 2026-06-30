import { Controller, Get, Body, Patch, Post, Param, Req, UseGuards, Query } from '@nestjs/common';
import { OnlineSchedulingService } from './online-scheduling.service';
import { UpdateOnlineSchedulingDto } from './dto/update-online-scheduling.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user';

@Controller('online-scheduling')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OnlineSchedulingController {
  constructor(private readonly onlineSchedulingService: OnlineSchedulingService) {}

  @Get('config')
  @RequirePermissions('online_scheduling.read')
  async getConfig(@Req() req: { user: AuthUser }, @Query('mode') mode?: 'ONLINE' | 'EXPRESS') {
    return this.onlineSchedulingService.getConfig(req.user.organizationId, mode);
  }

  @Patch('config')
  @RequirePermissions('online_scheduling.update')
  async updateConfig(@Req() req: { user: AuthUser }, @Body() dto: UpdateOnlineSchedulingDto) {
    return this.onlineSchedulingService.updateConfig(req.user.organizationId, dto, req.user.id);
  }

  @Post('config/regenerate-slug')
  @RequirePermissions('online_scheduling.update')
  async regenerateSlug(@Req() req: { user: AuthUser }) {
    return this.onlineSchedulingService.regenerateSlug(req.user.organizationId);
  }

  @Get('preview/:slug')
  @RequirePermissions('online_scheduling.read')
  async getPreviewBySlug(@Req() req: { user: AuthUser }, @Param('slug') slug: string) {
    return this.onlineSchedulingService.getPreviewBySlug(slug, req.user.organizationId);
  }
}
