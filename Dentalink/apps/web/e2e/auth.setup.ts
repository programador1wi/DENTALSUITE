import { expect, test as setup } from "@playwright/test";

const authenticatedState = "test-results/.auth/user.json";

setup("authenticate once for private route contracts", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  setup.skip(!email || !password, "Set E2E credentials for authenticated route checks.");

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email ?? "");
  await page.locator('input[type="password"]').fill(password ?? "");
  await page.getByRole("button", { name: /Entrar al sistema|Autenticando/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 30_000 });
  await page.context().storageState({ path: authenticatedState });
});
