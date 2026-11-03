import { AgreementStatus, Prisma } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { SettingsService } from "./settings.service";

describe("SettingsService agreements", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1"],
    permissions: ["agreements.read"]
  };

  const agreement = {
    id: "agreement-1",
    organizationId: "org-1",
    name: "Empresa",
    version: 2,
    isActive: true,
    status: AgreementStatus.ACTIVE,
    startsAt: new Date("2026-01-01"),
    endsAt: new Date("2026-12-31")
  };

  const version = {
    id: "agreement-version-2",
    agreementId: agreement.id,
    organizationId: "org-1",
    version: 2,
    priceListId: "price-list-1",
    discountPercent: new Prisma.Decimal(10),
    coveragePercent: new Prisma.Decimal(50),
    copayAmount: new Prisma.Decimal(20),
    coverageLimitAmount: new Prisma.Decimal(100),
    coverageRules: { authorization: false },
    branches: [{ branchId: "branch-1" }],
    categoryRules: [],
    procedureRules: []
  };

  beforeEach(() => {
    process.env.AGREEMENTS_V2_ENABLED = "true";
  });

  it("previews normal, preferred and coverage amounts without writing a plan", async () => {
    const prisma = {
      agreement: { findFirst: jest.fn().mockResolvedValue(agreement) },
      agreementVersion: { findFirst: jest.fn().mockResolvedValue(version) },
      procedure: {
        findFirst: jest.fn().mockResolvedValue({ id: "procedure-1", code: "LIMP", name: "Limpieza" })
      },
      priceListItem: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ price: new Prisma.Decimal(200), priceListId: "price-list-1" })
      }
    };
    const service = new SettingsService(prisma as never);

    const result = await service.previewAgreementPrice(actor, agreement.id, {
      branchId: "branch-1",
      procedureId: "procedure-1",
      quantity: 1
    });

    expect(result).toMatchObject({
      normalPrice: 200,
      appliedPrice: 180,
      discountAmount: 20,
      coverageAmount: 80,
      patientTotal: 100,
      agreementVersion: 2
    });
    expect(prisma.priceListItem.findFirst).toHaveBeenCalled();
  });

  it("rejects a preview outside the agreement branch scope", async () => {
    const prisma = {
      agreement: { findFirst: jest.fn().mockResolvedValue(agreement) },
      agreementVersion: { findFirst: jest.fn().mockResolvedValue(version) }
    };
    const service = new SettingsService(prisma as never);

    await expect(
      service.previewAgreementPrice(actor, agreement.id, { branchId: "branch-2", procedureId: "procedure-1" })
    ).rejects.toThrow("Branch access denied");
  });
});
