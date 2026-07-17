import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  CancelFamilyPolicyDto,
  CreateFamilyPolicyDto,
  RegisterFamilyPolicyPaymentDto,
  ReplaceFamilyPolicyMembersDto
} from "./dto/family-policy.dto";
import { FamilyPoliciesService } from "./family-policies.service";

@Controller("family-policies")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FamilyPoliciesController {
  constructor(private readonly service: FamilyPoliciesService) {}

  @Get("products")
  @RequirePermissions("family_policies.read")
  listProducts(@CurrentUser() actor: AuthUser) {
    return this.service.listProducts(actor);
  }

  @Get("patients/:patientId")
  @RequirePermissions("family_policies.read")
  listForPatient(@CurrentUser() actor: AuthUser, @Param("patientId") patientId: string) {
    return this.service.listForPatient(actor, patientId);
  }

  @Get("families/:familyGroupId")
  @RequirePermissions("family_policies.read")
  listForFamily(@CurrentUser() actor: AuthUser, @Param("familyGroupId") familyGroupId: string) {
    return this.service.listForFamily(actor, familyGroupId);
  }

  @Get(":policyId")
  @RequirePermissions("family_policies.read")
  getPolicy(@CurrentUser() actor: AuthUser, @Param("policyId") policyId: string) {
    return this.service.getPolicy(actor, policyId);
  }

  @Post()
  @RequirePermissions("family_policies.create")
  createDraft(@CurrentUser() actor: AuthUser, @Body() dto: CreateFamilyPolicyDto) {
    return this.service.createDraft(actor, dto);
  }

  @Patch(":policyId/members")
  @RequirePermissions("family_policies.manage")
  replaceMembers(
    @CurrentUser() actor: AuthUser,
    @Param("policyId") policyId: string,
    @Body() dto: ReplaceFamilyPolicyMembersDto
  ) {
    return this.service.replaceMembers(actor, policyId, dto);
  }

  @Post(":policyId/payments")
  @RequirePermissions("family_policies.activate", "payments.create")
  registerPayment(
    @CurrentUser() actor: AuthUser,
    @Param("policyId") policyId: string,
    @Body() dto: RegisterFamilyPolicyPaymentDto
  ) {
    return this.service.registerPayment(actor, policyId, dto);
  }

  @Post(":policyId/cancel")
  @RequirePermissions("family_policies.manage")
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param("policyId") policyId: string,
    @Body() dto: CancelFamilyPolicyDto
  ) {
    return this.service.cancel(actor, policyId, dto);
  }
}
