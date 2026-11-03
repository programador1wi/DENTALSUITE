import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const user = {
  id: "user-api-admin",
  organizationId: "org-1",
  organization: { id: "org-1", name: "Clinica E2E" },
  email: "api-admin@example.test",
  firstName: "Admin",
  lastName: "API",
  roleIds: ["role-1"],
  roleNames: ["ADMIN"],
  permissions: ["settings.read", "developer_api.credentials.read", "developer_api.credentials.manage"],
  branchIds: ["branch-1"],
  branches: [{ id: "branch-1", name: "Centro", isPrimary: true }]
};

test("creates a restricted credential and reveals its masked secret only once", async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/auth/refresh")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user, accessToken: "e2e-access-token" })
      });
    }
    if (pathname.endsWith("/auth/me")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
    }
    if (pathname.endsWith("/options")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          scopes: [
            { value: "patients:read", label: "Consultar pacientes", description: "Lectura de pacientes" },
            { value: "appointments:write", label: "Crear citas", description: "Creacion de citas" }
          ],
          branches: [{ id: "branch-1", name: "Centro" }],
          plan: "STANDARD",
          requestsPerMinute: 60
        })
      });
    }
    if (pathname.endsWith("/settings/api-keys") && request.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } })
      });
    }
    if (!pathname.endsWith("/settings/api-keys") || request.method() !== "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    const payload = request.postDataJSON();
    expect(payload).toMatchObject({
      name: "Agenda E2E",
      scopes: ["patients:read"],
      branchScope: "SELECTED",
      branchIds: ["branch-1"],
      networkScope: "ALLOWLIST",
      allowedIps: ["203.0.113.10"],
      expiresInDays: 90
    });
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        shownOnce: true,
        secret: "dsk_live_e2eSecretValueThatIsNeverPersisted",
        credential: {
          id: "credential-1",
          name: payload.name,
          keyPrefix: "dsk_live_e2eSecre…",
          scopes: payload.scopes,
          status: "ACTIVE",
          branchScope: payload.branchScope,
          branchIds: payload.branchIds,
          networkScope: payload.networkScope,
          allowedIps: payload.allowedIps,
          expiresAt: "2026-11-26T00:00:00.000Z",
          rotationEndsAt: null,
          lastUsedAt: null,
          lastUsedIp: null,
          revokedAt: null,
          createdAt: "2026-08-28T00:00:00.000Z",
          updatedAt: "2026-08-28T00:00:00.000Z"
        }
      })
    });
  });

  await page.goto("/configuracion/credenciales-api");
  await expect(page.getByRole("heading", { name: "Integraciones API" })).toBeVisible();
  await page.getByRole("button", { name: "Nueva credencial" }).click();

  await expect(page.getByRole("heading", { name: "Permisos del token" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  await expect(page.getByText("0 de 2 seleccionados")).toBeVisible();
  await expect(page.getByText("Marcar todos los permisos")).toHaveCount(0);
  const formAccessibility = await new AxeBuilder({ page }).analyze();
  expect(formAccessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

  await page.getByLabel("Nombre").fill("Agenda E2E");
  await page.getByText("Consultar pacientes", { exact: true }).click();
  await expect(page.getByText("1 de 2 seleccionados")).toBeVisible();
  await page.getByText("Seleccionadas", { exact: true }).click();
  await page.getByText("Centro", { exact: true }).click();
  await page.getByText("Lista permitida", { exact: true }).click();
  await page.getByLabel("IPv4 o IPv6, una por linea").fill("203.0.113.10");
  await page.getByRole("button", { name: "Generar credencial" }).click();

  const secret = page.getByLabel("Secreto para Agenda E2E");
  await expect(page.getByRole("heading", { name: "Guarda el secreto de la credencial" })).toBeVisible();
  await expect(secret).toHaveAttribute("type", "password");
  await expect(secret).toHaveValue("dsk_live_e2eSecretValueThatIsNeverPersisted");
  const storageContainsSecret = await page.evaluate(() => Object.values(localStorage).some((value) => value.includes("dsk_live_")));
  expect(storageContainsSecret).toBe(false);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});
