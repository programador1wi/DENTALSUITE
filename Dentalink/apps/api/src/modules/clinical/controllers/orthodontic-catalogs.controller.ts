import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthUser } from "../../../common/types/auth-user";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { OrthodonticCatalogsService } from "../services/orthodontic-catalogs.service";

@Controller("clinical/orthodontics")
@UseGuards(JwtAuthGuard)
export class OrthodonticCatalogsController {
  constructor(private readonly orthodonticCatalogsService: OrthodonticCatalogsService) {}

  @Get("materials")
  async getMaterials(@CurrentUser() user: AuthUser) {
    return this.orthodonticCatalogsService.getMaterials(user.organizationId);
  }

  @Get("arch-sizes")
  async getArchSizes(@CurrentUser() user: AuthUser) {
    return this.orthodonticCatalogsService.getArchSizes(user.organizationId);
  }
}
