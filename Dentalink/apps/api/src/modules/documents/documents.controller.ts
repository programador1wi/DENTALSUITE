import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  UseGuards
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
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
  UpsertRadiographyAnalysisDto,
  UploadBinaryFileAttachmentDto,
  UpdateClinicalDocumentTemplateSettingsDto,
  UpdateConsentTemplateDto,
  UploadFileAttachmentDto
} from "./dto/documents.dto";
import { DocumentsService } from "./documents.service";

type UploadedPatientFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
};

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

  @Post("patients/:patientId/files/upload")
  @RequirePermissions("files.upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        category: { type: "string", example: "XRAY" }
      },
      required: ["file"]
    }
  })
  uploadPatientBinaryFile(
    @CurrentUser() actor: AuthUser,
    @Param("patientId") patientId: string,
    @Body() dto: UploadBinaryFileAttachmentDto,
    @UploadedFile() file?: UploadedPatientFile
  ) {
    return this.service.uploadPatientBinaryFile(actor, patientId, dto, file);
  }

  @Get("patients/:patientId/files/:fileId/content")
  @RequirePermissions("files.read")
  async getPatientFileContent(
    @CurrentUser() actor: AuthUser,
    @Param("patientId") patientId: string,
    @Param("fileId") fileId: string
  ) {
    const file = await this.service.getPatientFileContent(actor, patientId, fileId);
    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: `inline; filename="${file.downloadName}"`
    });
  }

  @Get("patients/:patientId/files/:fileId/radiography-analysis")
  @RequirePermissions("files.read")
  getPatientRadiographyAnalysis(
    @CurrentUser() actor: AuthUser,
    @Param("patientId") patientId: string,
    @Param("fileId") fileId: string
  ) {
    return this.service.getPatientRadiographyAnalysis(actor, patientId, fileId);
  }

  @Put("patients/:patientId/files/:fileId/radiography-analysis")
  @RequirePermissions("files.upload")
  upsertPatientRadiographyAnalysis(
    @CurrentUser() actor: AuthUser,
    @Param("patientId") patientId: string,
    @Param("fileId") fileId: string,
    @Body() dto: UpsertRadiographyAnalysisDto
  ) {
    return this.service.upsertPatientRadiographyAnalysis(actor, patientId, fileId, dto);
  }

  @Get("users/:userId/files")
  @RequirePermissions("users.read")
  listUserFiles(@CurrentUser() actor: AuthUser, @Param("userId") userId: string, @Query() query: PatientFilesQueryDto) {
    return this.service.listUserFiles(actor, userId, query);
  }

  @Post("users/:userId/files/upload")
  @RequirePermissions("users.update")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        category: { type: "string", example: "TITLE" },
        professionalId: { type: "string" }
      },
      required: ["file"]
    }
  })
  uploadUserBinaryFile(
    @CurrentUser() actor: AuthUser,
    @Param("userId") userId: string,
    @Body() dto: UploadBinaryFileAttachmentDto,
    @UploadedFile() file?: UploadedPatientFile
  ) {
    return this.service.uploadUserBinaryFile(actor, userId, dto, file);
  }

  @Get("users/:userId/files/:fileId/content")
  @RequirePermissions("users.read")
  async getUserFileContent(
    @CurrentUser() actor: AuthUser,
    @Param("userId") userId: string,
    @Param("fileId") fileId: string
  ) {
    const file = await this.service.getUserFileContent(actor, userId, fileId);
    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: `inline; filename="${file.downloadName}"`
    });
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
