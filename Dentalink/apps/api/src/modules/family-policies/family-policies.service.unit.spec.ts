import { BadRequestException, ConflictException } from "@nestjs/common";
import { FamilyPolicyStatus, PolicyModality } from "@prisma/client";
import { FamilyPoliciesService } from "./family-policies.service";

const actor = {
  id: "user-1",
  organizationId: "org-1",
  email: "admin@clinic.test",
  firstName: "Admin",
  lastName: "Clinic",
  roleIds: [],
  roleNames: [],
  permissions: [],
  branchIds: ["branch-1"]
};

const product = (minimumMembers: number, maximumMembers: number) => ({
  id: `product-${maximumMembers}`,
  organizationId: "org-1",
  productCode: maximumMembers === 1 ? "POL-IND" : maximumMembers === 2 ? "POL-DUAL" : "POL-FAM4",
  name: maximumMembers === 1 ? "Individual" : maximumMembers === 2 ? "Dual" : "Familiar",
  modality:
    maximumMembers === 1
      ? PolicyModality.INDIVIDUAL
      : maximumMembers === 2
        ? PolicyModality.DUAL
        : PolicyModality.FAMILY,
  minimumMembers,
  maximumMembers,
  durationMonths: 12,
  basePrice: 0,
  currency: "MXN",
  activationRules: null,
  status: "ACTIVE"
});

const createDto = (memberPatientIds: string[]) => ({
  policyProductId: "product-1",
  familyGroupId: "family-1",
  holderPatientId: "patient-1",
  memberPatientIds,
  effectiveFrom: "2026-08-01",
  contractedPrice: 1000
});

function makeService(prisma: Record<string, unknown>, payments: Record<string, unknown> = {}) {
  return new FamilyPoliciesService(prisma as never, payments as never);
}

function basePrisma(selectedProduct: ReturnType<typeof product>) {
  return {
    policyProduct: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn().mockResolvedValue(selectedProduct)
    },
    patient: {
      findFirst: jest.fn().mockResolvedValue({
        id: "patient-1",
        branchId: "branch-1",
        status: "ACTIVE"
      })
    },
    familyGroup: {
      findFirst: jest.fn().mockResolvedValue({
        id: "family-1",
        branchId: "branch-1",
        status: "ACTIVE"
      })
    }
  };
}

describe("FamilyPoliciesService member limits", () => {
  it("prevents a second person on an individual policy", async () => {
    const service = makeService(basePrisma(product(1, 1)));

    await expect(service.createDraft(actor, createDto(["patient-1", "patient-2"]))).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("prevents a third person on a dual policy", async () => {
    const service = makeService(basePrisma(product(2, 2)));

    await expect(
      service.createDraft(actor, createDto(["patient-1", "patient-2", "patient-3"]))
    ).rejects.toThrow("máximo 2 integrantes");
  });

  it("prevents a fifth person on a family policy", async () => {
    const service = makeService(basePrisma(product(3, 4)));

    await expect(
      service.createDraft(actor, createDto(["patient-1", "patient-2", "patient-3", "patient-4", "patient-5"]))
    ).rejects.toThrow("máximo 4 integrantes");
  });

  it("creates a family policy with four people including the holder", async () => {
    const familyProduct = product(3, 4);
    const finalPolicy = {
      id: "policy-1",
      policyNumber: "POL-2026-000001",
      status: FamilyPolicyStatus.DRAFT,
      policyProduct: familyProduct,
      members: ["patient-1", "patient-2", "patient-3", "patient-4"].map((patientId) => ({ patientId }))
    };
    const tx = {
      familyPolicy: {
        create: jest.fn().mockResolvedValue({ id: "policy-1", policyNumber: "POL-2026-000001" })
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      ...basePrisma(familyProduct),
      familyGroupMember: {
        findMany: jest.fn().mockResolvedValue(
          ["patient-1", "patient-2", "patient-3", "patient-4"].map((patientId, index) => ({
            id: `member-${index + 1}`,
            patientId,
            relationship: index === 0 ? null : "Familiar"
          }))
        )
      },
      familyPolicy: { findFirst: jest.fn().mockResolvedValue(finalPolicy) },
      $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const service = makeService(prisma);

    const result = await service.createDraft(
      actor,
      createDto(["patient-1", "patient-2", "patient-3", "patient-4"])
    );

    expect(result.policyNumber).toBe("POL-2026-000001");
    expect(tx.familyPolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          holderPatientId: "patient-1",
          members: {
            create: expect.arrayContaining([
              expect.objectContaining({ patientId: "patient-1", memberRole: "HOLDER" }),
              expect.objectContaining({ patientId: "patient-4", memberRole: "BENEFICIARY" })
            ])
          }
        })
      })
    );
  });

  it("does not activate or charge a dual policy with only its holder", async () => {
    const payments = { createPayment: jest.fn() };
    const prisma = {
      familyPolicy: {
        findFirst: jest.fn().mockResolvedValue({
          id: "policy-1",
          status: FamilyPolicyStatus.DRAFT,
          effectiveFrom: new Date("2026-08-01"),
          effectiveUntil: new Date("2027-08-01"),
          holderPatientId: "patient-1",
          branchId: "branch-1",
          policyProduct: product(2, 2),
          members: [{ patientId: "patient-1" }]
        })
      }
    };
    const service = makeService(prisma, payments);

    await expect(
      service.registerPayment(actor, "policy-1", {
        paymentMethodId: "cash-1",
        amount: 1000,
        idempotencyKey: "policy-payment-1"
      })
    ).rejects.toThrow("mínimo 2 integrantes");
    expect(payments.createPayment).not.toHaveBeenCalled();
  });

  it("rejects direct member replacement on an active policy", async () => {
    const prisma = {
      familyPolicy: {
        findFirst: jest.fn().mockResolvedValue({
          id: "policy-1",
          status: FamilyPolicyStatus.ACTIVE,
          policyProduct: product(3, 4),
          members: []
        })
      }
    };
    const service = makeService(prisma);

    await expect(
      service.replaceMembers(actor, "policy-1", { memberPatientIds: ["patient-1"] })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
