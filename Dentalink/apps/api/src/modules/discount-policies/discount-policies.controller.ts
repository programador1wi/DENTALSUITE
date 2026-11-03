import { Body, Controller, Get, Param, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { DiscountPoliciesService } from "./discount-policies.service";
import { ListUserDiscountPoliciesQueryDto, UpsertUserDiscountPolicyDto } from "./dto/discount-policy.dto";

@ApiTags("DiscountPolicies")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("discount-policies")
export class DiscountPoliciesController {
  constructor(private readonly service: DiscountPoliciesService) {}

  @Get("users")
  @RequirePermissions("treatment_discount.configure_user_limits")
  listUsers(@CurrentUser() actor: AuthUser, @Query() query: ListUserDiscountPoliciesQueryDto) {
    return this.service.listUsers(actor, query);
  }

  @Put("users/:userId")
  @RequirePermissions("treatment_discount.configure_user_limits")
  upsertUser(
    @CurrentUser() actor: AuthUser,
    @Param("userId") userId: string,
    @Body() dto: UpsertUserDiscountPolicyDto
  ) {
    return this.service.upsertUser(actor, userId, dto);
  }
}
