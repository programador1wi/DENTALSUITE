import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController browser origin defense", () => {
  let app: INestApplication;
  const authService = {
    login: jest.fn().mockResolvedValue({
      user: { id: "user-1" },
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: "15m"
    }),
    refresh: jest.fn().mockResolvedValue({
      user: { id: "user-1" },
      accessToken: "rotated-access-token",
      refreshToken: "rotated-refresh-token",
      expiresIn: "15m"
    })
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "CORS_ORIGINS") return "https://app.dental.example,https://admin.dental.example";
              if (key === "NODE_ENV") return "production";
              if (key === "JWT_REFRESH_EXPIRES_IN") return "7d";
              if (key === "AUTH_INCLUDE_REFRESH_TOKEN_IN_RESPONSE") return "false";
              return undefined;
            })
          }
        }
      ]
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  it("rejects a cross-origin cookie refresh before calling the auth service", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Origin", "https://attacker.example")
      .set("Cookie", "refreshToken=stolen-token")
      .send({})
      .expect(403);

    expect(response.body).toMatchObject({ code: "AUTH_ORIGIN_FORBIDDEN" });
    expect(authService.refresh).not.toHaveBeenCalled();
  });

  it("accepts an allowed origin and emits the secure refresh cookie", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Origin", "https://app.dental.example")
      .send({ email: "admin@example.com", password: "password-value" })
      .expect(201);

    expect(authService.login).toHaveBeenCalledTimes(1);
    expect(response.headers["set-cookie"]?.[0]).toContain("refreshToken=refresh-token");
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]?.[0]).toContain("Secure");
    expect(response.body).not.toHaveProperty("refreshToken");
  });

  it("rejects a browser-declared cross-site request that omits Origin", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Sec-Fetch-Site", "cross-site")
      .set("Cookie", "refreshToken=stolen-token")
      .send({})
      .expect(403);
    expect(authService.refresh).not.toHaveBeenCalled();
  });
});
