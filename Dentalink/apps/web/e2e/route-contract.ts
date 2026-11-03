import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

export const responsiveWidths = [320, 360, 375, 390, 412, 480, 640, 768, 820, 1024, 1280, 1366, 1440, 1920, 2560] as const;
export const visualWidths = new Set([320, 768, 1024, 1366, 1920]);

export type RouteVisualContract = {
  id: string;
  route: string;
  resolvedRoute?: string;
  requiredFixtures?: string[];
  readySelector?: string;
  containedOverflowSelectors?: string[];
};

const publicPrefixes = [
  "/login",
  "/iniciar-sesion",
  "/book/",
  "/agendar/",
  "/confirm-appointment",
  "/confirmar-cita",
  "/complete-patient-profile",
  "/completar-perfil",
  "/mobile/photographic-upload/",
  "/public/surveys/respond/"
];

const dynamicRoutes: Array<{ route: string; fixtures: Record<string, string> }> = [
  { route: "/book/:slug", fixtures: { slug: "E2E_BOOKING_SLUG" } },
  { route: "/agendar/:slug", fixtures: { slug: "E2E_BOOKING_SLUG" } },
  { route: "/cash-register/:registerNumber", fixtures: { registerNumber: "E2E_REGISTER_NUMBER" } },
  { route: "/cajas/:registerNumber", fixtures: { registerNumber: "E2E_REGISTER_NUMBER" } },
  { route: "/collections/:id", fixtures: { id: "E2E_COLLECTION_ID" } },
  { route: "/cobranza/:id", fixtures: { id: "E2E_COLLECTION_ID" } },
  { route: "/crm/email-marketing/reports/:reportCode", fixtures: { reportCode: "E2E_REPORT_CODE" } },
  { route: "/crm/email-marketing/reports/:reportCode/campaign", fixtures: { reportCode: "E2E_REPORT_CODE" } },
  { route: "/crm/surveys/:surveyId/edit", fixtures: { surveyId: "E2E_SURVEY_ID" } },
  { route: "/mobile/photographic-upload/:token", fixtures: { token: "E2E_UPLOAD_TOKEN" } },
  { route: "/payments/:paymentNumber/receipt", fixtures: { paymentNumber: "E2E_PAYMENT_NUMBER" } },
  { route: "/pagos/:paymentNumber/comprobante", fixtures: { paymentNumber: "E2E_PAYMENT_NUMBER" } },
  { route: "/public/surveys/respond/:token", fixtures: { token: "E2E_SURVEY_TOKEN" } },
  { route: "/settings/price-lists/categories/:categoryId", fixtures: { categoryId: "E2E_PRICE_LIST_CATEGORY_ID" } },
  { route: "/configuracion/listas-precios/categories/:categoryId", fixtures: { categoryId: "E2E_PRICE_LIST_CATEGORY_ID" } },
  { route: "/configuracion/listas-precios/categorias/:categoryId", fixtures: { categoryId: "E2E_PRICE_LIST_CATEGORY_ID" } },
  { route: "/settings/roles/:id", fixtures: { id: "E2E_ROLE_ID" } },
  { route: "/configuracion/roles/:id", fixtures: { id: "E2E_ROLE_ID" } }
];

const patientRoutes = [
  "/patients/:id",
  "/patients/:id/appointments",
  "/patients/:id/billing",
  "/patients/:id/billing/payments",
  "/patients/:id/billing/documents",
  "/patients/:id/billing/coverage",
  "/patients/:id/billing/coverages/reimbursements",
  "/patients/:id/billing/coverages/online-benefits",
  "/patients/:id/billing/refunds",
  "/patients/:id/billing/deleted",
  "/patients/:id/billing/voided-payments",
  "/patients/:id/billing/balance",
  "/patients/:id/clinical",
  "/patients/:id/clinical/consents",
  "/patients/:id/clinical/documents",
  "/patients/:id/clinical/evolutions",
  "/patients/:id/clinical/files",
  "/patients/:id/clinical/history",
  "/patients/:id/clinical/medical-history",
  "/patients/:id/clinical/odontogram",
  "/patients/:id/clinical/periodontogram",
  "/patients/:id/clinical/prescriptions",
  "/patients/:id/consents",
  "/patients/:id/crm",
  "/patients/:id/files",
  "/patients/:id/payments",
  "/patients/:id/payments/daily-receipt",
  "/patients/:id/profile",
  "/patients/:id/profile/appointments",
  "/patients/:id/profile/benefits-coverages",
  "/patients/:id/profile/comments",
  "/patients/:id/profile/emails",
  "/patients/:id/profile/tasks",
  "/patients/:id/treatments",
  "/patients/:id/treatments/new"
];

function staticRoutes() {
  const router = readFileSync(resolve(process.cwd(), "src/app/routes/router.tsx"), "utf8");
  const routes = Array.from(router.matchAll(/\bpath:\s*["']([^"']+)["']/g), (match) => match[1]);
  return [...new Set(routes)].filter((route) => route.startsWith("/") && route !== "*" && !route.includes(":"));
}

function resolveFixtureRoute(route: string, fixtures: Record<string, string>) {
  const requiredFixtures = Object.values(fixtures);
  const missing = requiredFixtures.filter((name) => !process.env[name]);
  if (missing.length) return { requiredFixtures: missing };
  const resolvedRoute = Object.entries(fixtures).reduce(
    (path, [parameter, environmentName]) => path.replace(`:${parameter}`, encodeURIComponent(process.env[environmentName] ?? "")),
    route
  );
  return { requiredFixtures, resolvedRoute };
}

export function routeVisualContracts(): RouteVisualContract[] {
  const contracts: RouteVisualContract[] = staticRoutes().map((route) => ({ id: route, route, resolvedRoute: route }));
  contracts.push(
    { id: "/crm/tasks/statistics", route: "/crm/tasks/statistics", resolvedRoute: "/crm/tasks/statistics" },
    { id: "/crm/tasks/configuration", route: "/crm/tasks/configuration", resolvedRoute: "/crm/tasks/configuration" }
  );

  for (const item of dynamicRoutes) {
    contracts.push({ id: item.route, route: item.route, ...resolveFixtureRoute(item.route, item.fixtures) });
  }
  for (const route of patientRoutes) {
    contracts.push({
      id: route,
      route,
      containedOverflowSelectors: route.endsWith("/odontogram") || route.endsWith("/periodontogram")
        ? ['[data-responsive-overflow="contained"]']
        : undefined,
      ...resolveFixtureRoute(route, { id: "E2E_PATIENT_ID" })
    });
  }

  return [...new Map(contracts.map((contract) => [contract.id, contract])).values()];
}

export function isPublicRoute(route: string) {
  return publicPrefixes.some((prefix) => route === prefix || route.startsWith(prefix));
}

export const hasCredentials = Boolean(process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD);

export async function authenticate(page: Page) {
  if (!hasCredentials) return false;
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(process.env.E2E_USER_EMAIL ?? "");
  await page.locator('input[type="password"]').fill(process.env.E2E_USER_PASSWORD ?? "");
  await page.getByRole("button", { name: /Entrar al sistema|Autenticando/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return true;
}

async function waitForStableRoute(page: Page, readySelector?: string) {
  await page.locator("body").waitFor({ state: "visible" });
  // Allow React, lazy routes and query boundaries to mount before checking for absence.
  await page.waitForTimeout(250);
  await page.locator('[aria-label="Cargando módulo"]').waitFor({ state: "detached", timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(100);
  await page.waitForFunction(() => {
    const loading = Array.from(document.querySelectorAll<HTMLElement>('[role="status"]')).some((element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && /cargando|loading/i.test(element.textContent ?? element.getAttribute("aria-label") ?? "");
    });
    return !loading;
  }, undefined, { timeout: 30_000 });
  if (readySelector) await page.locator(readySelector).first().waitFor({ state: "visible" });
  await page.evaluate(() => new Promise<void>((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))));
}

export async function visitRoute(page: Page, contractOrRoute: RouteVisualContract | string) {
  const contract = typeof contractOrRoute === "string"
    ? { id: contractOrRoute, route: contractOrRoute, resolvedRoute: contractOrRoute }
    : contractOrRoute;
  if (!contract.resolvedRoute) return false;
  const isAuthPath = (path: string) => path === "/login" || path === "/iniciar-sesion";
  if (contract.route === "/login" || contract.route === "/iniciar-sesion") {
    await page.context().clearCookies();
    await page.goto(contract.resolvedRoute, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
  await page.goto(contract.resolvedRoute, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  if (!isPublicRoute(contract.route) && isAuthPath(new URL(page.url()).pathname)) {
    const authenticated = await authenticate(page);
    if (!authenticated) return false;
    await page.goto(contract.resolvedRoute, { waitUntil: "domcontentloaded" });
  }
  await waitForStableRoute(page, contract.readySelector);
  if (!isPublicRoute(contract.route) && isAuthPath(new URL(page.url()).pathname)) {
    const authenticated = await authenticate(page);
    if (!authenticated) return false;
    await page.goto(contract.resolvedRoute, { waitUntil: "domcontentloaded" });
    await waitForStableRoute(page, contract.readySelector);
  }
  if (!isPublicRoute(contract.route)) {
    expect(isAuthPath(new URL(page.url()).pathname), `${contract.route} redirected away before responsive assertions`).toBe(false);
  }
  await expect(page.locator("[data-route-error]"), `${contract.route} reached the application route boundary`).toHaveCount(0);
  await expect(page.getByText(/Unexpected Application Error|Hey developer/i), `${contract.route} reached React Router's default boundary`).toHaveCount(0);
  return true;
}
