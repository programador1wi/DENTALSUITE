import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { ListProfilesQueryDto } from "./dto/list-profiles-query.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { PermissionProfilesService } from "./permission-profiles.service";

@ApiTags("Permission Profiles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("permission-profiles")
export class PermissionProfilesController {
  constructor(private readonly permissionProfilesService: PermissionProfilesService) {}

  @Get()
  @RequirePermissions("admin.roles.manage")
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListProfilesQueryDto) {
    return this.permissionProfilesService.findAll(user, query);
  }

  @Get(":id")
  @RequirePermissions("admin.roles.manage")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.permissionProfilesService.findOne(user, id);
  }

  @Post()
  @RequirePermissions("admin.roles.manage")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProfileDto) {
    return this.permissionProfilesService.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("admin.roles.manage")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateProfileDto) {
    return this.permissionProfilesService.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("admin.roles.manage")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.permissionProfilesService.deactivate(user, id);
  }
}
