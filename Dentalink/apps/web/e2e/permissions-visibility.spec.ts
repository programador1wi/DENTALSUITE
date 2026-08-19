import { expect, test } from "@playwright/test";

const staleUser = {
  id: "user-1",
  organizationId: "org-1",
  organization: { id: "org-1", name: "Clinica de prueba" },
  email: "user@example.com",
  firstName: "Usuario",
  lastName: "Prueba",
  roleIds: ["role-1"],
  roleNames: ["ROL_ANTERIOR"],
  permissions: ["settings.read", "branches.read", "procedures.read", "price_lists.read"],
  branchIds: ["branch-1"],
  branches: [{ id: "branch-1", name: "Sucursal de prueba", isPrimary: true }]
};

const currentUser = {
  ...staleUser,
  roleNames: ["ROL_RESTRINGIDO"],
  permissions: []
};

test("stale permissions never mount a forbidden direct route", async ({ page }) => {
  const forbiddenRequests: string[] = [];

  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentUser)
    });
  });

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      pathname.endsWith("/settings/organization") ||
      pathname.endsWith("/branches") ||
      pathname.endsWith("/settings/agreements") ||
      pathname.endsWith("/procedures")
    ) {
      forbiddenRequests.push(pathname);
    }
  });

  await page.addInitScript((persistedUser) => {
    window.localStorage.setItem(
      "dentalwarner-auth",
      JSON.stringify({
        state: {
          user: persistedUser,
          accessToken: "stale-access-token",
          refreshToken: "stale-refresh-token"
        },
        version: 0
      })
    );
  }, staleUser);

  await page.goto("/configuracion/convenios");

  await expect(page).toHaveURL(/\/configuracion\/perfil$/);
  await expect(page.getByRole("heading", { name: "Mi Perfil" })).toBeVisible();
  await expect(page.getByText("No tienes permiso para acceder a esa pantalla.")).toBeVisible();
  expect(forbiddenRequests).toEqual([]);
});
