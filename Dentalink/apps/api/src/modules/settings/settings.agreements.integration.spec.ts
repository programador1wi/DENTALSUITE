import type { AuthUser } from "../../common/types/auth-user";
import { SettingsController } from "./settings.controller";

describe("SettingsController agreement endpoint integration", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1"],
    permissions: ["agreements.read", "agreements.publish"]
  };

  it("forwards the pre-publication price preview query unchanged", async () => {
    const settingsService = { previewAgreementPrice: jest.fn().mockResolvedValue({ patientTotal: 100 }) };
    const controller = new SettingsController(settingsService as never);

    await expect(
      controller.previewAgreementPrice(actor, "agreement-1", {
        branchId: "branch-1",
        procedureId: "procedure-1",
        quantity: 2
      })
    ).resolves.toEqual({ patientTotal: 100 });
    expect(settingsService.previewAgreementPrice).toHaveBeenCalledWith(actor, "agreement-1", {
      branchId: "branch-1",
      procedureId: "procedure-1",
      quantity: 2
    });
  });

  it("forwards the selected immutable version on publish", async () => {
    const settingsService = {
      publishAgreement: jest.fn().mockResolvedValue({ id: "agreement-1", version: 3 })
    };
    const controller = new SettingsController(settingsService as never);

    await controller.publishAgreement(actor, "agreement-1", { version: 3 });
    expect(settingsService.publishAgreement).toHaveBeenCalledWith(actor, "agreement-1", 3);
  });
});
