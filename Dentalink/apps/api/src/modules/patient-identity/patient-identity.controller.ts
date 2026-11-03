import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { BookingBotApiKeyGuard } from "./booking-bot-api-key.guard";
import {
  AddFamilyContactDto,
  AddFamilyMemberDto,
  AddBookingFamilyMemberDto,
  BookResolvedAppointmentDto,
  CreateBookingFamilyDto,
  CreateFamilyMemberPatientDto,
  CreateBookingIdentitySessionDto,
  CreateFamilyGrantDto,
  CreateFamilyGroupDto,
  DuplicateCheckDto,
  EndContactLinkDto,
  ExecuteMergeDto,
  LinkPatientPhoneDto,
  LookupBookingFamilyMemberDto,
  MergePreviewDto,
  NormalizePhoneDto,
  ReviewDuplicateCandidateDto,
  SelectBookingPatientDto,
  TransferContactLinkDto,
  UpdateFamilyMemberDto,
  UpdateIdentityConfigDto,
  VerifyBookingIdentityDto,
  VerifyBookingContactDto,
  VerifyContactPointDto
} from "./dto/patient-identity.dto";
import { PatientIdentityService } from "./patient-identity.service";

@Controller("patient-identity")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PatientIdentityController {
  constructor(private readonly service: PatientIdentityService) {}

  @Get("config")
  @RequirePermissions("patient_identity.config.read")
  getConfig(@CurrentUser() actor: AuthUser) {
    return this.service.getConfig(actor.organizationId);
  }

  @Patch("config")
  @RequirePermissions("patient_identity.config.manage")
  updateConfig(@CurrentUser() actor: AuthUser, @Body() dto: UpdateIdentityConfigDto) {
    return this.service.updateConfig(actor, dto);
  }

  @Post("contact-points/normalize")
  @RequirePermissions("contact_points.read")
  normalize(@CurrentUser() actor: AuthUser, @Body() dto: NormalizePhoneDto) {
    return this.service.normalizePhone(actor.organizationId, dto.phone, dto.country);
  }

  @Post("contact-points/link")
  @RequirePermissions("contact_points.link")
  link(@CurrentUser() actor: AuthUser, @Body() dto: LinkPatientPhoneDto) {
    return this.service.linkPatientPhone(actor, dto);
  }

  @Post("contact-points/:id/verification-events")
  @RequirePermissions("contact_points.verify")
  verifyContact(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: VerifyContactPointDto) {
    return this.service.verifyContactPoint(actor, id, dto);
  }

  @Post("contact-links/:id/end")
  @RequirePermissions("contact_points.transfer")
  endContactLink(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: EndContactLinkDto) {
    return this.service.endContactLink(actor, id, dto);
  }

  @Post("contact-links/:id/transfer")
  @RequirePermissions("contact_points.transfer")
  transferContactLink(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: TransferContactLinkDto
  ) {
    return this.service.transferContactLink(actor, id, dto);
  }

  @Post("contact-points/backfill")
  @RequirePermissions("contact_points.backfill")
  backfill(@CurrentUser() actor: AuthUser, @Body("patientId") patientId?: string) {
    return this.service.backfillPatientContacts(actor, patientId);
  }

  @Get("patients/:patientId")
  @RequirePermissions("contact_points.read")
  getPatientIdentity(@CurrentUser() actor: AuthUser, @Param("patientId") patientId: string) {
    return this.service.getPatientIdentity(actor, patientId);
  }

  @Post("duplicate-check")
  @RequirePermissions("patient_duplicates.review")
  duplicateCheck(@CurrentUser() actor: AuthUser, @Body() dto: DuplicateCheckDto) {
    return this.service.duplicateCheck(actor.organizationId, dto, actor.branchIds);
  }

  @Get("duplicate-candidates")
  @RequirePermissions("patient_duplicates.review")
  duplicates(@CurrentUser() actor: AuthUser, @Query("status") status?: string) {
    return this.service.listDuplicateCandidates(actor, status);
  }

  @Patch("duplicate-candidates/:id")
  @RequirePermissions("patient_duplicates.review")
  reviewDuplicate(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: ReviewDuplicateCandidateDto
  ) {
    return this.service.reviewDuplicateCandidate(actor, id, dto);
  }

  @Get("data-quality")
  @RequirePermissions("patient_duplicates.review")
  dataQuality(@CurrentUser() actor: AuthUser) {
    return this.service.getDataQuality(actor);
  }

  @Get("booking-incidents")
  @RequirePermissions("booking_identity.review")
  bookingIncidents(@CurrentUser() actor: AuthUser, @Query("status") status?: string) {
    return this.service.listBookingIdentityIncidents(actor, status);
  }

  @Post("family-groups")
  @RequirePermissions("family_groups.create")
  createFamily(@CurrentUser() actor: AuthUser, @Body() dto: CreateFamilyGroupDto) {
    return this.service.createFamilyGroup(actor, dto);
  }

  @Get("family-groups/:id")
  @RequirePermissions("family_groups.read")
  getFamily(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getFamilyGroup(actor, id);
  }

  @Post("family-groups/:id/members")
  @RequirePermissions("family_groups.manage_members")
  addMember(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: AddFamilyMemberDto) {
    return this.service.addFamilyMember(actor, id, dto);
  }

  @Post("family-groups/:id/members/create-patient")
  @RequirePermissions("family_groups.manage_members")
  createMemberPatient(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: CreateFamilyMemberPatientDto
  ) {
    return this.service.createFamilyMemberPatient(actor, id, dto);
  }

  @Patch("family-groups/:id/members/:memberId")
  @RequirePermissions("family_groups.manage_members")
  updateMember(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Body() dto: UpdateFamilyMemberDto
  ) {
    return this.service.updateFamilyMember(actor, id, memberId, dto);
  }

  @Post("family-groups/:id/contacts")
  @RequirePermissions("family_groups.manage_contacts")
  addContact(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: AddFamilyContactDto) {
    return this.service.addFamilyContact(actor, id, dto);
  }

  @Post("family-groups/:id/grants")
  @RequirePermissions("family_groups.manage_permissions")
  grant(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CreateFamilyGrantDto) {
    return this.service.createFamilyGrant(actor, id, dto);
  }

  @Post("merges/preview")
  @RequirePermissions("patients.merge")
  mergePreview(@CurrentUser() actor: AuthUser, @Body() dto: MergePreviewDto) {
    return this.service.createMergePreview(actor, dto);
  }

  @Post("merges/:id/execute")
  @RequirePermissions("patients.merge")
  executeMerge(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: ExecuteMergeDto) {
    return this.service.executeMerge(actor, id, dto);
  }
}

@Controller("integrations/booking-identity")
@UseGuards(BookingBotApiKeyGuard)
export class BookingIdentityIntegrationController {
  constructor(private readonly service: PatientIdentityService) {}

  @Post("sessions")
  createSession(@Body() dto: CreateBookingIdentitySessionDto) {
    if (!dto.organizationId) throw new BadRequestException("organizationId es obligatorio");
    return this.service.createSession(dto.organizationId, dto);
  }

  @Post("sessions/:id/verify")
  verify(
    @Param("id") id: string,
    @Body() dto: VerifyBookingIdentityDto,
    @Headers("x-organization-id") organizationId?: string
  ) {
    return this.service.verifySession(this.requireOrganization(organizationId), id, dto);
  }

  @Post("sessions/:id/verify-contact")
  verifyContact(
    @Param("id") id: string,
    @Body() dto: VerifyBookingContactDto,
    @Headers("x-organization-id") organizationId?: string
  ) {
    return this.service.verifyBookingContact(this.requireOrganization(organizationId), id, dto);
  }

  @Post("sessions/:id/family-members/lookup")
  lookupFamilyMember(
    @Param("id") id: string,
    @Body() dto: LookupBookingFamilyMemberDto,
    @Headers("x-organization-id") organizationId?: string
  ) {
    return this.service.lookupBookingFamilyMember(this.requireOrganization(organizationId), id, dto);
  }

  @Post("sessions/:id/family-members")
  addFamilyMember(
    @Param("id") id: string,
    @Body() dto: AddBookingFamilyMemberDto,
    @Headers("x-organization-id") organizationId?: string,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.service.addBookingFamilyMember(
      this.requireOrganization(organizationId),
      id,
      dto,
      idempotencyKey
    );
  }

  @Post("sessions/:id/create-family")
  createFamily(
    @Param("id") id: string,
    @Body() dto: CreateBookingFamilyDto,
    @Headers("x-organization-id") organizationId?: string,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.service.createBookingFamily(
      this.requireOrganization(organizationId),
      id,
      dto,
      idempotencyKey
    );
  }

  @Post("sessions/:id/select-patient")
  select(
    @Param("id") id: string,
    @Body() dto: SelectBookingPatientDto,
    @Headers("x-organization-id") organizationId?: string
  ) {
    return this.service.selectSessionPatient(this.requireOrganization(organizationId), id, dto);
  }

  @Post("sessions/:id/appointments")
  book(
    @Param("id") id: string,
    @Body() dto: BookResolvedAppointmentDto,
    @Headers("x-organization-id") organizationId?: string,
    @Headers("idempotency-key") idempotencyKey?: string,
    @Headers("correlation-id") correlationId?: string
  ) {
    return this.service.bookResolvedAppointment(
      this.requireOrganization(organizationId),
      id,
      dto,
      idempotencyKey ?? "",
      correlationId
    );
  }

  private requireOrganization(value?: string) {
    if (!value?.trim()) throw new BadRequestException("x-organization-id es obligatorio");
    return value.trim();
  }
}
