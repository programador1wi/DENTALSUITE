import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthUser } from "../../../common/types/auth-user";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RequireAnyPermission } from "../../../common/decorators/permissions.decorator";
import { OrthodonticCatalogsService } from "../services/orthodontic-catalogs.service";

@Controller("clinical/orthodontics")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrthodonticCatalogsController {
  constructor(private readonly orthodonticCatalogsService: OrthodonticCatalogsService) {}

  @Get("materials")
  @RequireAnyPermission("clinical.read", "orthodontic_catalogs.manage", "treatment_plans.read")
  async getMaterials(@CurrentUser() user: AuthUser) {
    return this.orthodonticCatalogsService.getMaterials(user.organizationId);
  }

  @Get("arch-sizes")
  @RequireAnyPermission("clinical.read", "orthodontic_catalogs.manage", "treatment_plans.read")
  async getArchSizes(@CurrentUser() user: AuthUser) {
    return this.orthodonticCatalogsService.getArchSizes(user.organizationId);
  }
}
