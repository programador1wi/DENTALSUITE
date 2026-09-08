import { authStoreApi } from "./auth.store";

describe("authStore", () => {
  beforeEach(() => {
    localStorage.clear();
    authStoreApi.setState({ user: null, accessToken: null, isSessionInitialized: false });
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
      accessToken: "access"
    });

    expect(authStoreApi.getState().accessToken).toBe("access");
    expect(authStoreApi.getState().hasPermission("patients.read")).toBe(true);
    expect(localStorage.getItem("dentalwarner-auth")).toBeNull();

    authStoreApi.getState().clearSession();
    expect(authStoreApi.getState().accessToken).toBeNull();
    expect(authStoreApi.getState().hasPermission("patients.read")).toBe(false);
  });

  it("allows system administrators through permission gates", () => {
    authStoreApi.getState().setSession({
      user: {
        id: "u1",
        organizationId: "o1",
        email: "admin@clinic.com",
        firstName: "Admin",
        lastName: "User",
        roleIds: ["r1"],
        roleNames: ["SUPER_ADMIN"],
        permissions: ["organization.manage_all"],
        branchIds: ["b1"]
      },
      accessToken: "access"
    });

    expect(authStoreApi.getState().hasPermission("integrations.communications.read")).toBe(true);
  });
});
