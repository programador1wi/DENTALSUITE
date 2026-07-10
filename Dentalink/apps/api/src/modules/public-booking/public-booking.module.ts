import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PublicBookingService } from './public-booking.service';
import { PublicBookingController } from './public-booking.controller';
import { AppointmentsModule } from '../appointments/appointments.module';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [AppointmentsModule, PrismaModule, JwtModule.register({})],
  controllers: [PublicBookingController],
  providers: [PublicBookingService],
})
export class PublicBookingModule {}
