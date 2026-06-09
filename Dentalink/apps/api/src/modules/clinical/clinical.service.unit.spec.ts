import { BadRequestException } from "@nestjs/common";
import { ProfessionalBranchStatus } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { ClinicalService } from "./clinical.service";

describe("ClinicalService professional branch validation", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1"],
    permissions: []
  };

  it("rejects clinical records with a professional outside the patient branch", async () => {
    const prisma = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" })
      },
      professional: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    };
    const service = new ClinicalService(prisma as never);

    await expect(
      service.createEvolution(actor, "patient-1", {
        professionalId: "professional-2"
      } as never)
    ).rejects.toThrow(BadRequestException);

    expect(prisma.professional.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "professional-2",
          organizationId: "org-1",
          isActive: true,
          branches: {
            some: expect.objectContaining({
              branchId: "branch-1",
              status: ProfessionalBranchStatus.ACTIVE
            })
          }
        })
      })
    );
  });
});
