import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CreateProfessionalScheduleDto } from "./dto/create-professional-schedule.dto";
import { UpdateProfessionalScheduleDto } from "./dto/update-professional-schedule.dto";
import { CreateProfessionalSpecialScheduleDto } from "./dto/create-professional-special-schedule.dto";
import { UpdateProfessionalSpecialScheduleDto } from "./dto/update-professional-special-schedule.dto";
import { ProfessionalSchedulesService } from "./professional-schedules.service";

@ApiTags("ProfessionalSchedules")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("professional-schedules")
export class ProfessionalSchedulesController {
  constructor(private readonly professionalSchedulesService: ProfessionalSchedulesService) {}

  @Get()
  @RequirePermissions("schedules.read")
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("professionalId") professionalId?: string,
    @Query("branchId") branchId?: string,
    @Query("dayOfWeek") dayOfWeek?: string,
    @Query("active") active?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.professionalSchedulesService.findAll(user, professionalId, branchId, dayOfWeek, active, page, pageSize);
  }

  @Get("special")
  @RequirePermissions("schedules.read")
  findAllSpecial(
    @CurrentUser() user: AuthUser,
    @Query("professionalId") professionalId?: string,
    @Query("branchId") branchId?: string,
    @Query("date") date?: string,
    @Query("active") active?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.professionalSchedulesService.findAllSpecial(user, professionalId, branchId, date, active, page, pageSize);
  }

  @Get(":id")
  @RequirePermissions("schedules.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.professionalSchedulesService.findOne(user, id);
  }

  @Post()
  @RequirePermissions("schedules.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProfessionalScheduleDto) {
    return this.professionalSchedulesService.create(user, dto);
  }

  @Post("special")
  @RequirePermissions("schedules.create")
  createSpecial(@CurrentUser() user: AuthUser, @Body() dto: CreateProfessionalSpecialScheduleDto) {
    return this.professionalSchedulesService.createSpecial(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("schedules.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateProfessionalScheduleDto) {
    return this.professionalSchedulesService.update(user, id, dto);
  }

  @Patch("special/:id")
  @RequirePermissions("schedules.update")
  updateSpecial(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateProfessionalSpecialScheduleDto) {
    return this.professionalSchedulesService.updateSpecial(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("schedules.deactivate")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.professionalSchedulesService.deactivate(user, id);
  }

  @Patch("special/:id/deactivate")
  @RequirePermissions("schedules.deactivate")
  deactivateSpecial(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.professionalSchedulesService.deactivateSpecial(user, id);
  }
}
