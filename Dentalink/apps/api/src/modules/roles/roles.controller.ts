import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CreateRoleDto } from "./dto/create-role.dto";
import { ListRolesQueryDto } from "./dto/list-roles-query.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RolesService } from "./roles.service";

@ApiTags("Roles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions("roles.read")
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListRolesQueryDto) {
    return this.rolesService.findAll(user, query);
  }

  @Get(":id")
  @RequirePermissions("roles.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.rolesService.findOne(user, id);
  }

  @Post()
  @RequirePermissions("organization.manage_all", "roles.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("organization.manage_all", "roles.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("organization.manage_all", "roles.deactivate")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.rolesService.deactivate(user, id);
  }
}
