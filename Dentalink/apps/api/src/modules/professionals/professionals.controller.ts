import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CreateProfessionalDto } from "./dto/create-professional.dto";
import { UpdateProfessionalDto } from "./dto/update-professional.dto";
import { ConfigProfessionalDto } from "./dto/config-professional.dto";
import { TransferProfessionalBranchDto } from "./dto/transfer-professional-branch.dto";
import { BulkProfessionalContractDto } from "./dto/bulk-professional-contract.dto";
import { ProfessionalsService } from "./professionals.service";

@ApiTags("Professionals")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("professionals")
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  @Get()
  @RequirePermissions("professionals.read")
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("active") active?: string,
    @Query("branchId") branchId?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.professionalsService.findAll(user, search, active, branchId, page, pageSize);
  }

  @Get(":id")
  @RequirePermissions("professionals.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.professionalsService.findOne(user, id);
  }

  @Post()
  @RequirePermissions("professionals.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProfessionalDto) {
    return this.professionalsService.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("professionals.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateProfessionalDto) {
    return this.professionalsService.update(user, id, dto);
  }

  @Patch(":id/branches/:branchId/agenda-config")
  @RequirePermissions("professionals.update")
  updateAgendaConfig(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("branchId") branchId: string,
    @Body() dto: ConfigProfessionalDto
  ) {
    return this.professionalsService.updateAgendaConfig(user, id, branchId, dto);
  }

  @Post("branch-transfer")
  @RequirePermissions("professionals.update")
  transferBranch(@CurrentUser() user: AuthUser, @Body() dto: TransferProfessionalBranchDto) {
    return this.professionalsService.transferBranch(user, dto);
  }

  @Post("contracts/bulk")
  @RequirePermissions("professionals.update")
  bulkContracts(@CurrentUser() user: AuthUser, @Body() dto: BulkProfessionalContractDto) {
    return this.professionalsService.bulkUpdateContracts(user, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("professionals.deactivate")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.professionalsService.deactivate(user, id);
  }
}
