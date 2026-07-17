import { Controller, Get, Post, Patch, Body, Headers, Param, Query } from '@nestjs/common';
import { PublicBookingService } from './public-booking.service';
import { PublicAvailabilityQueryDto, PublicCreateAppointmentDto, PublicIdentityResolveDto, PublicIdentitySelectDto, PublicIdentityVerifyDto, UpdatePublicPatientProfileDto } from './dto/public-booking.dto';

@Controller('public/booking')
export class PublicBookingController {
  constructor(private readonly publicBookingService: PublicBookingService) {}

  @Get(':slug/config')
  async getConfig(@Param('slug') slug: string) {
    return this.publicBookingService.getConfig(slug);
  }

  @Get(':slug/availability')
  async getAvailability(@Param('slug') slug: string, @Query() query: PublicAvailabilityQueryDto) {
    return this.publicBookingService.getAvailability(slug, query);
  }

  @Post(':slug/appointments')
  async createAppointment(
    @Param('slug') slug: string,
    @Body() dto: PublicCreateAppointmentDto,
    @Headers('idempotency-key') idempotencyKey?: string
  ) {
    return this.publicBookingService.createAppointment(slug, dto, idempotencyKey);
  }

  @Post(':slug/identity/resolve')
  async resolveIdentity(@Param('slug') slug: string, @Body() dto: PublicIdentityResolveDto) {
    return this.publicBookingService.resolveIdentity(slug, dto);
  }

  @Post(':slug/identity/:sessionId/verify')
  async verifyIdentity(
    @Param('slug') slug: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: PublicIdentityVerifyDto
  ) {
    return this.publicBookingService.verifyIdentity(slug, sessionId, dto);
  }

  @Post(':slug/identity/:sessionId/select')
  async selectIdentity(
    @Param('slug') slug: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: PublicIdentitySelectDto
  ) {
    return this.publicBookingService.selectIdentity(slug, sessionId, dto.patientId, dto.familyGroupId);
  }

  @Post(':slug/track')
  async trackEvent(
    @Param('slug') slug: string,
    @Body() dto: { eventType: string; campaignCode?: string }
  ) {
    return this.publicBookingService.trackEvent(slug, dto.eventType, dto.campaignCode);
  }

  @Get('appointments/:id/confirm')
  async getAppointmentDetailsForConfirmation(
    @Param('id') id: string,
    @Query('token') token: string
  ) {
    return this.publicBookingService.getAppointmentDetailsForConfirmation(id, token);
  }

  @Post('appointments/:id/confirm')
  async confirmAppointment(
    @Param('id') id: string,
    @Query('token') token: string
  ) {
    return this.publicBookingService.confirmEmail(id, token);
  }

  @Post('appointments/:id/cancel')
  async cancelAppointment(
    @Param('id') id: string,
    @Query('token') token: string
  ) {

    return this.publicBookingService.cancelEmail(id, token);
  }

  @Get('appointments/:id/patient-profile')
  async getPatientProfile(
    @Param('id') id: string,
    @Query('token') token: string
  ) {
    return this.publicBookingService.getPatientProfile(id, token);
  }

  @Patch('appointments/:id/patient-profile')
  async updatePatientProfile(
    @Param('id') id: string,
    @Query('token') token: string,
    @Body() dto: UpdatePublicPatientProfileDto
  ) {
    return this.publicBookingService.updatePatientProfile(id, token, dto);
  }
}
