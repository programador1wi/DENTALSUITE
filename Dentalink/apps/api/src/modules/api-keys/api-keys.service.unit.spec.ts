import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { ApiKeysService } from "./api-keys.service";

describe("ApiKeysService", () => {
  let service: ApiKeysService;
  let prisma: Partial<PrismaService>;

  const actor: AuthUser = {
    id: "user-admin",
    organizationId: "org-1",
    email: "admin@clinica.com",
    firstName: "Admin",
    lastName: "Dental",
    roleIds: ["role-admin"],
    roleNames: ["Administrador"],
    permissions: ["developer_api.credentials.manage"],
    branchIds: ["branch-1"]
  };

  beforeEach(() => {
    prisma = {
      apiKey: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn()
      } as unknown as typeof prisma.apiKey,
      apiKeySecret: { updateMany: jest.fn(), create: jest.fn() } as unknown as typeof prisma.apiKeySecret,
      branch: { count: jest.fn().mockResolvedValue(1) } as unknown as typeof prisma.branch,
      $transaction: jest.fn()
    };
    service = new ApiKeysService(prisma as PrismaService);
  });

  it("genera dsk_live_, persiste solo hash y devuelve secreto una vez", async () => {
    (prisma.apiKey!.create as jest.Mock).mockImplementation(({ data }) => {
      const secret = data.secrets.create;
      return Promise.resolve({
        id: "key-123",
        ...data,
        secrets: [{ id: "secret-1", apiKeyId: "key-123", ...secret, revokedAt: null, createdAt: new Date() }],
        createdBy: null,
        lastUsedAt: null,
        lastUsedIp: null,
        revokedAt: null,
        revokedById: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    const result = await service.createApiKey(actor, {
      name: "Integracion Bot",
      scopes: ["patients:read", "appointments:write"],
      branchScope: "ALL",
      networkScope: "ANY",
      expiresInDays: 90
    });

    expect(result.secret).toMatch(/^dsk_live_[A-Za-z0-9_-]{43}$/);
    expect(result.shownOnce).toBe(true);
    expect(result.credential.keyPrefix).toMatch(/^dsk_live_[A-Za-z0-9_-]+…$/);
    const persisted = (prisma.apiKey!.create as jest.Mock).mock.calls[0][0].data.secrets.create;
    expect(persisted.keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify((prisma.apiKey!.create as jest.Mock).mock.calls[0][0].data)).not.toContain(result.secret);
  });

  it("rechaza sucursales fuera de la organizacion", async () => {
    (prisma.branch!.count as jest.Mock).mockResolvedValue(1);
    await expect(service.createApiKey(actor, {
      name: "Clave invalida",
      scopes: ["patients:read"],
      branchScope: "SELECTED",
      branchIds: ["branch-1", "branch-999"],
      networkScope: "ANY",
      expiresInDays: 30
    })).rejects.toThrow(BadRequestException);
  });

  it("rechaza scopes internos y duplicados", async () => {
    await expect(service.createApiKey(actor, {
      name: "Clave invalida",
      scopes: ["patients.read"],
      branchScope: "ALL",
      networkScope: "ANY",
      expiresInDays: 30
    })).rejects.toThrow(BadRequestException);
  });

  it("no revela si una credencial inexistente pertenece a otra organizacion", async () => {
    (prisma.apiKey!.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.revokeApiKey(actor, "key-inexistente")).rejects.toThrow(NotFoundException);
  });
});
