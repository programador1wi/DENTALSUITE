import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CreateUserDto } from "./dto/create-user.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateUserPermissionsDto } from "./dto/update-user-permissions.dto";
import { ApplyProfileDto } from "./dto/apply-profile.dto";
import { CopyPermissionsDto } from "./dto/copy-permissions.dto";
import { UpdateUserBranchesDto } from "./dto/update-user-branches.dto";
import { UsersService } from "./users.service";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions("users.read")
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(user, query);
  }

  @Get(":id/permissions")
  @RequirePermissions("permissions.read")
  getUserPermissions(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.usersService.getUserPermissions(user, id);
  }

  @Patch(":id/permissions")
  @RequirePermissions("admin.user_permissions.manage")
  updateUserPermissions(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateUserPermissionsDto
  ) {
    return this.usersService.updateUserPermissions(user, id, dto);
  }

  @Post(":id/apply-profile")
  @RequirePermissions("admin.user_permissions.manage")
  applyProfile(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ApplyProfileDto
  ) {
    return this.usersService.applyProfile(user, id, dto);
  }

  @Post(":id/copy-permissions")
  @RequirePermissions("admin.user_permissions.manage")
  copyPermissions(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CopyPermissionsDto
  ) {
    return this.usersService.copyPermissions(user, id, dto);
  }

  @Patch(":id/branches")
  @RequirePermissions("users.manage_branch_access")
  updateBranches(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateUserBranchesDto
  ) {
    return this.usersService.updateBranches(user, id, dto);
  }

  @Get(":id")
  @RequirePermissions("users.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.usersService.findOne(user, id);
  }

  @Post()
  @RequirePermissions("users.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user, dto);
  }

  @Patch("lock-access")
  @RequirePermissions("users.update")
  lockAccess(@CurrentUser() user: AuthUser) {
    return this.usersService.lockAccess(user);
  }

  @Patch(":id")
  @RequirePermissions("users.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("users.deactivate")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.usersService.deactivate(user, id);
  }

  @Patch(":id/reactivate")
  @RequirePermissions("users.update")
  reactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.usersService.reactivate(user, id);
  }
}
