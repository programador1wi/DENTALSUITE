import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hasCredentials, visitRoute } from "./route-contract";

const routes = ["/login", "/agenda/list"];

for (const route of routes) {
  test(`${route} has no serious accessibility violations`, async ({ page }) => {
    test.skip(route !== "/login" && !hasCredentials, "Set E2E credentials for private accessibility checks.");
    expect(await visitRoute(page, route)).toBe(true);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""));
    if (blocking.length) {
      console.error(blocking.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.map((node) => node.target.join(" "))
      })));
    }
    expect(blocking).toEqual([]);
  });
}
