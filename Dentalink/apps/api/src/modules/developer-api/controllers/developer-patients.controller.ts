import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
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
  CreateDeveloperPatientDto,
  ListDeveloperPatientsQueryDto
} from "../dto/developer-api.dto";
import { DeveloperApiService } from "../developer-api.service";

@ApiTags("Developer - Patients")
@ApiBearerAuth()
@ApiHeader({ name: "X-Api-Key", required: false, description: "Alternativa a Bearer para credenciales dsk_live_..." })
@UseGuards(DeveloperApiKeyGuard, DeveloperApiRateLimitGuard, ApiScopesGuard)
@Controller("developer/patients")
export class DeveloperPatientsController {
  constructor(private readonly service: DeveloperApiService) {}

  @Get()
  @RequireApiScopes("patients:read")
  @ApiOperation({ summary: "Listar pacientes de forma paginada" })
  list(
    @CurrentM2MClient() client: AuthM2MClient,
    @Query() query: ListDeveloperPatientsQueryDto
  ) {
    return this.service.listPatients(client, query);
  }

  @Get(":id")
  @RequireApiScopes("patients:read")
  @ApiOperation({ summary: "Obtener detalle demografico de un paciente" })
  get(
    @CurrentM2MClient() client: AuthM2MClient,
    @Param("id") id: string
  ) {
    return this.service.getPatient(client, id);
  }

  @Post()
  @RequireApiScopes("patients:write")
  @ApiHeader({ name: "Idempotency-Key", required: true, description: "Clave unica por operacion y payload" })
  @ApiOperation({ summary: "Crear un nuevo paciente en la organizacion" })
  create(
    @CurrentM2MClient() client: AuthM2MClient,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: CreateDeveloperPatientDto
  ) {
    return this.service.createPatient(client, dto, idempotencyKey);
  }
}
