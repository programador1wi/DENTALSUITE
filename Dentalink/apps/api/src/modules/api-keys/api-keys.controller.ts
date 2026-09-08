import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { ApiKeysService } from "./api-keys.service";
import { CreateApiKeyDto, ListApiKeysQueryDto, UpdateApiKeyDto } from "./dto/api-keys.dto";

@ApiTags("Settings - Developer API credentials")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("settings/api-keys")
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Get()
  @RequirePermissions("developer_api.credentials.read")
  @ApiOperation({ summary: "Listar credenciales API sin secretos" })
  list(@CurrentUser() actor: AuthUser, @Query() query: ListApiKeysQueryDto) {
    return this.service.listApiKeys(actor, query);
  }

  @Get("options")
  @RequirePermissions("developer_api.credentials.read")
  @ApiOperation({ summary: "Obtener scopes, sucursales y cuota disponibles" })
  options(@CurrentUser() actor: AuthUser) {
    return this.service.getOptions(actor);
  }

  @Get(":id")
  @RequirePermissions("developer_api.credentials.read")
  get(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getApiKey(actor, id);
  }

  @Post()
  @RequirePermissions("developer_api.credentials.manage")
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateApiKeyDto) {
    return this.service.createApiKey(actor, dto);
  }

  @Patch(":id")
  @RequirePermissions("developer_api.credentials.manage")
  update(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateApiKeyDto) {
    return this.service.updateApiKey(actor, id, dto);
  }

  @Post(":id/rotate")
  @RequirePermissions("developer_api.credentials.manage")
  rotate(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.rotateApiKey(actor, id);
  }

  @Post(":id/revoke")
  @RequirePermissions("developer_api.credentials.manage")
  revoke(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.revokeApiKey(actor, id);
  }
}
