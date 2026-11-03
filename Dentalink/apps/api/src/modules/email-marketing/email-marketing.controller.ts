import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { EmailCampaignStatus } from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  CreateDomainVerificationDto,
  CreateEmailCampaignDto,
  CreateEmailTemplateDto,
  CreateSegmentDto,
  EmailWebhookDto,
  ExportMarketingReportDto,
  PreviewMarketingReportDto,
  ScheduleEmailCampaignDto,
  TestEmailCampaignDto,
  UpdateEmailCampaignDto,
  UpdateMarketingSettingsDto
} from "./dto/email-marketing.dto";
import { EmailMarketingService } from "./email-marketing.service";

@ApiTags("CRM Email Marketing")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("crm/email-marketing")
export class EmailMarketingController {
  constructor(private readonly service: EmailMarketingService) {}

  @Get("reports")
  @RequirePermissions("integrations.communications.read")
  reports() { return this.service.catalog(); }

  @Post("reports/:code/preview")
  @RequirePermissions("integrations.communications.read")
  preview(@CurrentUser() actor: AuthUser, @Param("code") code: string, @Body() dto: PreviewMarketingReportDto) { return this.service.preview(actor, code, dto); }

  @Post("reports/:code/export")
  @RequirePermissions("integrations.communications.read", "reports.export")
  export(@CurrentUser() actor: AuthUser, @Param("code") code: string, @Body() dto: ExportMarketingReportDto) { return this.service.exportReport(actor, code, dto); }

  @Post("segments")
  @RequirePermissions("integrations.communications.send")
  segment(@CurrentUser() actor: AuthUser, @Body() dto: CreateSegmentDto) { return this.service.createSegment(actor, dto); }

  @Get("campaigns")
  @RequirePermissions("integrations.communications.read")
  campaigns(@CurrentUser() actor: AuthUser, @Query("status") status?: EmailCampaignStatus) { return this.service.listCampaigns(actor, status); }

  @Post("campaigns")
  @RequirePermissions("integrations.communications.send")
  createCampaign(@CurrentUser() actor: AuthUser, @Body() dto: CreateEmailCampaignDto) { return this.service.createCampaign(actor, dto); }

  @Get("campaigns/:id")
  @RequirePermissions("integrations.communications.read")
  campaign(@CurrentUser() actor: AuthUser, @Param("id") id: string) { return this.service.getCampaign(actor, id); }

  @Patch("campaigns/:id")
  @RequirePermissions("integrations.communications.send")
  updateCampaign(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateEmailCampaignDto) { return this.service.updateCampaign(actor, id, dto); }

  @Post("campaigns/:id/test")
  @RequirePermissions("integrations.communications.send")
  test(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: TestEmailCampaignDto) { return this.service.sendTest(actor, id, dto); }

  @Post("campaigns/:id/schedule")
  @RequirePermissions("integrations.communications.send")
  schedule(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: ScheduleEmailCampaignDto) { return this.service.schedule(actor, id, dto); }

  @Post("campaigns/:id/send")
  @RequirePermissions("integrations.communications.send")
  send(@CurrentUser() actor: AuthUser, @Param("id") id: string) { return this.service.sendNow(actor, id); }

  @Post("campaigns/:id/cancel")
  @RequirePermissions("integrations.communications.send")
  cancel(@CurrentUser() actor: AuthUser, @Param("id") id: string) { return this.service.cancel(actor, id); }

  @Get("campaigns/:id/metrics")
  @RequirePermissions("integrations.communications.read")
  metrics(@CurrentUser() actor: AuthUser, @Param("id") id: string) { return this.service.campaignMetrics(actor, id); }

  @Get("templates")
  @RequirePermissions("integrations.communications.read")
  templates(@CurrentUser() actor: AuthUser, @Query("search") search?: string, @Query("category") category?: string) { return this.service.listTemplates(actor, search, category); }

  @Post("templates")
  @RequirePermissions("integrations.communications.send")
  createTemplate(@CurrentUser() actor: AuthUser, @Body() dto: CreateEmailTemplateDto) { return this.service.createTemplate(actor, dto); }

  @Post("templates/:id/version")
  @RequirePermissions("integrations.communications.send")
  versionTemplate(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CreateEmailTemplateDto) { return this.service.versionTemplate(actor, id, dto); }

  @Post("templates/:id/archive")
  @RequirePermissions("integrations.communications.send")
  archiveTemplate(@CurrentUser() actor: AuthUser, @Param("id") id: string) { return this.service.archiveTemplate(actor, id); }

  @Get("settings")
  @RequirePermissions("integrations.communications.read")
  settings(@CurrentUser() actor: AuthUser) { return this.service.getSettings(actor); }

  @Patch("settings")
  @RequirePermissions("integrations.communications.send")
  updateSettings(@CurrentUser() actor: AuthUser, @Body() dto: UpdateMarketingSettingsDto) { return this.service.updateSettings(actor, dto); }

  @Get("sender")
  @RequirePermissions("integrations.communications.read")
  sender(@CurrentUser() actor: AuthUser) { return this.service.senderConfiguration(actor); }

  @Post("domains")
  @RequirePermissions("integrations.communications.send")
  domain(@CurrentUser() actor: AuthUser, @Body() dto: CreateDomainVerificationDto) { return this.service.createDomain(actor, dto); }

  @Post("domains/:id/verify")
  @RequirePermissions("integrations.communications.send")
  verify(@CurrentUser() actor: AuthUser, @Param("id") id: string) { return this.service.verifyDomain(actor, id); }
}

@ApiTags("Public CRM Email Marketing")
@Public()
@Controller("public/crm/email-marketing")
export class PublicEmailMarketingController {
  constructor(private readonly service: EmailMarketingService) {}

  @Post("webhooks/:provider")
  webhook(@Param("provider") provider: string, @Headers("x-webhook-secret") secret: string | undefined, @Body() dto: EmailWebhookDto) { return this.service.ingestWebhook(provider, secret, dto); }

  @Get("unsubscribe/:token")
  unsubscribe(@Param("token") token: string) { return this.service.unsubscribe(token); }
}
