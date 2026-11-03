import { Module } from '@nestjs/common';
import { OnlineSchedulingService } from './online-scheduling.service';
import { OnlineSchedulingController } from './online-scheduling.controller';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OnlineSchedulingController],
  providers: [OnlineSchedulingService],
  exports: [OnlineSchedulingService],
})
export class OnlineSchedulingModule {}
