import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CreatePriceListDto } from "./dto/create-price-list.dto";
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
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.priceListsService.findAll(user, search, active, page, pageSize);
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

  @Patch(":id/deactivate")
  @RequirePermissions("price_lists.deactivate")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.priceListsService.deactivate(user, id);
  }
}
