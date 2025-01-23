import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { AUDIT_PATH, CUT_AUDIT_PATH, detail, openRun, openRuns, timeline } from "./helpers";

// Every page is scanned in both themes: colours that pass in one often fail
// in the other. The scans read the page as it is, with no rules switched off.

async function violations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  return result.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    where: violation.nodes.map((node) => node.target.join(" ")).slice(0, 4),
  }));
}

async function useTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((value) => localStorage.setItem("hindsight:theme", value), theme);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await useTheme(page, theme);
    });

    test("the list of runs has no accessibility violations", async ({ page }) => {
      await openRuns(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(await violations(page)).toEqual([]);
    });

    test("the list with filters on has none", async ({ page }) => {
      await openRuns(page, "?agent=patch&status=ok&q=audit");
      expect(await violations(page)).toEqual([]);
    });

    test("a run with its timeline has none", async ({ page }) => {
      await openRun(page, AUDIT_PATH);
      expect(await violations(page)).toEqual([]);
    });

    test("a run with a bar chosen, and its tooltip showing, has none", async ({ page }) => {
      await openRun(page, CUT_AUDIT_PATH);
      const bar = timeline(page).getByRole("button", { name: /^GET \/user\/repos\. API call/ });
      await bar.click();
      await expect(detail(page)).toContainText("began 200 ms before the run was recorded");
      await expect(page.getByRole("tooltip").first()).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("a run with a crowd of marks listed has none", async ({ page }) => {
      await openRun(page, AUDIT_PATH);
      await timeline(page).getByRole("button", { name: /^49 things happened close together/ }).click();
      await expect(detail(page)).toContainText("49 close together");
      expect(await violations(page)).toEqual([]);
    });

    test("the page for a run that does not exist has none", async ({ page }) => {
      await page.goto("/runs/github-bot%3Anot-a-run");
      await expect(page.getByRole("heading", { name: "There is no run with this address" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  });
}

test("the list and a run work at phone width, with nothing wider than the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openRuns(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await violations(page)).toEqual([]);

  await openRun(page, AUDIT_PATH);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await violations(page)).toEqual([]);
});
