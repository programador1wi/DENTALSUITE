import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { UpdatePatientFieldConfigDto } from "./dto/update-patient-field-config.dto";
import { PatientFieldConfigService } from "./patient-field-config.service";

@Controller("patient-field-config")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PatientFieldConfigController {
  constructor(private readonly service: PatientFieldConfigService) {}

  @Get()
  @RequirePermissions("patients.read")
  async getConfig(@CurrentUser() actor: AuthUser) {
    return this.service.getByOrganization(actor.organizationId);
  }

  @Put()
  @RequirePermissions("patients.create")
  async updateConfig(
    @CurrentUser() actor: AuthUser,
    @Body() dto: UpdatePatientFieldConfigDto
  ) {
    return this.service.update(actor.organizationId, dto);
  }
}
