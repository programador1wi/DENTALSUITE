import {
  Controller,
  Get,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentM2MClient } from "../../../common/decorators/current-m2m-client.decorator";
import { RequireApiScopes } from "../../../common/decorators/require-api-scopes.decorator";
import { ApiScopesGuard } from "../../../common/guards/api-scopes.guard";
import { DeveloperApiKeyGuard } from "../../../common/guards/developer-api-key.guard";
import { DeveloperApiRateLimitGuard } from "../../../common/guards/developer-api-rate-limit.guard";
import { AuthM2MClient } from "../../../common/types/m2m-client.type";
import { ListDeveloperBudgetsQueryDto } from "../dto/developer-api.dto";
import { DeveloperApiService } from "../developer-api.service";

@ApiTags("Developer - Budgets")
@ApiBearerAuth()
@ApiHeader({ name: "X-Api-Key", required: false, description: "Alternativa a Bearer para credenciales dsk_live_..." })
@UseGuards(DeveloperApiKeyGuard, DeveloperApiRateLimitGuard, ApiScopesGuard)
@Controller("developer/budgets")
export class DeveloperBudgetsController {
  constructor(private readonly service: DeveloperApiService) {}

  @Get()
  @RequireApiScopes("budgets:read")
  @ApiOperation({ summary: "Listar presupuestos de la organizacion" })
  list(
    @CurrentM2MClient() client: AuthM2MClient,
    @Query() query: ListDeveloperBudgetsQueryDto
  ) {
    return this.service.listBudgets(client, query);
  }
}
