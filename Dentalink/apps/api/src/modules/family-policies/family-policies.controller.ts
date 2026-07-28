import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  CancelFamilyPolicyDto,
  CreateFamilyPolicyDto,
  CreatePolicyProductCoverageDto,
  ApplyFamilyPolicyCoverageDto,
  AddFamilyPolicyMemberDto,
  ListPatientPoliciesQueryDto,
  RegisterFamilyPolicyPaymentDto,
  ReverseFamilyPolicyUsageDto,
  RemoveFamilyPolicyMemberDto,
  SimulateFamilyPolicyCoverageDto,
  ReplaceFamilyPolicyMembersDto,
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

  @Post("products/:productId/coverages")
  @RequirePermissions("family_policies.manage")
  createProductCoverage(
    @CurrentUser() actor: AuthUser,
    @Param("productId") productId: string,
    @Body() dto: CreatePolicyProductCoverageDto,
  ) {
    return this.service.createProductCoverage(actor, productId, dto);
  }

  @Get("patients/:patientId")
  @RequirePermissions("family_policies.read")
  listForPatient(
    @CurrentUser() actor: AuthUser,
    @Param("patientId") patientId: string,
    @Query() query: ListPatientPoliciesQueryDto,
  ) {
    return this.service.listForPatient(actor, patientId, query);
  }

  @Get("patients/:patientId/:policyNumber")
  @RequirePermissions("family_policies.read")
  getPatientPolicy(
    @CurrentUser() actor: AuthUser,
    @Param("patientId") patientId: string,
    @Param("policyNumber") policyNumber: string,
  ) {
    return this.service.getPatientPolicy(actor, patientId, policyNumber);
  }

  @Get("families/:familyGroupId")
  @RequirePermissions("family_policies.read")
  listForFamily(
    @CurrentUser() actor: AuthUser,
    @Param("familyGroupId") familyGroupId: string,
  ) {
    return this.service.listForFamily(actor, familyGroupId);
  }

  @Get(":policyNumber")
  @RequirePermissions("family_policies.read")
  getPolicy(
    @CurrentUser() actor: AuthUser,
    @Param("policyNumber") policyNumber: string,
  ) {
    return this.service.getPolicyByNumber(actor, policyNumber);
  }

  @Post()
  @RequirePermissions("family_policies.create")
  createDraft(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateFamilyPolicyDto,
  ) {
    return this.service.createDraft(actor, dto);
  }

  @Patch(":policyNumber/members")
  @RequirePermissions("family_policies.manage")
  replaceMembers(
    @CurrentUser() actor: AuthUser,
    @Param("policyNumber") policyNumber: string,
    @Body() dto: ReplaceFamilyPolicyMembersDto,
  ) {
    return this.service.replaceMembers(actor, policyNumber, dto);
  }

  @Post(":policyNumber/members")
  @RequirePermissions("family_policies.manage")
  addMember(
    @CurrentUser() actor: AuthUser,
    @Param("policyNumber") policyNumber: string,
    @Body() dto: AddFamilyPolicyMemberDto,
  ) {
    return this.service.addMember(actor, policyNumber, dto);
  }

  @Post(":policyNumber/members/:memberId/remove")
  @RequirePermissions("family_policies.manage")
  removeMember(
    @CurrentUser() actor: AuthUser,
    @Param("policyNumber") policyNumber: string,
    @Param("memberId") memberId: string,
    @Body() dto: RemoveFamilyPolicyMemberDto,
  ) {
    return this.service.removeMember(actor, policyNumber, memberId, dto);
  }

  @Post(":policyNumber/payments")
  @RequirePermissions("family_policies.activate", "payments.create")
  registerPayment(
    @CurrentUser() actor: AuthUser,
    @Param("policyNumber") policyNumber: string,
    @Body() dto: RegisterFamilyPolicyPaymentDto,
  ) {
    return this.service.registerPayment(actor, policyNumber, dto);
  }

  @Post(":policyNumber/simulations")
  @RequirePermissions("family_policies.coverage.read")
  simulateCoverage(
    @CurrentUser() actor: AuthUser,
    @Param("policyNumber") policyNumber: string,
    @Body() dto: SimulateFamilyPolicyCoverageDto,
  ) {
    return this.service.simulateCoverage(actor, policyNumber, dto);
  }

  @Post(":policyNumber/apply")
  @RequirePermissions("family_policies.coverage.apply")
  applyCoverage(
    @CurrentUser() actor: AuthUser,
    @Param("policyNumber") policyNumber: string,
    @Body() dto: ApplyFamilyPolicyCoverageDto,
  ) {
    return this.service.applyCoverage(actor, policyNumber, dto);
  }

  @Post(":policyNumber/usages/:usageId/reverse")
  @RequirePermissions("family_policies.coverage.apply")
  reverseUsage(
    @CurrentUser() actor: AuthUser,
    @Param("policyNumber") policyNumber: string,
    @Param("usageId") usageId: string,
    @Body() dto: ReverseFamilyPolicyUsageDto,
  ) {
    return this.service.reverseUsage(actor, policyNumber, usageId, dto);
  }

  @Post(":policyNumber/cancel")
  @RequirePermissions("family_policies.manage")
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param("policyNumber") policyNumber: string,
    @Body() dto: CancelFamilyPolicyDto,
  ) {
    return this.service.cancel(actor, policyNumber, dto);
  }
}
