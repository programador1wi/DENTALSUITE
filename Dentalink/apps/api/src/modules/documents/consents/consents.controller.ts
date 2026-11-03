import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { AuthUser } from "../../../common/types/auth-user";
import {
  ConsentTemplatesQueryDto,
  CreateConsentTemplateDto,
  SignConsentDto,
  UpdateConsentTemplateDto
} from "../dto/documents.dto";
import {
  AddConsentSignatureDto,
  ConsentTemplateDraftDto,
  ConsentTemplateListQueryDto,
  FinalizeConsentDto,
  GeneratePatientConsentDto,
  PatientConsentListQueryDto,
  PreviewConsentTemplateDto,
  UpdateConsentFieldsDto,
  UpdateConsentTemplateDraftDto,
  VersionedActionDto,
  VoidConsentDto
} from "./consent.dto";
import { ConsentsService } from "./consents.service";

@ApiTags("Consent templates")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("consent-templates")
export class ConsentTemplatesController {
  constructor(private readonly service: ConsentsService) {}

  @Get("variables")
  @RequirePermissions("consents.templates.read")
  variables() {
    return this.service.variableCatalog();
  }

  @Get()
  @RequirePermissions("consents.templates.read")
  list(@CurrentUser() actor: AuthUser, @Query() query: ConsentTemplateListQueryDto) {
    return this.service.listTemplates(actor, query);
  }

  @Post()
  @RequirePermissions("consents.templates.create")
  create(
    @CurrentUser() actor: AuthUser,
    @Body() dto: ConsentTemplateDraftDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.createTemplate(actor, dto, { correlationId, userAgent, ipAddress });
  }

  @Post("preview")
  @RequirePermissions("consents.templates.read")
  preview(@Body() dto: PreviewConsentTemplateDto) {
    return this.service.previewTemplate(dto);
  }

  @Get(":id")
  @RequirePermissions("consents.templates.read")
  get(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getTemplate(actor, id);
  }

  @Patch(":id")
  @RequirePermissions("consents.templates.update_draft")
  update(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateConsentTemplateDraftDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.updateTemplateDraft(actor, id, dto, { correlationId, userAgent, ipAddress });
  }

  @Post(":id/duplicate")
  @RequirePermissions("consents.templates.create")
  duplicate(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.duplicateTemplate(actor, id, { correlationId, userAgent, ipAddress });
  }

  @Post(":id/publish")
  @RequirePermissions("consents.templates.publish")
  publish(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: VersionedActionDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.publishTemplate(actor, id, dto, { correlationId, userAgent, ipAddress });
  }

  @Post(":id/deactivate")
  @RequirePermissions("consents.templates.deactivate")
  deactivate(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: VersionedActionDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.deactivateTemplate(actor, id, dto, { correlationId, userAgent, ipAddress });
  }

  @Post(":id/new-version")
  @RequirePermissions("consents.templates.update_draft")
  newVersion(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: VersionedActionDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.createNewVersion(actor, id, dto, { correlationId, userAgent, ipAddress });
  }

  @Get(":id/versions")
  @RequirePermissions("consents.templates.view_versions")
  versions(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.listTemplateVersions(actor, id);
  }

  @Get(":id/audit")
  @RequirePermissions("consents.templates.view_audit")
  audit(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.listTemplateAudit(actor, id);
  }
}

/**
 * Compatibility surface for clients released before consent versioning.
 * All writes are translated into the new draft workflow, so this alias cannot
 * bypass publication immutability or tenant authorization.
 */
@ApiTags("Consent templates (legacy compatibility)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("settings/consent-templates")
export class LegacyConsentTemplatesController {
  constructor(private readonly service: ConsentsService) {}

  @Get()
  @RequirePermissions("consent_templates.read")
  async list(@CurrentUser() actor: AuthUser, @Query() query: ConsentTemplatesQueryDto) {
    const result = await this.service.listTemplates(actor, {
      search: query.search,
      status: query.active === "true" ? "PUBLISHED" : query.active === "false" ? "INACTIVE" : undefined,
      page: query.page,
      pageSize: query.pageSize
    });
    return result.items.map((template) => ({
      ...template,
      content: template.content,
      procedureId: template.procedureId
    }));
  }

  @Post()
  @RequirePermissions("consent_templates.create")
  create(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateConsentTemplateDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.createTemplate(
      actor,
      {
        name: dto.name,
        scopeType: dto.procedureId ? "TREATMENTS" : "ORGANIZATION",
        treatmentTypeIds: dto.procedureId ? [dto.procedureId] : [],
        editorSchemaJson: this.plainDocument(dto.content),
        requiredSigners: this.legacySigners()
      },
      { correlationId, userAgent, ipAddress }
    );
  }

  @Patch(":id")
  @RequirePermissions("consent_templates.update")
  async update(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateConsentTemplateDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    const current = await this.service.getTemplate(actor, id);
    if (!current.draftVersion) {
      throw new ConflictException("La versión publicada es inmutable. Crea una nueva versión antes de editar.");
    }
    return this.service.updateTemplateDraft(
      actor,
      id,
      {
        name: dto.name ?? current.name,
        internalDescription: current.internalDescription ?? undefined,
        scopeType: current.scopeType,
        branchIds: current.branchIds,
        specialtyId: current.specialtyId ?? undefined,
        treatmentTypeIds: current.treatmentTypeIds,
        editorSchemaJson: dto.content ? this.plainDocument(dto.content) : current.draftVersion.editorSchemaJson as Record<string, unknown>,
        requiredSigners: current.draftVersion.requiredSigners,
        expectedVersion: current.version
      },
      { correlationId, userAgent, ipAddress }
    );
  }

  @Patch(":id/deactivate")
  @RequirePermissions("consent_templates.deactivate")
  async deactivate(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    const current = await this.service.getTemplate(actor, id);
    return this.service.deactivateTemplate(
      actor,
      id,
      { expectedVersion: current.version },
      { correlationId, userAgent, ipAddress }
    );
  }

  private plainDocument(content: string) {
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: content.trim() }]
        }
      ]
    };
  }

  private legacySigners() {
    return {
      patient: { enabled: true, required: true },
      professional: { enabled: false, required: false, mode: "ANY_AUTHORIZED" as const },
      representative: { enabled: false, required: false, replacesPatient: false }
    };
  }
}

@ApiTags("Patient consents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class PatientConsentsController {
  constructor(private readonly service: ConsentsService) {}

  @Get("patients/:patientId/consents")
  @RequirePermissions("consents.instances.read")
  list(
    @CurrentUser() actor: AuthUser,
    @Param("patientId") patientId: string,
    @Query() query: PatientConsentListQueryDto
  ) {
    return this.service.listPatientConsents(actor, patientId, query);
  }

  @Post("patients/:patientId/consents")
  @RequirePermissions("consents.instances.create")
  create(
    @CurrentUser() actor: AuthUser,
    @Param("patientId") patientId: string,
    @Body() dto: GeneratePatientConsentDto,
    @Headers("idempotency-key") idempotencyKey?: string,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.generatePatientConsent(actor, patientId, dto, idempotencyKey, {
      correlationId,
      userAgent,
      ipAddress
    });
  }

  @Get("consents/:id")
  @RequirePermissions("consents.instances.read")
  get(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getConsent(actor, id);
  }

  @Patch("consents/:id/fields")
  @RequirePermissions("consents.instances.complete_fields")
  fields(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateConsentFieldsDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.updateConsentFields(actor, id, dto, { correlationId, userAgent, ipAddress });
  }

  @Post("consents/:id/prepare-signature")
  @RequirePermissions("consents.instances.read")
  prepare(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.prepareSignature(actor, id);
  }

  @Post("consents/:id/signatures")
  @RequirePermissions("consents.instances.sign_patient")
  sign(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: AddConsentSignatureDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.addSignature(actor, id, dto, { correlationId, userAgent, ipAddress });
  }

  @Post("consents/:id/sign")
  @RequirePermissions("consents.sign")
  async legacySign(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: SignConsentDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    const prepared = await this.service.prepareSignature(actor, id);
    const requestedType =
      dto.signerType.trim().toUpperCase() === "PROFESSIONAL"
        ? "PROFESSIONAL"
        : dto.signerType.trim().toUpperCase() === "TUTOR"
          ? "REPRESENTATIVE"
          : "PATIENT";
    const signerType = prepared.enabledSigners.includes(requestedType)
      ? requestedType
      : prepared.enabledSigners[0];
    if (!signerType) throw new ConflictException("La plantilla no permite firmas.");
    return this.service.addSignature(
      actor,
      id,
      {
        signerType: signerType as AddConsentSignatureDto["signerType"],
        signerName: dto.signerName,
        signatureMethod: "DRAWN",
        signatureDataUrl: dto.signatureData,
        documentHash: prepared.documentHash,
        acceptanceText: prepared.acceptanceText,
        acceptanceTextVersion: prepared.acceptanceTextVersion
      },
      { correlationId, userAgent, ipAddress }
    );
  }

  @Post("consents/:id/finalize")
  @RequirePermissions("consents.instances.finalize")
  finalize(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: FinalizeConsentDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.finalizeConsent(actor, id, dto, { correlationId, userAgent, ipAddress });
  }

  @Post("consents/:id/void")
  @RequirePermissions("consents.instances.void")
  void(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: VoidConsentDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.voidConsent(actor, id, dto, { correlationId, userAgent, ipAddress });
  }

  @Get("consents/:id/pdf")
  @RequirePermissions("consents.instances.download")
  async pdf(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    const file = await this.service.getPdf(actor, id, { correlationId, userAgent, ipAddress });
    return new StreamableFile(file.stream, {
      type: file.mimeType,
      length: file.size,
      disposition: `attachment; filename="${file.fileName}"`
    });
  }

  @Get("consents/:id/evidence")
  @RequirePermissions("consents.instances.view_evidence")
  evidence(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getEvidence(actor, id);
  }

  @Get("consents/:id/audit")
  @RequirePermissions("consents.instances.view_evidence")
  audit(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getConsentAudit(actor, id);
  }
}
