import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CreateSpecialtyDto } from "./dto/create-specialty.dto";
import {
  CreateSpecialtyAppointmentReasonDto,
  CreateSpecialtyClinicalTemplateDto,
  UpdateSpecialtyAppointmentReasonDto,
  UpdateSpecialtyClinicalTemplateDto
} from "./dto/specialty-workflows.dto";
import { UpdateSpecialtyDto } from "./dto/update-specialty.dto";
import { SpecialtiesService } from "./specialties.service";

@ApiTags("Specialties")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("specialties")
export class SpecialtiesController {
  constructor(private readonly specialtiesService: SpecialtiesService) {}

  @Get()
  @RequirePermissions("specialties.read")
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("active") active?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.specialtiesService.findAll(user, search, active, page, pageSize);
  }

  @Get(":id")
  @RequirePermissions("specialties.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.specialtiesService.findOne(user, id);
  }

  @Post()
  @RequirePermissions("specialties.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSpecialtyDto) {
    return this.specialtiesService.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("specialties.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateSpecialtyDto) {
    return this.specialtiesService.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("specialties.deactivate")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.specialtiesService.deactivate(user, id);
  }

  @Get(":id/clinical-templates")
  @RequirePermissions("specialties.read")
  listClinicalTemplates(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("type") type?: "PRESCRIPTION" | "EVOLUTION",
    @Query("active") active?: string
  ) {
    return this.specialtiesService.listClinicalTemplates(user, id, type, active);
  }

  @Post(":id/clinical-templates")
  @RequirePermissions("specialties.update")
  createClinicalTemplate(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CreateSpecialtyClinicalTemplateDto
  ) {
    return this.specialtiesService.createClinicalTemplate(user, id, dto);
  }

  @Patch(":id/clinical-templates/:templateId")
  @RequirePermissions("specialties.update")
  updateClinicalTemplate(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("templateId") templateId: string,
    @Body() dto: UpdateSpecialtyClinicalTemplateDto
  ) {
    return this.specialtiesService.updateClinicalTemplate(user, id, templateId, dto);
  }

  @Get(":id/appointment-reasons")
  @RequirePermissions("specialties.read")
  listAppointmentReasons(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("active") active?: string) {
    return this.specialtiesService.listAppointmentReasons(user, id, active);
  }

  @Post(":id/appointment-reasons")
  @RequirePermissions("specialties.update")
  createAppointmentReason(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CreateSpecialtyAppointmentReasonDto
  ) {
    return this.specialtiesService.createAppointmentReason(user, id, dto);
  }

  @Patch(":id/appointment-reasons/:reasonId")
  @RequirePermissions("specialties.update")
  updateAppointmentReason(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("reasonId") reasonId: string,
    @Body() dto: UpdateSpecialtyAppointmentReasonDto
  ) {
    return this.specialtiesService.updateAppointmentReason(user, id, reasonId, dto);
  }
}
