import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { UpdateBranchPriceListsDto } from "./dto/branch-price-list.dto";
import { CreatePriceListDto } from "./dto/create-price-list.dto";
import { CreatePriceListCategoryDto, UpdatePriceListCategoryDto } from "./dto/price-list-category.dto";
import { UpdatePriceListDto } from "./dto/update-price-list.dto";
import { PriceListsService } from "./price-lists.service";

@ApiTags("PriceLists")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("price-lists")
export class PriceListsController {
  constructor(private readonly priceListsService: PriceListsService) {}

  @Get()
  @RequirePermissions("price_lists.read")
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("active") active?: string,
    @Query("branchId") branchId?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.priceListsService.findAll(user, search, active, page, pageSize, branchId);
  }

  @Get("availability-matrix")
  @RequirePermissions("price_lists.read")
  availabilityMatrix(@CurrentUser() user: AuthUser) {
    return this.priceListsService.availabilityMatrix(user);
  }

  @Get(":id")
  @RequirePermissions("price_lists.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.priceListsService.findOne(user, id);
  }

  @Post()
  @RequirePermissions("price_lists.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePriceListDto) {
    return this.priceListsService.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("price_lists.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdatePriceListDto) {
    return this.priceListsService.update(user, id, dto);
  }

  @Patch(":id/branches")
  @RequirePermissions("price_lists.update")
  updateBranchAssignments(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateBranchPriceListsDto
  ) {
    return this.priceListsService.updateBranchAssignments(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("price_lists.deactivate")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.priceListsService.deactivate(user, id);
  }

  @Post(":id/categories")
  @RequirePermissions("price_lists.update")
  createCategory(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CreatePriceListCategoryDto
  ) {
    return this.priceListsService.createCategory(user, id, dto);
  }

  @Patch(":id/categories/:categoryId")
  @RequirePermissions("price_lists.update")
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("categoryId") categoryId: string,
    @Body() dto: UpdatePriceListCategoryDto
  ) {
    return this.priceListsService.updateCategory(user, id, categoryId, dto);
  }

  @Patch(":id/categories/:categoryId/deactivate")
  @RequirePermissions("price_lists.update")
  deactivateCategory(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("categoryId") categoryId: string
  ) {
    return this.priceListsService.deactivateCategory(user, id, categoryId);
  }
}
