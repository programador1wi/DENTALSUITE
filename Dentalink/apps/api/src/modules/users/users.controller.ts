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
}
