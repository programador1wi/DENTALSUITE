import { authStoreApi } from "./auth.store";

describe("authStore", () => {
  beforeEach(() => {
    localStorage.clear();
    authStoreApi.setState({ user: null, accessToken: null, refreshToken: null });
  });

  it("stores and clears session", () => {
    authStoreApi.getState().setSession({
      user: {
        id: "u1",
        organizationId: "o1",
        email: "admin@clinic.com",
        firstName: "Admin",
        lastName: "User",
        roleIds: ["r1"],
        roleNames: ["ADMIN"],
        permissions: ["patients.read"],
        branchIds: ["b1"]
      },
      accessToken: "access",
      refreshToken: "refresh"
    });

    expect(authStoreApi.getState().accessToken).toBe("access");
    expect(authStoreApi.getState().hasPermission("patients.read")).toBe(true);

    authStoreApi.getState().clearSession();
    expect(authStoreApi.getState().accessToken).toBeNull();
    expect(authStoreApi.getState().hasPermission("patients.read")).toBe(false);
  });
});
