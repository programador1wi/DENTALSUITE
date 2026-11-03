import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
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
import {
  CreateDeveloperAppointmentDto,
  ListDeveloperAppointmentsQueryDto
} from "../dto/developer-api.dto";
import { DeveloperApiService } from "../developer-api.service";

@ApiTags("Developer - Appointments")
@ApiBearerAuth()
@ApiHeader({ name: "X-Api-Key", required: false, description: "Alternativa a Bearer para credenciales dsk_live_..." })
@UseGuards(DeveloperApiKeyGuard, DeveloperApiRateLimitGuard, ApiScopesGuard)
@Controller("developer/appointments")
export class DeveloperAppointmentsController {
  constructor(private readonly service: DeveloperApiService) {}

  @Get()
  @RequireApiScopes("appointments:read")
  @ApiOperation({ summary: "Consultar citas por rango de fechas" })
  list(
    @CurrentM2MClient() client: AuthM2MClient,
    @Query() query: ListDeveloperAppointmentsQueryDto
  ) {
    return this.service.listAppointments(client, query);
  }

  @Post()
  @RequireApiScopes("appointments:write")
  @ApiHeader({ name: "Idempotency-Key", required: true, description: "Clave unica por operacion y payload" })
  @ApiOperation({ summary: "Crear una cita para un paciente" })
  create(
    @CurrentM2MClient() client: AuthM2MClient,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: CreateDeveloperAppointmentDto
  ) {
    return this.service.createAppointment(client, dto, idempotencyKey);
  }
}
