import { Body, Controller, ForbiddenException, Get, Patch, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
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
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService
  ) {}

  private extractCookie(cookieHeader: string | undefined, name: string): string | undefined {
    if (!cookieHeader) return undefined;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    if (!match) return undefined;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return undefined;
    }
  }

  private setRefreshTokenCookie(response: Response, token: string) {
    response.cookie("refreshToken", token, {
      httpOnly: true,
      secure: this.config.get<string>("NODE_ENV") === "production",
      sameSite: "lax",
      path: "/api/v1/auth",
      maxAge: this.refreshTokenMaxAgeMs()
    });
  }

  private clearRefreshTokenCookie(response: Response) {
    response.clearCookie("refreshToken", {
      httpOnly: true,
      secure: this.config.get<string>("NODE_ENV") === "production",
      sameSite: "lax",
      path: "/api/v1/auth"
    });
  }

  private refreshTokenMaxAgeMs() {
    const configured = this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d";
    const match = /^(\d+)([mhd])$/.exec(configured);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const amount = Number(match[1]);
    if (match[2] === "m") return amount * 60 * 1000;
    if (match[2] === "h") return amount * 60 * 60 * 1000;
    return amount * 24 * 60 * 60 * 1000;
  }

  private assertTrustedBrowserOrigin(request: Request) {
    const originHeader = request.headers.origin;
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    const fetchSiteHeader = request.headers["sec-fetch-site"];
    const fetchSite = Array.isArray(fetchSiteHeader) ? fetchSiteHeader[0] : fetchSiteHeader;
    if (!origin) {
      if (fetchSite === "cross-site") {
        throw new ForbiddenException({
          code: "AUTH_ORIGIN_FORBIDDEN",
          message: "El origen de la solicitud no está autorizado."
        });
      }
      return;
    }
    const allowedOrigins = new Set(
      (this.config.get<string>("CORS_ORIGINS") ?? "http://localhost:3000")
        .split(",")
        .map((value) => value.trim().replace(/\/$/, ""))
        .filter(Boolean)
    );
    if (!allowedOrigins.has(origin.trim().replace(/\/$/, ""))) {
      throw new ForbiddenException({
        code: "AUTH_ORIGIN_FORBIDDEN",
        message: "El origen de la solicitud no está autorizado."
      });
    }
  }

  private authResponse<T extends { refreshToken: string }>(result: T) {
    const isProduction = this.config.get<string>("NODE_ENV") === "production";
    const includeLegacyToken =
      !isProduction &&
      (this.config.get<string>("AUTH_INCLUDE_REFRESH_TOKEN_IN_RESPONSE") ?? "true").toLowerCase() === "true";
    if (includeLegacyToken) return result;
    const safeResult = { ...result } as Partial<T>;
    delete safeResult.refreshToken;
    return safeResult;
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
    throw new ForbiddenException({
      code: "ORGANIZATION_REGISTRATION_DISABLED",
      message: "El alta de organizaciones requiere aprovisionamiento interno"
    });
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
    this.assertTrustedBrowserOrigin(request);
    const result = await this.authService.login(dto, {
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip
    });
    this.setRefreshTokenCookie(response, result.refreshToken);
    return this.authResponse(result);
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "Refresh access token" })
  @ApiResponse({ status: 200, description: "Token refreshed" })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    this.assertTrustedBrowserOrigin(request);
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
    return this.authResponse(result);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout and revoke session(s)" })
  @ApiResponse({ status: 200, description: "Logout success" })
  async logout(
    @CurrentUser() user: AuthUser,
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    this.assertTrustedBrowserOrigin(request);
    const cookieToken = this.extractCookie(request.headers.cookie, "refreshToken");
    const token = dto.refreshToken || cookieToken;
    this.clearRefreshTokenCookie(response);
    return this.authService.logout(user.id, token, user.sessionId);
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
