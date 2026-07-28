import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CrmSurveysService } from "./crm-surveys.service";
import {
  CreateSurveyDefinitionDto,
  CreateSurveyQuestionDto,
  CreateSurveySectionDto,
  ListSurveyDefinitionsQueryDto,
  RecordSurveyDeliveryDto,
  ReorderSurveyItemsDto,
  SubmitPublicSurveyDto,
  SurveyResultsQueryDto,
  UpdateSurveyDefinitionDto,
  UpdateSurveyQuestionDto,
  UpdateSurveySectionDto,
  UpdateSurveySendConfigurationDto
} from "./dto/crm-surveys.dto";

@ApiTags("CRM Satisfaction Surveys")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("crm/surveys")
export class CrmSurveysController {
  constructor(private readonly service: CrmSurveysService) {}

  @Get()
  @RequirePermissions("integrations.surveys.read")
  list(@CurrentUser() actor: AuthUser, @Query() query: ListSurveyDefinitionsQueryDto) {
    return this.service.list(actor, query);
  }

  @Post()
  @RequirePermissions("integrations.surveys.manage")
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateSurveyDefinitionDto) {
    return this.service.create(actor, dto);
  }

  @Get("results")
  @RequirePermissions("integrations.surveys.read")
  results(@CurrentUser() actor: AuthUser, @Query() query: SurveyResultsQueryDto) {
    return this.service.results(actor, query);
  }

  @Post("results/export")
  @RequirePermissions("integrations.surveys.read")
  exportResults(@CurrentUser() actor: AuthUser, @Body() query: SurveyResultsQueryDto) {
    return this.service.exportResults(actor, query);
  }

  @Get(":id")
  @RequirePermissions("integrations.surveys.read")
  get(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.get(actor, id);
  }

  @Patch(":id")
  @RequirePermissions("integrations.surveys.manage")
  update(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateSurveyDefinitionDto) {
    return this.service.update(actor, id, dto);
  }

  @Post(":id/draft")
  @RequirePermissions("integrations.surveys.manage")
  prepareDraft(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.prepareDraft(actor, id);
  }

  @Post(":id/duplicate")
  @RequirePermissions("integrations.surveys.manage")
  duplicate(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.duplicate(actor, id);
  }

  @Post(":id/activate")
  @RequirePermissions("integrations.surveys.manage")
  activate(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.activate(actor, id);
  }

  @Post(":id/deactivate")
  @RequirePermissions("integrations.surveys.manage")
  deactivate(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.deactivate(actor, id);
  }

  @Post(":id/archive")
  @RequirePermissions("integrations.surveys.manage")
  archive(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.archive(actor, id);
  }

  @Post(":id/sections")
  @RequirePermissions("integrations.surveys.manage")
  addSection(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CreateSurveySectionDto) {
    return this.service.addSection(actor, id, dto);
  }

  @Post(":id/sections/reorder")
  @RequirePermissions("integrations.surveys.manage")
  reorderSections(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: ReorderSurveyItemsDto) {
    return this.service.reorderSections(actor, id, dto);
  }
}

@ApiTags("CRM Survey Sections")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("crm/survey-sections")
export class CrmSurveySectionsController {
  constructor(private readonly service: CrmSurveysService) {}

  @Patch(":id")
  @RequirePermissions("integrations.surveys.manage")
  update(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateSurveySectionDto) {
    return this.service.updateSection(actor, id, dto);
  }

  @Delete(":id")
  @RequirePermissions("integrations.surveys.manage")
  remove(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.deleteSection(actor, id);
  }

  @Post(":id/questions")
  @RequirePermissions("integrations.surveys.manage")
  addQuestion(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CreateSurveyQuestionDto) {
    return this.service.addQuestion(actor, id, dto);
  }

  @Post(":id/questions/reorder")
  @RequirePermissions("integrations.surveys.manage")
  reorderQuestions(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: ReorderSurveyItemsDto) {
    return this.service.reorderQuestions(actor, id, dto);
  }
}

@ApiTags("CRM Survey Questions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("crm/survey-questions")
export class CrmSurveyQuestionsController {
  constructor(private readonly service: CrmSurveysService) {}

  @Patch(":id")
  @RequirePermissions("integrations.surveys.manage")
  update(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateSurveyQuestionDto) {
    return this.service.updateQuestion(actor, id, dto);
  }

  @Delete(":id")
  @RequirePermissions("integrations.surveys.manage")
  remove(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.deleteQuestion(actor, id);
  }
}

@ApiTags("CRM Survey Send Configuration")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("crm/survey-send-config")
export class CrmSurveySendConfigurationController {
  constructor(private readonly service: CrmSurveysService) {}

  @Get()
  @RequirePermissions("integrations.surveys.read")
  list(@CurrentUser() actor: AuthUser) {
    return this.service.listSendConfigurations(actor);
  }

  @Put()
  @RequirePermissions("integrations.surveys.manage")
  update(@CurrentUser() actor: AuthUser, @Body() dto: UpdateSurveySendConfigurationDto) {
    return this.service.updateSendConfiguration(actor, dto);
  }
}

@ApiTags("Public Satisfaction Surveys")
@Controller("public/surveys")
export class PublicCrmSurveysController {
  constructor(private readonly service: CrmSurveysService) {}

  @Get("respond/:token")
  get(@Param("token") token: string) {
    return this.service.publicSurvey(token);
  }

  @Post("respond/:token/start")
  start(@Param("token") token: string) {
    return this.service.startPublicSurvey(token);
  }

  @Post("respond/:token/submit")
  submit(@Param("token") token: string, @Body() dto: SubmitPublicSurveyDto) {
    return this.service.submitPublicSurvey(token, dto);
  }

  @Post("delivery-events")
  delivery(@Headers("x-survey-webhook-secret") secret: string | undefined, @Body() dto: RecordSurveyDeliveryDto) {
    return this.service.recordDelivery(secret, dto);
  }
}
