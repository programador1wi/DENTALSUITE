import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CreatePermissionDto } from "./dto/create-permission.dto";
import { ListPermissionsQueryDto } from "./dto/list-permissions-query.dto";
import { UpdatePermissionDto } from "./dto/update-permission.dto";
import { PermissionsService } from "./permissions.service";
import { AuthUser } from "../../common/types/auth-user";

@ApiTags("Permissions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("permissions")
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions("permissions.read")
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListPermissionsQueryDto) {
    return this.permissionsService.findAll(user, query);
  }

  @Get(":id")
  @RequirePermissions("permissions.read")
  findOne(@Param("id") id: string) {
    return this.permissionsService.findOne(id);
  }

  @Post()
  @RequirePermissions("permissions.create")
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("permissions.update")
  update(@Param("id") id: string, @Body() dto: UpdatePermissionDto) {
    return this.permissionsService.update(id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("permissions.deactivate")
  deactivate(@Param("id") id: string) {
    return this.permissionsService.deactivate(id);
  }
}
