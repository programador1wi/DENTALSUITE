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
  ClinicalDocumentTemplatesQueryDto,
  ConsentTemplatesQueryDto,
  CreateClinicalDocumentTemplateSettingsDto,
  CreateConsentDto,
  CreateConsentTemplateDto,
  PatientConsentsQueryDto,
  PatientFilesQueryDto,
  SignConsentDto,
  UpdateClinicalDocumentTemplateSettingsDto,
  UpdateConsentTemplateDto,
  UploadFileAttachmentDto
} from "./dto/documents.dto";
import { DocumentsService } from "./documents.service";

@ApiTags("Documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get("patients/:patientId/files")
  @RequirePermissions("files.read")
  listPatientFiles(@CurrentUser() actor: AuthUser, @Param("patientId") patientId: string, @Query() query: PatientFilesQueryDto) {
    return this.service.listPatientFiles(actor, patientId, query);
  }

  @Post("patients/:patientId/files")
  @RequirePermissions("files.upload")
  uploadPatientFile(@CurrentUser() actor: AuthUser, @Param("patientId") patientId: string, @Body() dto: UploadFileAttachmentDto) {
    return this.service.uploadPatientFile(actor, patientId, dto);
  }

  @Get("settings/consent-templates")
  @RequirePermissions("consent_templates.read")
  listTemplates(@CurrentUser() actor: AuthUser, @Query() query: ConsentTemplatesQueryDto) {
    return this.service.listConsentTemplates(actor, query);
  }

  @Post("settings/consent-templates")
  @RequirePermissions("consent_templates.create")
  createTemplate(@CurrentUser() actor: AuthUser, @Body() dto: CreateConsentTemplateDto) {
    return this.service.createConsentTemplate(actor, dto);
  }

  @Patch("settings/consent-templates/:id")
  @RequirePermissions("consent_templates.update")
  updateTemplate(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateConsentTemplateDto) {
    return this.service.updateConsentTemplate(actor, id, dto);
  }

  @Patch("settings/consent-templates/:id/deactivate")
  @RequirePermissions("consent_templates.deactivate")
  deactivateTemplate(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.deactivateConsentTemplate(actor, id);
  }

  @Get("settings/clinical-document-templates")
  @RequirePermissions("clinical.read")
  listClinicalDocumentTemplates(@CurrentUser() actor: AuthUser, @Query() query: ClinicalDocumentTemplatesQueryDto) {
    return this.service.listClinicalDocumentTemplates(actor, query);
  }

  @Post("settings/clinical-document-templates")
  @RequirePermissions("clinical.templates.manage")
  createClinicalDocumentTemplate(@CurrentUser() actor: AuthUser, @Body() dto: CreateClinicalDocumentTemplateSettingsDto) {
    return this.service.createClinicalDocumentTemplate(actor, dto);
  }

  @Patch("settings/clinical-document-templates/:id")
  @RequirePermissions("clinical.templates.manage")
  updateClinicalDocumentTemplate(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateClinicalDocumentTemplateSettingsDto
  ) {
    return this.service.updateClinicalDocumentTemplate(actor, id, dto);
  }

  @Patch("settings/clinical-document-templates/:id/deactivate")
  @RequirePermissions("clinical.templates.manage")
  deactivateClinicalDocumentTemplate(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.deactivateClinicalDocumentTemplate(actor, id);
  }

  @Get("patients/:patientId/consents")
  @RequirePermissions("consents.read")
  listPatientConsents(@CurrentUser() actor: AuthUser, @Param("patientId") patientId: string, @Query() query: PatientConsentsQueryDto) {
    return this.service.listPatientConsents(actor, patientId, query);
  }

  @Post("patients/:patientId/consents")
  @RequirePermissions("consents.create")
  createPatientConsent(@CurrentUser() actor: AuthUser, @Param("patientId") patientId: string, @Body() dto: CreateConsentDto) {
    return this.service.createPatientConsent(actor, patientId, dto);
  }

  @Post("consents/:id/sign")
  @RequirePermissions("consents.sign")
  signConsent(@CurrentUser() actor: AuthUser, @Param("id") consentId: string, @Body() dto: SignConsentDto) {
    return this.service.signConsent(actor, consentId, dto);
  }

  @Get("consents/:id/pdf")
  @RequirePermissions("consents.pdf")
  getConsentPdf(@CurrentUser() actor: AuthUser, @Param("id") consentId: string) {
    return this.service.getConsentPdf(actor, consentId);
  }
}
