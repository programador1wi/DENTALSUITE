import { expect, test } from "@playwright/test";

const actor = {
  id: "admin-1",
  organizationId: "org-1",
  organization: { id: "org-1", name: "Clínica de prueba" },
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "Prueba",
  roleIds: ["role-admin"],
  roleNames: ["Administrador"],
  permissions: ["users.read", "roles.read", "roles.create", "permissions.read"],
  branchIds: ["branch-1"],
  branches: [{ id: "branch-1", name: "Sucursal de prueba", isPrimary: true }]
};

const permissions = [
  {
    id: "patients-read",
    key: "patients.read",
    code: "patients.read",
    name: "Read patients",
    module: "patients",
    isActive: true,
    label: "Ver pacientes",
    businessGroup: "Pacientes",
    presentationTier: "BASIC",
    delegable: true
  },
  {
    id: "patients-deactivate",
    key: "patients.deactivate",
    code: "patients.deactivate",
    name: "Deactivate patients",
    module: "patients",
    isActive: true,
    label: "Desactivar pacientes",
    businessGroup: "Pacientes",
    presentationTier: "ADVANCED",
    delegable: false
  },
  {
    id: "manage-all",
    key: "system.manage_all",
    code: "system.manage_all",
    name: "Manage all",
    module: "system",
    isActive: true,
    label: "Administración total",
    businessGroup: "Administración",
    presentationTier: "INTERNAL",
    delegable: false
  }
];

test("role editor separates usual, advanced and protected permissions", async ({ page }) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(actor) })
  );
  await page.route("**/api/v1/roles**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/permissions**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(permissions) })
  );
  await page.addInitScript((persistedUser) => {
    window.localStorage.setItem(
      "dentalwarner-auth",
      JSON.stringify({ state: { user: persistedUser, accessToken: "token", refreshToken: "refresh" }, version: 0 })
    );
  }, actor);

  await page.goto("/configuracion/usuarios/perfiles");
  await page.getByRole("button", { name: "Nuevo perfil" }).click();

  await expect(page.getByText("Ver pacientes")).toBeVisible();
  await expect(page.getByText("Desactivar pacientes")).toBeHidden();
  await expect(page.getByText("Administración total")).toBeHidden();

  await page.getByRole("button", { name: "Mostrar avanzadas" }).click();
  await expect(page.getByText("Desactivar pacientes")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Desactivar pacientes" })).toBeDisabled();
  await expect(page.getByText("Administración total")).toBeHidden();
});
