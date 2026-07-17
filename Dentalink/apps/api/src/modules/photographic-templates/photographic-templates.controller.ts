import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  CreatePhotographicLinkDto,
  CreatePhotographicSessionDto,
  DismissPhotographicReminderDto,
  RemovePhotographicLinkDto,
  UpdatePhotographicPolicyDto,
  UpdatePhotographicSessionDto,
  UpdatePhotographicSlotDto,
  UpdatePhotographicTransformationsDto,
  UploadPhotographicImageDto,
  VersionedActionDto,
  VoidPhotographicRecordDto
} from "./dto/photographic-templates.dto";
import { PhotographicTemplatesService } from "./photographic-templates.service";

type UploadedImage = { originalname: string; mimetype?: string; size: number; buffer?: Buffer };
const IMAGE_INTERCEPTOR = FileInterceptor("file", { limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

@ApiTags("Photographic templates")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class PhotographicTemplatesController {
  constructor(private readonly service: PhotographicTemplatesService) {}

  @Get("treatment-plans/:treatmentPlanId/photographic-sessions")
  @RequirePermissions("photographic_templates.view")
  list(
    @CurrentUser() actor: AuthUser,
    @Param("treatmentPlanId") treatmentPlanId: string,
    @Query("includeVoided") includeVoided?: string
  ) {
    return this.service.list(actor, treatmentPlanId, includeVoided === "true");
  }

  @Get("treatment-plans/:treatmentPlanId/photographic-links/available")
  @RequirePermissions("photographic_templates.view")
  availableLinks(@CurrentUser() actor: AuthUser, @Param("treatmentPlanId") treatmentPlanId: string) {
    return this.service.availableLinks(actor, treatmentPlanId);
  }

  @Post("treatment-plans/:treatmentPlanId/photographic-sessions")
  @RequirePermissions("photographic_templates.create")
  create(
    @CurrentUser() actor: AuthUser,
    @Param("treatmentPlanId") treatmentPlanId: string,
    @Body() dto: CreatePhotographicSessionDto,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.service.create(actor, treatmentPlanId, dto, idempotencyKey);
  }

  @Post("treatment-plans/:treatmentPlanId/photographic-sessions/initial/images")
  @RequirePermissions("photographic_photos.upload")
  @UseInterceptors(IMAGE_INTERCEPTOR)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "slotId"],
      properties: { file: { type: "string", format: "binary" }, slotId: { type: "string" } }
    }
  })
  uploadInitialImage(
    @CurrentUser() actor: AuthUser,
    @Param("treatmentPlanId") treatmentPlanId: string,
    @Body() dto: UploadPhotographicImageDto,
    @UploadedFile() file?: UploadedImage
  ) {
    return this.service.uploadInitialImage(actor, treatmentPlanId, dto, file);
  }

  @Get("photographic-sessions/:sessionId")
  @RequirePermissions("photographic_templates.view")
  get(@CurrentUser() actor: AuthUser, @Param("sessionId") sessionId: string) {
    return this.service.get(actor, sessionId);
  }

  @Get("photographic-files/:fileId/content")
  @RequirePermissions("photographic_templates.view")
  async getFileContent(@CurrentUser() actor: AuthUser, @Param("fileId") fileId: string) {
    const file = await this.service.getFileContent(actor, fileId);
    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: `inline; filename="${file.downloadName.replace(/[\r\n"\\/]/g, "_")}"`
    });
  }

  @Get("photographic-sessions/:sessionId/comparison")
  @RequirePermissions("photographic_templates.compare")
  compare(
    @CurrentUser() actor: AuthUser,
    @Param("sessionId") sessionId: string,
    @Query("otherSessionId") otherSessionId: string
  ) {
    return this.service.compare(actor, sessionId, otherSessionId);
  }

  @Put("photographic-slots/:slotId")
  @RequirePermissions("photographic_templates.configure_slots")
  updateSlot(
    @CurrentUser() actor: AuthUser,
    @Param("slotId") slotId: string,
    @Body() dto: UpdatePhotographicSlotDto
  ) {
    return this.service.updateSlot(actor, slotId, dto);
  }

  @Put("photographic-sessions/:sessionId")
  @RequirePermissions("photographic_templates.edit")
  update(
    @CurrentUser() actor: AuthUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: UpdatePhotographicSessionDto
  ) {
    return this.service.update(actor, sessionId, dto);
  }

  @Post("photographic-sessions/:sessionId/complete")
  @RequirePermissions("photographic_templates.edit")
  complete(
    @CurrentUser() actor: AuthUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: VersionedActionDto
  ) {
    return this.service.complete(actor, sessionId, dto.version);
  }

  @Post("photographic-sessions/:sessionId/void")
  @RequirePermissions("photographic_templates.void")
  voidSession(
    @CurrentUser() actor: AuthUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: VoidPhotographicRecordDto
  ) {
    return this.service.voidSession(actor, sessionId, dto);
  }

  @Post("photographic-sessions/:sessionId/images")
  @RequirePermissions("photographic_photos.upload")
  @UseInterceptors(IMAGE_INTERCEPTOR)
  @ApiConsumes("multipart/form-data")
  uploadImage(
    @CurrentUser() actor: AuthUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: UploadPhotographicImageDto,
    @UploadedFile() file?: UploadedImage
  ) {
    return this.service.uploadImage(actor, sessionId, dto, file);
  }

  @Put("photographic-session-images/:imageId/transformations")
  @RequirePermissions("photographic_photos.edit")
  updateTransformations(
    @CurrentUser() actor: AuthUser,
    @Param("imageId") imageId: string,
    @Body() dto: UpdatePhotographicTransformationsDto
  ) {
    return this.service.updateTransformations(actor, imageId, dto);
  }

  @Post("photographic-session-images/:imageId/void")
  @RequirePermissions("photographic_photos.void")
  voidImage(
    @CurrentUser() actor: AuthUser,
    @Param("imageId") imageId: string,
    @Body() dto: VoidPhotographicRecordDto
  ) {
    return this.service.voidImage(actor, imageId, dto);
  }

  @Post("photographic-sessions/:sessionId/links")
  @RequirePermissions("photographic_templates.link")
  createLink(
    @CurrentUser() actor: AuthUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: CreatePhotographicLinkDto
  ) {
    return this.service.createLink(actor, sessionId, dto);
  }

  @Delete("photographic-session-links/:linkId")
  @RequirePermissions("photographic_templates.link")
  removeLink(
    @CurrentUser() actor: AuthUser,
    @Param("linkId") linkId: string,
    @Body() dto: RemovePhotographicLinkDto
  ) {
    return this.service.removeLink(actor, linkId, dto.reason);
  }

  @Put("treatment-plans/:treatmentPlanId/photographic-policy")
  @RequirePermissions("photographic_templates.configure_frequency")
  updatePolicy(
    @CurrentUser() actor: AuthUser,
    @Param("treatmentPlanId") treatmentPlanId: string,
    @Body() dto: UpdatePhotographicPolicyDto
  ) {
    return this.service.updatePolicy(actor, treatmentPlanId, dto);
  }

  @Post("treatment-plans/:treatmentPlanId/photographic-policy/dismiss-reminder")
  @RequirePermissions("photographic_templates.edit")
  dismissReminder(
    @CurrentUser() actor: AuthUser,
    @Param("treatmentPlanId") treatmentPlanId: string,
    @Body() dto: DismissPhotographicReminderDto
  ) {
    return this.service.dismissReminder(actor, treatmentPlanId, dto);
  }

  @Post("photographic-sessions/:sessionId/mobile-upload-session")
  @RequirePermissions("photographic_templates.mobile_upload")
  createMobileUpload(@CurrentUser() actor: AuthUser, @Param("sessionId") sessionId: string) {
    return this.service.createMobileUpload(actor, sessionId);
  }
}

@ApiTags("Mobile photographic uploads")
@Controller("mobile-photographic-uploads")
export class MobilePhotographicUploadsController {
  constructor(private readonly service: PhotographicTemplatesService) {}

  @Get(":token")
  claim(@Param("token") token: string) {
    return this.service.claimMobileUpload(token);
  }

  @Post(":token/images")
  @UseInterceptors(IMAGE_INTERCEPTOR)
  @ApiConsumes("multipart/form-data")
  upload(
    @Param("token") token: string,
    @Body() dto: UploadPhotographicImageDto,
    @UploadedFile() file?: UploadedImage
  ) {
    return this.service.uploadMobileImage(token, dto, file);
  }

  @Post(":token/complete")
  complete(@Param("token") token: string) {
    return this.service.completeMobileUpload(token);
  }
}
