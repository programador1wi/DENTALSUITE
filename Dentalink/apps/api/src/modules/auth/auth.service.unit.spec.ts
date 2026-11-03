import { UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

describe("AuthService refresh rotation", () => {
  const activeUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    phone: null,
    avatarUrl: null,
    status: "ACTIVE",
    isActive: true,
    deletedAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    authorizationVersion: 0,
    organization: {
      id: "org-1",
      name: "Clinic",
      isActive: true,
      status: "ACTIVE",
      branchScopeVersion: 0,
      branches: []
    },
    role: null,
    roles: [],
    permissions: [],
    branches: []
  };

  function harness(sessions: unknown[][], singleSessions: unknown[] = []) {
    const prisma: any = {
      session: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(singleSessions.shift() ?? null)),
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(singleSessions.shift() ?? null)),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(sessions.shift() ?? [])),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({})
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ ...activeUser, passwordHash: "$2a$12$hash" }),
        update: jest.fn().mockResolvedValue(activeUser)
      }
    };
    prisma.$transaction = jest.fn((cb: any) => cb(prisma));
    const jwt = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce("new-access-token")
        .mockResolvedValueOnce("new-refresh-token"),
      verifyAsync: jest.fn().mockResolvedValue({
        sub: "user-1",
        email: "admin@example.com",
        organizationId: "org-1",
        sid: "session-1",
        refreshVersion: 0
      })
    };
    const config = {
      get: jest.fn((key: string) => (key === "JWT_ACCESS_EXPIRES_IN" ? "15m" : "7d")),
      getOrThrow: jest.fn((key: string) => key)
    };
    const redis = { del: jest.fn() };
    return {
      service: new AuthService(prisma as never, jwt as never, config as never, redis as never),
      prisma,
      jwt
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rotates a matching session via selector and rejects replay of the revoked token", async () => {
    const session = {
      id: "session-1",
      userId: activeUser.id,
      refreshTokenHash: "66e4f4e9739a9ef9a9d6e414cfd05780c4ab0eb03e21fbf90ebf87e76d4db8f6",
      refreshVersion: 0,
      user: activeUser
    };
    const { service, prisma, jwt } = harness([], [session, null]);

    const rotated = await service.refresh("old-refresh-token", {
      ipAddress: "127.0.0.1",
      userAgent: "jest"
    });

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-1",
        refreshVersion: 0,
        refreshTokenHash: "66e4f4e9739a9ef9a9d6e414cfd05780c4ab0eb03e21fbf90ebf87e76d4db8f6",
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) }
      },
      data: {
        refreshVersion: 1,
        refreshTokenHash: expect.any(String),
        userAgent: "jest",
        ipAddress: "127.0.0.1",
        expiresAt: expect.any(Date)
      }
    });
    expect(prisma.session.findMany).not.toHaveBeenCalled();
    expect(prisma.session.create).not.toHaveBeenCalled();
    expect(rotated).toMatchObject({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token"
    });

    jwt.verifyAsync.mockRejectedValueOnce(new Error("Token revoked"));
    await expect(
      service.refresh("old-refresh-token", { ipAddress: "127.0.0.1" })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("does not rotate a session for a deactivated user", async () => {
    const session = {
      id: "session-1",
      userId: activeUser.id,
      refreshTokenHash: "66e4f4e9739a9ef9a9d6e414cfd05780c4ab0eb03e21fbf90ebf87e76d4db8f6",
      refreshVersion: 0,
      user: { ...activeUser, isActive: false }
    };
    const { service, prisma } = harness([], [session]);

    await expect(
      service.refresh("old-refresh-token", { ipAddress: "127.0.0.1" })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.session.update).not.toHaveBeenCalled();
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it("rejects a concurrent replay when another request already claimed the session", async () => {
    const session = {
      id: "session-1",
      userId: activeUser.id,
      refreshTokenHash: "743fbde4b2d617393e742b7cbb4a4ed9ede95ea208347d7adffe312c6ac1e224",
      refreshVersion: 0,
      user: activeUser
    };
    const { service, prisma } = harness([], [session]);
    prisma.session.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.refresh("replayed-refresh-token", { ipAddress: "127.0.0.1" })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.session.create).not.toHaveBeenCalled();
    expect(prisma.session.findMany).not.toHaveBeenCalled();
  });

  it("rejects legacy refresh tokens without a selector instead of scanning hashes", async () => {
    const { service, prisma, jwt } = harness([]);
    jwt.verifyAsync.mockResolvedValueOnce({ sub: "user-1", tokenId: "legacy" });

    await expect(
      service.refresh("legacy-refresh-token", { ipAddress: "127.0.0.1" })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.session.findFirst).not.toHaveBeenCalled();
    expect(prisma.session.findMany).not.toHaveBeenCalled();
  });

  it("revokes all active sessions when user changes password", async () => {
    jest.spyOn(bcrypt, "compare").mockResolvedValue(true as never);
    jest.spyOn(bcrypt, "hash").mockResolvedValue("new-password-hash" as never);
    const { service, prisma } = harness([]);

    const result = await service.changePassword("user-1", {
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!"
    });

    expect(result).toEqual({ success: true, message: "Contraseña actualizada con éxito" });
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "new-password-hash" }
    });
  });
});
