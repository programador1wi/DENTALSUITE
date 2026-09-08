import { UnauthorizedException } from "@nestjs/common";
import { AuthController } from "./auth.controller";

describe("AuthController refresh cookie transition", () => {
  const user = {
    id: "user-1",
    organizationId: "org-1",
    email: "admin@example.com"
  };

  function harness(options?: { includeLegacyToken?: string; refreshExpiresIn?: string }) {
    const authService = {
      login: jest.fn().mockResolvedValue({
        user,
        accessToken: "access-token",
        refreshToken: "refresh-token-value",
        expiresIn: "15m"
      }),
      refresh: jest.fn().mockResolvedValue({
        user,
        accessToken: "rotated-access-token",
        refreshToken: "rotated-refresh-token-value",
        expiresIn: "15m"
      }),
      logout: jest.fn().mockResolvedValue({ success: true })
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === "NODE_ENV") return "production";
        if (key === "JWT_REFRESH_EXPIRES_IN") return options?.refreshExpiresIn ?? "7d";
        if (key === "AUTH_INCLUDE_REFRESH_TOKEN_IN_RESPONSE") {
          return options?.includeLegacyToken;
        }
        return undefined;
      })
    };
    const response = {
      cookie: jest.fn(),
      clearCookie: jest.fn()
    };
    return {
      controller: new AuthController(authService as never, config as never),
      authService,
      response
    };
  }

  it("sets a secure HttpOnly Lax cookie and omits the refresh token in production", async () => {
    const { controller, response } = harness({ refreshExpiresIn: "2d" });

    const result = await controller.login(
      { email: "admin@example.com", password: "password-value" },
      { headers: {}, ip: "127.0.0.1" } as never,
      response as never
    );

    expect(response.cookie).toHaveBeenCalledWith("refreshToken", "refresh-token-value", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/v1/auth",
      maxAge: 2 * 24 * 60 * 60 * 1000
    });
    expect(result).not.toHaveProperty("refreshToken");
  });

  it("accepts refresh from the cookie and can omit the legacy JSON token", async () => {
    const { controller, authService, response } = harness({ includeLegacyToken: "false" });

    const result = await controller.refresh(
      {},
      {
        headers: { cookie: "other=value; refreshToken=cookie-refresh-token-value" },
        ip: "127.0.0.1"
      } as never,
      response as never
    );

    expect(authService.refresh).toHaveBeenCalledWith("cookie-refresh-token-value", {
      userAgent: undefined,
      ipAddress: "127.0.0.1"
    });
    expect(result).not.toHaveProperty("refreshToken");
    expect(response.cookie).toHaveBeenCalledWith(
      "refreshToken",
      "rotated-refresh-token-value",
      expect.objectContaining({ httpOnly: true, sameSite: "lax" })
    );
  });

  it("rejects refresh when neither body nor cookie contains a token", async () => {
    const { controller, response } = harness();

    await expect(
      controller.refresh({}, { headers: {}, ip: "127.0.0.1" } as never, response as never)
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("clears the cookie and revokes the cookie-backed session on logout", async () => {
    const { controller, authService, response } = harness();

    await controller.logout(
      user as never,
      {},
      { headers: { cookie: "refreshToken=cookie-refresh-token-value" } } as never,
      response as never
    );

    expect(response.clearCookie).toHaveBeenCalledWith(
      "refreshToken",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/api/v1/auth" })
    );
    expect(authService.logout).toHaveBeenCalledWith("user-1", "cookie-refresh-token-value", undefined);
  });
});
