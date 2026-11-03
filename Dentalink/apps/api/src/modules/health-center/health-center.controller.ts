import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CreateBranchDto } from "../branches/dto/create-branch.dto";
import { CreateBrandDto, ListBrandsQueryDto, UpdateBrandDto } from "./dto/brand.dto";
import { HealthCenterService } from "./health-center.service";

@ApiTags("Health center")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("health-center")
export class HealthCenterController {
  constructor(private readonly service: HealthCenterService) {}

  @Get()
  @RequirePermissions("health_center.view")
  overview(@CurrentUser() actor: AuthUser, @Query() query: ListBrandsQueryDto) {
    return this.service.overview(actor, query);
  }
}

@ApiTags("Brands")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("brands")
export class BrandsController {
  constructor(private readonly service: HealthCenterService) {}

  @Get()
  @RequirePermissions("brands.view")
  list(@CurrentUser() actor: AuthUser, @Query() query: ListBrandsQueryDto) {
    return this.service.listBrands(actor, query);
  }

  @Post()
  @RequirePermissions("brands.create")
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateBrandDto) {
    return this.service.createBrand(actor, dto);
  }

  @Get(":id")
  @RequirePermissions("brands.view")
  get(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getBrand(actor, id);
  }

  @Patch(":id")
  @RequirePermissions("brands.update")
  update(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateBrandDto) {
    return this.service.updateBrand(actor, id, dto);
  }

  @Post(":id/archive")
  @RequirePermissions("brands.archive")
  archive(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.archiveBrand(actor, id);
  }

  @Post(":id/restore")
  @RequirePermissions("brands.archive")
  restore(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.restoreBrand(actor, id);
  }

  @Get(":id/branches")
  @RequirePermissions("branches.read")
  branches(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.listBrandBranches(actor, id);
  }

  @Post(":id/branches")
  @RequirePermissions("branches.create")
  createBranch(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CreateBranchDto) {
    return this.service.createBranchForBrand(actor, id, dto);
  }
}
