import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { PublicBookingService } from './public-booking.service';
import { PublicAvailabilityQueryDto, PublicCreateAppointmentDto } from './dto/public-booking.dto';

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
  async createAppointment(@Param('slug') slug: string, @Body() dto: PublicCreateAppointmentDto) {
    return this.publicBookingService.createAppointment(slug, dto);
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
}
