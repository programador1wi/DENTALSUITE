import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyProfileDto {
  @ApiProperty({ description: 'Profile ID to apply' })
  @IsString()
  profileId!: string;
}
