import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { ChairsService } from "./chairs.service";
import { CreateChairDto } from "./dto/create-chair.dto";
import { UpdateChairDto } from "./dto/update-chair.dto";

@ApiTags("Chairs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("chairs")
export class ChairsController {
  constructor(private readonly chairsService: ChairsService) {}

  @Get()
  @RequirePermissions("chairs.read")
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("active") active?: string,
    @Query("branchId") branchId?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.chairsService.findAll(user, search, active, branchId, page, pageSize);
  }

  @Get(":id")
  @RequirePermissions("chairs.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.chairsService.findOne(user, id);
  }

  @Post()
  @RequirePermissions("chairs.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateChairDto) {
    return this.chairsService.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("chairs.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateChairDto) {
    return this.chairsService.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("chairs.deactivate")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.chairsService.deactivate(user, id);
  }
}
