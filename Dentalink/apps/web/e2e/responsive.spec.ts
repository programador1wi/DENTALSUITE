import { expect, test } from "@playwright/test";
import {
  hasCredentials,
  isPublicRoute,
  responsiveWidths,
  routeVisualContracts,
  visitRoute,
  visualWidths
} from "./route-contract";

const routes = routeVisualContracts();

test.describe("responsive route contract", () => {
  for (const contract of routes) {
    test(`${contract.id} stays inside the viewport`, async ({ page }, testInfo) => {
      test.skip(!contract.resolvedRoute, `Missing route fixtures: ${contract.requiredFixtures?.join(", ") ?? "unknown"}.`);
      test.skip(!isPublicRoute(contract.route) && !hasCredentials, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD for private routes.");

      const initialWidth = responsiveWidths[0];
      await page.setViewportSize({ width: initialWidth, height: 844 });
      const visited = await visitRoute(page, contract);
      expect(visited).toBe(true);

      for (const width of responsiveWidths) {
        await page.setViewportSize({ width, height: width < 640 ? 844 : 1000 });
        await page.evaluate(() => new Promise<void>((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))));

        const overflow = await page.evaluate(() => {
          const clientWidth = document.documentElement.clientWidth;
          const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
            .filter((element) => {
              const style = window.getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                style.opacity !== "0" &&
                rect.width > 0 &&
                !element.closest('[data-responsive-overflow="contained"]') &&
                (rect.left < -1 || rect.right > clientWidth + 1)
              );
            })
            .slice(0, 10)
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                tag: element.tagName,
                className: element.className.toString().slice(0, 160),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width)
              };
            });

          return {
            clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            offenders
          };
        });
        expect(
          overflow.scrollWidth,
          `${contract.route} overflows at ${width}px\n${JSON.stringify(overflow.offenders, null, 2)}`
        ).toBeLessThanOrEqual(overflow.clientWidth + 1);

        const escapedControls = await page.locator("button, a, input, select, textarea").evaluateAll((elements) =>
          elements
            .filter((element) => {
              const style = window.getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                style.opacity !== "0" &&
                rect.width > 0 &&
                rect.height > 0 &&
                !element.closest('[data-responsive-overflow="contained"]') &&
                (rect.left < -1 || rect.right > document.documentElement.clientWidth + 1)
              );
            })
            .slice(0, 10)
            .map((element) => ({ tag: element.tagName, label: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 80) }))
        );
        expect(escapedControls, `${contract.route} has controls outside ${width}px`).toEqual([]);

        const wrappedControls = await page.locator('button, a, [role="button"], [role="tab"], [role="columnheader"]').evaluateAll((elements) =>
          elements
            .filter((element) => {
              if (element.closest('[data-allow-multiline], [data-responsive-overflow="contained"]')) return false;
              const node = element as HTMLElement;
              const rect = node.getBoundingClientRect();
              if (!node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || rect.width <= 0 || rect.height <= 0) return false;
              const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
              const lineTops: number[] = [];
              let textNode = walker.nextNode();
              while (textNode) {
                if (textNode.textContent?.trim()) {
                  const range = document.createRange();
                  range.selectNodeContents(textNode);
                  for (const textRect of range.getClientRects()) {
                    if (textRect.width > 0.5 && textRect.height > 0.5) lineTops.push(textRect.top);
                  }
                }
                textNode = walker.nextNode();
              }
              return lineTops.length > 1 && Math.max(...lineTops) - Math.min(...lineTops) > 8;
            })
            .slice(0, 10)
            .map((element) => ({ tag: element.tagName, label: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 80) }))
        );
        expect(wrappedControls, `${contract.route} has wrapped controls at ${width}px`).toEqual([]);

        const inaccessibleTruncation = await page.locator("body *").evaluateAll((elements) =>
          elements
            .filter((element) => {
              const node = element as HTMLElement;
              const style = getComputedStyle(node);
              if (!node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
              const rect = node.getBoundingClientRect();
              if (rect.right <= 0 || rect.left >= document.documentElement.clientWidth || rect.bottom <= 0 || rect.top >= window.innerHeight) return false;
              const isTruncated = style.textOverflow === "ellipsis" && node.scrollWidth > node.clientWidth + 1;
              const hasFullName = Boolean(node.getAttribute("title") || node.getAttribute("aria-label") || node.getAttribute("aria-describedby"));
              return isTruncated && !hasFullName;
            })
            .slice(0, 10)
            .map((element) => ({ tag: element.tagName, text: element.textContent?.trim().slice(0, 80) }))
        );
        expect(inaccessibleTruncation, `${contract.route} truncates content without a full accessible value at ${width}px`).toEqual([]);

        if (contract.route === "/agenda/list" && width >= 1280) {
          const agendaColumns = await page.locator("thead th").evaluateAll((headers) => headers.map((header) => Math.round(header.getBoundingClientRect().width)));
          const minimums = [72, 180, 140, 180, 120, 120, 130];
          expect(agendaColumns).toHaveLength(minimums.length);
          agendaColumns.forEach((columnWidth, index) => {
            expect(columnWidth, `Agenda column ${index + 1} is below its ${minimums[index]}px contract`).toBeGreaterThanOrEqual(minimums[index]);
          });
        }

        if (visualWidths.has(width) && process.env.E2E_VISUAL_BASELINES === "1") {
          await expect(page).toHaveScreenshot(`${contract.route.replaceAll("/", "-") || "home"}-${width}.png`, {
            fullPage: true,
            animations: "disabled"
          });
        }
      }

      await testInfo.attach("route-contract", {
        body: JSON.stringify({ route: contract.route, resolvedRoute: contract.resolvedRoute, widths: responsiveWidths }, null, 2),
        contentType: "application/json"
      });
    });
  }
});
