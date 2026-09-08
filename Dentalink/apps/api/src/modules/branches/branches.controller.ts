import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { BranchesService } from "./branches.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

@ApiTags("Branches")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("branches")
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @RequirePermissions("branches.read")
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.branchesService.findAll(user, search, status, page, pageSize);
  }

  @Get(":id")
  @RequirePermissions("branches.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.branchesService.findOne(user, id);
  }

  @Post()
  @RequirePermissions("organization.manage_all", "branches.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("branches.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("branches.deactivate")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.branchesService.deactivate(user, id);
  }

  @Post(":id/archive")
  @RequirePermissions("branches.archive")
  archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.branchesService.archive(user, id);
  }

  @Post(":id/restore")
  @RequirePermissions("branches.restore")
  restore(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.branchesService.restore(user, id);
  }
}
