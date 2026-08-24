import { Body, Controller, Get, Patch, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthUser } from "../../common/types/auth-user";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterOrganizationDto } from "./dto/register-organization.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractCookie(cookieHeader: string | undefined, name: string): string | undefined {
    if (!cookieHeader) return undefined;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : undefined;
  }

  private setRefreshTokenCookie(response: Response, token: string) {
    response.cookie("refreshToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  }

  @Public()
  @Post("register-organization")
  @ApiOperation({ summary: "Register organization and bootstrap initial admin" })
  @ApiResponse({ status: 201, description: "Organization registered successfully" })
  async registerOrganization(
    @Body() dto: RegisterOrganizationDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.registerOrganization(dto, {
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip
    });
    this.setRefreshTokenCookie(response, result.refreshToken);
    return result;
  }

  @Public()
  @Post("login")
  @ApiOperation({ summary: "Login with email and password" })
  @ApiResponse({ status: 200, description: "Login success" })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.login(dto, {
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip
    });
    this.setRefreshTokenCookie(response, result.refreshToken);
    return result;
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "Refresh access token" })
  @ApiResponse({ status: 200, description: "Token refreshed" })
  async refresh(
    @Body() dto: Partial<RefreshTokenDto>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const cookieToken = this.extractCookie(request.headers.cookie, "refreshToken");
    const token = dto.refreshToken || cookieToken;
    if (!token) {
      throw new UnauthorizedException("Refresh token is required");
    }

    const result = await this.authService.refresh(token, {
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip
    });
    this.setRefreshTokenCookie(response, result.refreshToken);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout and revoke session(s)" })
  @ApiResponse({ status: 200, description: "Logout success" })
  async logout(
    @CurrentUser() user: AuthUser,
    @Body() dto: Partial<RefreshTokenDto>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const cookieToken = this.extractCookie(request.headers.cookie, "refreshToken");
    const token = dto.refreshToken || cookieToken;
    response.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth"
    });
    return this.authService.logout(user.id, token);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get authenticated user" })
  @ApiResponse({ status: 200, description: "Authenticated user info" })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Patch("profile")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update authenticated user profile" })
  @ApiResponse({ status: 200, description: "Profile updated successfully" })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change authenticated user password" })
  @ApiResponse({ status: 200, description: "Password changed successfully" })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }
}
