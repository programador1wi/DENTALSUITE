import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  AddCollectionActivityDto,
  AssignCollectionCaseDto,
  CreateCollectionCaseDto,
  DetectOverdueCasesDto,
  ListCollectionCasesQueryDto,
  UpdateCollectionCaseStatusDto
} from "./dto/collections.dto";
import { CollectionsService } from "./collections.service";

@ApiTags("Collections")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("collections")
export class CollectionsController {
  constructor(private readonly service: CollectionsService) {}

  @Get()
  @RequirePermissions("collections.read")
  listCases(@CurrentUser() actor: AuthUser, @Query() query: ListCollectionCasesQueryDto) {
    return this.service.listCases(actor, query);
  }

  @Post("detect-overdue")
  @RequirePermissions("collections.detect")
  detectOverdue(@CurrentUser() actor: AuthUser, @Body() dto: DetectOverdueCasesDto) {
    return this.service.detectOverdueCases(actor, dto);
  }

  @Post()
  @RequirePermissions("collections.create")
  createCase(@CurrentUser() actor: AuthUser, @Body() dto: CreateCollectionCaseDto) {
    return this.service.createCase(actor, dto);
  }

  @Get(":id")
  @RequirePermissions("collections.read")
  getCase(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getCase(actor, id);
  }

  @Patch(":id/status")
  @RequirePermissions("collections.update")
  updateStatus(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateCollectionCaseStatusDto) {
    return this.service.updateStatus(actor, id, dto);
  }

  @Patch(":id/assign")
  @RequirePermissions("collections.update")
  assignCase(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: AssignCollectionCaseDto) {
    return this.service.assignCase(actor, id, dto);
  }

  @Post(":id/activities")
  @RequirePermissions("collections.activities.create")
  addActivity(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: AddCollectionActivityDto) {
    return this.service.addActivity(actor, id, dto);
  }
}
