import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserBranchesDto {
  @ApiProperty({ description: 'Branch IDs to assign' })
  @IsArray()
  @IsString({ each: true })
  branchIds!: string[];

  @ApiProperty({ description: 'Primary branch ID', required: false })
  @IsOptional()
  @IsString()
  primaryBranchId?: string;
}
