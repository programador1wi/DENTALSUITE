import { expect, test } from "@playwright/test";
import { hasCredentials } from "./route-contract";

const reportTypes = [
  "results",
  "money-flow",
  "patient-analysis",
  "expenses",
  "professional-efficiency",
  "sales-by-procedure",
  "sales-by-category",
  "budget-capture-efficiency",
  "daily-collection",
  "professional-ranking",
  "delinquent-patients",
  "financing-status",
  "payroll-discount-status",
  "patient-referrals",
  "captured-budgets"
] as const;

test.describe("graphical reports contract", () => {
  test.skip(!hasCredentials, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD for private reports.");

  test("keeps exactly 15 options, query state and responsive containment", async ({ page }) => {
    const initialReport = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/reports/charts/results/generate")
    );
    await page.goto("/reportes/graficos?reporte=results");
    expect((await initialReport).ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Reportes gráficos" })).toBeVisible();
    await expect(page.getByText("Período actual")).toBeVisible();
    await expect(page.getByText("Genera el reporte")).toHaveCount(0);
    const selector = page.getByLabel("Otros gráficos");
    await expect(selector.locator("option")).toHaveCount(15);

    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: width < 640 ? 844 : 1000 });
      const overflow = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth
      }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
    }

    for (const type of reportTypes.filter((item) => item !== "patient-analysis")) {
      if (type === "results") continue;
      const generated = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes(`/reports/charts/${type}/generate`)
      );
      await selector.selectOption(type);
      await expect(page).toHaveURL(new RegExp(`reporte=${type}`));
      expect((await generated).ok()).toBe(true);
      await expect(page.getByText("Período actual")).toBeVisible();
    }

    await selector.selectOption("patient-analysis");
    await expect(page).toHaveURL(/\/pacientes\/analisis/);
  });
});
