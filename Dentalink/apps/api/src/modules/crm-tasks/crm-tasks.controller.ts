import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  CancelCrmTaskDto,
  CreateCrmTaskDto,
  CrmTaskConfigurationQueryDto,
  CrmTaskStatisticsQueryDto,
  CrmTaskVersionDto,
  ListCrmTasksQueryDto,
  UpdateCrmTaskConfigurationDto,
  UpdateCrmTaskDto
} from "./dto/crm-tasks.dto";
import { CrmTasksService } from "./crm-tasks.service";

@ApiTags("CRM Tasks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("crm/tasks")
export class CrmTasksController {
  constructor(private readonly service: CrmTasksService) {}

  @Get()
  @RequirePermissions("crm.tasks.read")
  list(@CurrentUser() actor: AuthUser, @Query() query: ListCrmTasksQueryDto) {
    return this.service.list(actor, query);
  }

  @Get("statistics")
  @RequirePermissions("crm.tasks.statistics.read")
  statistics(@CurrentUser() actor: AuthUser, @Query() query: CrmTaskStatisticsQueryDto) {
    return this.service.statistics(actor, query);
  }

  @Get("configuration")
  @RequirePermissions("crm.tasks.configuration.read")
  configuration(@CurrentUser() actor: AuthUser, @Query() query: CrmTaskConfigurationQueryDto) {
    return this.service.getConfiguration(actor, query.branchId);
  }

  @Put("configuration")
  @RequirePermissions("crm.tasks.configuration.update")
  updateConfiguration(@CurrentUser() actor: AuthUser, @Body() dto: UpdateCrmTaskConfigurationDto) {
    return this.service.updateConfiguration(actor, dto);
  }

  @Get(":id")
  @RequirePermissions("crm.tasks.read")
  get(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.get(actor, id);
  }

  @Get(":id/history")
  @RequirePermissions("crm.tasks.read")
  history(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.history(actor, id);
  }

  @Post()
  @RequirePermissions("crm.tasks.create")
  create(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateCrmTaskDto,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.service.create(actor, dto, idempotencyKey);
  }

  @Patch(":id")
  @RequirePermissions("crm.tasks.update")
  update(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateCrmTaskDto) {
    return this.service.update(actor, id, dto);
  }

  @Post(":id/complete")
  @RequirePermissions("crm.tasks.complete")
  complete(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CrmTaskVersionDto) {
    return this.service.complete(actor, id, dto.version);
  }

  @Post(":id/reopen")
  @RequirePermissions("crm.tasks.reopen")
  reopen(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CrmTaskVersionDto) {
    return this.service.reopen(actor, id, dto.version);
  }

  @Post(":id/cancel")
  @RequirePermissions("crm.tasks.cancel")
  cancel(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CancelCrmTaskDto) {
    return this.service.cancel(actor, id, dto);
  }
}
