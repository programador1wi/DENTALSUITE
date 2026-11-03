import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequireAnyPermission, RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CollaboratorsService } from "./collaborators.service";
import { CreateCollaboratorDto } from "./dto/create-collaborator.dto";
import { CreateProfessionalAccessDto } from "./dto/create-professional-access.dto";
import { ListCollaboratorsQueryDto } from "./dto/list-collaborators-query.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("collaborators")
export class CollaboratorsController {
  constructor(private readonly collaboratorsService: CollaboratorsService) {}

  @Get()
  @RequireAnyPermission("users.read", "professionals.read")
  findAll(@CurrentUser() actor: AuthUser, @Query() query: ListCollaboratorsQueryDto) {
    return this.collaboratorsService.findAll(actor, query);
  }

  @Post()
  @RequirePermissions("users.create")
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateCollaboratorDto) {
    return this.collaboratorsService.create(actor, dto);
  }

  @Post("professionals/:professionalId/access")
  @RequirePermissions("users.create", "professionals.update")
  createProfessionalAccess(
    @CurrentUser() actor: AuthUser,
    @Param("professionalId") professionalId: string,
    @Body() dto: CreateProfessionalAccessDto
  ) {
    return this.collaboratorsService.createProfessionalAccess(actor, professionalId, dto);
  }
}
