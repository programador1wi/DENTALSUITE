import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserPermissionsDto {
  @ApiProperty({ description: 'Permission IDs to assign to the user' })
  @IsArray()
  @IsString({ each: true })
  permissionIds!: string[];

  @ApiProperty({ description: 'Whether to override role permissions', required: false })
  @IsOptional()
  @IsBoolean()
  permissionsOverride?: boolean;
}
