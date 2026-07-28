import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { OrthodonticsController } from './orthodontics.controller';
import { OrthodonticsService } from './orthodontics.service';
import { OrthodonticProgressService } from './orthodontic-progress.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrthodonticsController],
  providers: [OrthodonticsService, OrthodonticProgressService],
  exports: [OrthodonticsService, OrthodonticProgressService],
})
export class OrthodonticsModule {}
