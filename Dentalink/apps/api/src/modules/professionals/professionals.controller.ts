import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CreateProfessionalDto } from "./dto/create-professional.dto";
import { UpdateProfessionalDto } from "./dto/update-professional.dto";
import { ProfessionalsService } from "./professionals.service";

@ApiTags("Professionals")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("professionals")
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  @Get()
  @RequirePermissions("professionals.read")
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("active") active?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.professionalsService.findAll(user, search, active, page, pageSize);
  }

  @Get(":id")
  @RequirePermissions("professionals.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.professionalsService.findOne(user, id);
  }

  @Post()
  @RequirePermissions("professionals.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProfessionalDto) {
    return this.professionalsService.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("professionals.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateProfessionalDto) {
    return this.professionalsService.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("professionals.deactivate")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.professionalsService.deactivate(user, id);
  }
}
