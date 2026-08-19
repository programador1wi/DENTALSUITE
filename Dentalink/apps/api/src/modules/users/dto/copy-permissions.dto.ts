import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CopyPermissionsDto {
  @ApiProperty({ description: 'Source user ID to copy permissions from' })
  @IsString()
  sourceUserId!: string;
}
