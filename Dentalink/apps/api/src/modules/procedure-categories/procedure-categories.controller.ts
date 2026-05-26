import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CreateProcedureCategoryDto } from "./dto/create-procedure-category.dto";
import { UpdateProcedureCategoryDto } from "./dto/update-procedure-category.dto";
import { ProcedureCategoriesService } from "./procedure-categories.service";

@ApiTags("ProcedureCategories")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("procedure-categories")
export class ProcedureCategoriesController {
  constructor(private readonly categoriesService: ProcedureCategoriesService) {}

  @Get()
  @RequirePermissions("procedure_categories.read")
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("active") active?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.categoriesService.findAll(user, search, active, page, pageSize);
  }

  @Get(":id")
  @RequirePermissions("procedure_categories.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.categoriesService.findOne(user, id);
  }

  @Post()
  @RequirePermissions("procedure_categories.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProcedureCategoryDto) {
    return this.categoriesService.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("procedure_categories.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateProcedureCategoryDto) {
    return this.categoriesService.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("procedure_categories.deactivate")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.categoriesService.deactivate(user, id);
  }
}
