import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { OrthodonticsController } from './orthodontics.controller';
import { OrthodonticsService } from './orthodontics.service';
import { OrthodonticProgressModule } from './orthodontic-progress.module';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [PrismaModule, OrthodonticProgressModule, AppointmentsModule],
  controllers: [OrthodonticsController],
  providers: [OrthodonticsService],
  exports: [OrthodonticsService, OrthodonticProgressModule],
})
export class OrthodonticsModule {}
