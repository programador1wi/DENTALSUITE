import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  CompleteAiRequestDto,
  CreateAiRequestDto,
  CreateChatMessageDto,
  CreateCommunicationJobDto,
  CreateDocumentRequirementDto,
  CreateImportJobDto,
  CreateSurveyDto,
  CreateTelemedicineSessionDto,
  IngestPaymentWebhookDto,
  ListAiRequestsQueryDto,
  ListChatMessagesQueryDto,
  ListCommunicationJobsQueryDto,
  ListDocumentRequirementsQueryDto,
  ListImportJobsQueryDto,
  ListPaymentWebhookEventsQueryDto,
  ListSurveysQueryDto,
  ListTelemedicineSessionsQueryDto,
  RecordMessageDeliveryDto,
  SatisfyDocumentRequirementDto,
  SubmitSurveyResponseDto,
  UpdateImportJobDto,
  UpdateTelemedicineStatusDto,
  WaiveDocumentRequirementDto
} from "./dto/integrations.dto";
import { IntegrationsService } from "./integrations.service";

@ApiTags("Integrations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get("communication-jobs")
  @RequirePermissions("integrations.communications.read")
  listCommunicationJobs(@CurrentUser() actor: AuthUser, @Query() query: ListCommunicationJobsQueryDto) {
    return this.service.listCommunicationJobs(actor, query);
  }

  @Post("communication-jobs")
  @RequirePermissions("integrations.communications.send")
  createCommunicationJob(@CurrentUser() actor: AuthUser, @Body() dto: CreateCommunicationJobDto) {
    return this.service.createCommunicationJob(actor, dto);
  }

  @Post("communication-jobs/:id/queue")
  @RequirePermissions("integrations.communications.send")
  queueCommunicationJob(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.queueCommunicationJob(actor, id);
  }

  @Post("communication-jobs/:id/deliveries")
  @RequirePermissions("integrations.communications.send")
  recordMessageDelivery(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: RecordMessageDeliveryDto) {
    return this.service.recordMessageDelivery(actor, id, dto);
  }

  @Get("surveys")
  @RequirePermissions("integrations.surveys.read")
  listSurveys(@CurrentUser() actor: AuthUser, @Query() query: ListSurveysQueryDto) {
    return this.service.listSurveys(actor, query);
  }

  @Post("surveys")
  @RequirePermissions("integrations.surveys.manage")
  createSurvey(@CurrentUser() actor: AuthUser, @Body() dto: CreateSurveyDto) {
    return this.service.createSurvey(actor, dto);
  }

  @Post("surveys/:id/send")
  @RequirePermissions("integrations.surveys.manage")
  sendSurvey(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.sendSurvey(actor, id);
  }

  @Get("chat/messages")
  @RequirePermissions("integrations.chat.read")
  listChatMessages(@CurrentUser() actor: AuthUser, @Query() query: ListChatMessagesQueryDto) {
    return this.service.listChatMessages(actor, query);
  }

  @Post("chat/messages")
  @RequirePermissions("integrations.chat.send")
  createChatMessage(@CurrentUser() actor: AuthUser, @Body() dto: CreateChatMessageDto) {
    return this.service.createChatMessage(actor, dto);
  }

  @Post("telemedicine/sessions")
  @RequirePermissions("integrations.telemedicine.manage")
  createTelemedicineSession(@CurrentUser() actor: AuthUser, @Body() dto: CreateTelemedicineSessionDto) {
    return this.service.createTelemedicineSession(actor, dto);
  }

  @Get("telemedicine/sessions")
  @RequirePermissions("integrations.telemedicine.read")
  listTelemedicineSessions(@CurrentUser() actor: AuthUser, @Query() query: ListTelemedicineSessionsQueryDto) {
    return this.service.listTelemedicineSessions(actor, query);
  }

  @Patch("telemedicine/sessions/:id/status")
  @RequirePermissions("integrations.telemedicine.manage")
  updateTelemedicineStatus(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateTelemedicineStatusDto
  ) {
    return this.service.updateTelemedicineStatus(actor, id, dto);
  }

  @Get("import-jobs")
  @RequirePermissions("integrations.imports.read")
  listImportJobs(@CurrentUser() actor: AuthUser, @Query() query: ListImportJobsQueryDto) {
    return this.service.listImportJobs(actor, query);
  }

  @Post("import-jobs")
  @RequirePermissions("integrations.imports.manage")
  createImportJob(@CurrentUser() actor: AuthUser, @Body() dto: CreateImportJobDto) {
    return this.service.createImportJob(actor, dto);
  }

  @Patch("import-jobs/:id")
  @RequirePermissions("integrations.imports.manage")
  updateImportJob(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateImportJobDto) {
    return this.service.updateImportJob(actor, id, dto);
  }

  @Get("document-requirements")
  @RequirePermissions("document_requirements.read")
  listDocumentRequirements(@CurrentUser() actor: AuthUser, @Query() query: ListDocumentRequirementsQueryDto) {
    return this.service.listDocumentRequirements(actor, query);
  }

  @Post("document-requirements")
  @RequirePermissions("document_requirements.manage")
  createDocumentRequirement(@CurrentUser() actor: AuthUser, @Body() dto: CreateDocumentRequirementDto) {
    return this.service.createDocumentRequirement(actor, dto);
  }

  @Patch("document-requirements/:id/satisfy")
  @RequirePermissions("document_requirements.satisfy")
  satisfyDocumentRequirement(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: SatisfyDocumentRequirementDto
  ) {
    return this.service.satisfyDocumentRequirement(actor, id, dto);
  }

  @Patch("document-requirements/:id/waive")
  @RequirePermissions("document_requirements.waive")
  waiveDocumentRequirement(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: WaiveDocumentRequirementDto) {
    return this.service.waiveDocumentRequirement(actor, id, dto);
  }

  @Get("payment-webhook-events")
  @RequirePermissions("payment_webhooks.read")
  listPaymentWebhookEvents(@CurrentUser() actor: AuthUser, @Query() query: ListPaymentWebhookEventsQueryDto) {
    return this.service.listPaymentWebhookEvents(actor, query);
  }

  @Get("ai/requests")
  @RequirePermissions("integrations.ai.read")
  listAiRequests(@CurrentUser() actor: AuthUser, @Query() query: ListAiRequestsQueryDto) {
    return this.service.listAiRequests(actor, query);
  }

  @Post("ai/requests")
  @RequirePermissions("integrations.ai.request")
  createAiRequest(@CurrentUser() actor: AuthUser, @Body() dto: CreateAiRequestDto) {
    return this.service.createAiRequest(actor, dto);
  }

  @Post("ai/requests/:id/complete")
  @RequirePermissions("integrations.ai.complete")
  completeAiRequest(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CompleteAiRequestDto) {
    return this.service.completeAiRequest(actor, id, dto);
  }
}

@ApiTags("Public integrations")
@Public()
@Controller("public/integrations")
export class PublicIntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Post("payment-webhooks/:provider")
  ingestPaymentWebhook(
    @Param("provider") provider: string,
    @Body() dto: IngestPaymentWebhookDto,
    @Headers("x-webhook-secret") secret?: string
  ) {
    return this.service.ingestPaymentWebhook(provider, dto, secret);
  }

  @Post("surveys/:token/response")
  submitSurveyResponse(@Param("token") token: string, @Body() dto: SubmitSurveyResponseDto) {
    return this.service.submitSurveyResponse(token, dto);
  }
}
