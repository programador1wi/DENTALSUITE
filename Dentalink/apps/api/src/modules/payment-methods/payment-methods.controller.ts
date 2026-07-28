import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CreatePaymentMethodDto } from "./dto/create-payment-method.dto";
import { UpdatePaymentMethodDto } from "./dto/update-payment-method.dto";
import { ChangePaymentMethodStatusDto } from "./dto/update-payment-method.dto";
import { PaymentMethodType } from "@prisma/client";
import { PaymentMethodsService } from "./payment-methods.service";

@ApiTags("PaymentMethods")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("payment-methods")
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  @RequirePermissions("payment_methods.read")
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("active") active?: string,
    @Query("type") type?: PaymentMethodType,
    @Query("allowsRefund") allowsRefund?: string,
    @Query("acceptsMultipleSettlements") acceptsMultipleSettlements?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.paymentMethodsService.findAll(user, {
      search,
      active,
      type,
      allowsRefund,
      acceptsMultipleSettlements,
      page,
      pageSize
    });
  }

  @Get(":id")
  @RequirePermissions("payment_methods.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.paymentMethodsService.findOne(user, id);
  }

  @Post()
  @RequirePermissions("payment_methods.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentMethodDto) {
    return this.paymentMethodsService.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("payment_methods.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdatePaymentMethodDto) {
    return this.paymentMethodsService.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("payment_methods.deactivate")
  deactivate(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ChangePaymentMethodStatusDto
  ) {
    return this.paymentMethodsService.deactivate(user, id, dto);
  }

  @Patch(":id/reactivate")
  @RequirePermissions("payment_methods.reactivate")
  reactivate(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ChangePaymentMethodStatusDto
  ) {
    return this.paymentMethodsService.reactivate(user, id, dto);
  }

  @Get(":id/audit")
  @RequirePermissions("payment_methods.view_audit")
  audit(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.paymentMethodsService.auditHistory(user, id);
  }
}
