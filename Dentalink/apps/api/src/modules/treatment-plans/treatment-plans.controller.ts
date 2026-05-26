import {
  Body,
  Controller,
  Delete,
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
  CreateAlternativeDto,
  CreateBudgetDto,
  CreateTreatmentPlanDto,
  ListBudgetsQueryDto,
  ListTreatmentPlansQueryDto,
  TreatmentPlanSectionInputDto,
  UpdateTreatmentPlanDto,
  UpdateTreatmentPlanItemDto,
  UpdateTreatmentPlanItemStatusDto
} from "./dto/treatment-plan.dto";
import { TreatmentPlansService } from "./treatment-plans.service";

@ApiTags("Treatment Plans")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class TreatmentPlansController {
  constructor(private readonly service: TreatmentPlansService) {}

  @Get("treatment-plans")
  @RequirePermissions("treatment_plans.read")
  listTreatmentPlans(@CurrentUser() actor: AuthUser, @Query() query: ListTreatmentPlansQueryDto) {
    return this.service.listTreatmentPlans(actor, query);
  }

  @Post("treatment-plans")
  @RequirePermissions("treatment_plans.create")
  createTreatmentPlan(@CurrentUser() actor: AuthUser, @Body() dto: CreateTreatmentPlanDto) {
    return this.service.createTreatmentPlan(actor, dto);
  }

  @Get("treatment-plans/:id")
  @RequirePermissions("treatment_plans.read")
  getTreatmentPlan(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getTreatmentPlan(actor, id);
  }

  @Patch("treatment-plans/:id")
  @RequirePermissions("treatment_plans.update")
  updateTreatmentPlan(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateTreatmentPlanDto) {
    return this.service.updateTreatmentPlan(actor, id, dto);
  }

  @Post("treatment-plans/:id/sections")
  @RequirePermissions("treatment_plans.update")
  addSection(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: TreatmentPlanSectionInputDto) {
    return this.service.addSection(actor, id, dto);
  }

  @Post("treatment-plans/:id/alternatives")
  @RequirePermissions("treatment_plans.alternatives.manage")
  createAlternative(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CreateAlternativeDto) {
    return this.service.createAlternative(actor, id, dto);
  }

  @Post("treatment-plans/:id/alternatives/:alternativeId/activate")
  @RequirePermissions("treatment_plans.alternatives.manage")
  activateAlternative(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Param("alternativeId") alternativeId: string) {
    return this.service.activateAlternative(actor, id, alternativeId);
  }

  @Post("treatment-plans/:id/items")
  @RequirePermissions("treatment_plans.update")
  addItem(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateTreatmentPlanItemDto) {
    return this.service.addItem(actor, id, dto);
  }

  @Patch("treatment-plans/:id/items/:itemId")
  @RequirePermissions("treatment_plans.update")
  updateItem(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Param("itemId") itemId: string, @Body() dto: UpdateTreatmentPlanItemDto) {
    return this.service.updateItem(actor, id, itemId, dto);
  }

  @Patch("treatment-plans/:id/items/:itemId/status")
  @RequirePermissions("treatment_plans.status.update")
  updateItemStatus(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateTreatmentPlanItemStatusDto
  ) {
    return this.service.updateItemStatus(actor, id, itemId, dto);
  }

  @Delete("treatment-plans/:id/items/:itemId")
  @RequirePermissions("treatment_plans.update")
  deleteItem(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Param("itemId") itemId: string) {
    return this.service.deleteItem(actor, id, itemId);
  }

  @Post("treatment-plans/:id/budgets")
  @RequirePermissions("budgets.create")
  createBudget(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CreateBudgetDto) {
    return this.service.createBudget(actor, id, dto);
  }

  @Get("budgets")
  @RequirePermissions("budgets.read")
  listBudgets(@CurrentUser() actor: AuthUser, @Query() query: ListBudgetsQueryDto) {
    return this.service.listBudgets(actor, query);
  }

  @Get("budgets/:id")
  @RequirePermissions("budgets.read")
  getBudget(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getBudget(actor, id);
  }

  @Post("budgets/:id/send")
  @RequirePermissions("budgets.send")
  sendBudget(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.sendBudget(actor, id);
  }

  @Post("budgets/:id/accept")
  @RequirePermissions("budgets.accept")
  acceptBudget(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.acceptBudget(actor, id);
  }

  @Post("budgets/:id/reject")
  @RequirePermissions("budgets.reject")
  rejectBudget(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.rejectBudget(actor, id);
  }

  @Get("budgets/:id/print")
  @RequirePermissions("budgets.print")
  printBudget(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.printBudget(actor, id);
  }
}
