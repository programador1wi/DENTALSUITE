import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CreateProcedureDto } from "./dto/create-procedure.dto";
import { UpdateProcedureDto } from "./dto/update-procedure.dto";
import { ProceduresService } from "./procedures.service";

@ApiTags("Procedures")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("procedures")
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

  @Get()
  @RequirePermissions("procedures.read")
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("active") active?: string,
    @Query("categoryId") categoryId?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.proceduresService.findAll(user, search, active, categoryId, page, pageSize);
  }

  @Get(":id")
  @RequirePermissions("procedures.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.proceduresService.findOne(user, id);
  }

  @Post()
  @RequirePermissions("procedures.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProcedureDto) {
    return this.proceduresService.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("procedures.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateProcedureDto) {
    return this.proceduresService.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @RequirePermissions("procedures.deactivate")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.proceduresService.deactivate(user, id);
  }
}
