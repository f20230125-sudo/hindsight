import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { AUDIT_PATH, CUT_AUDIT_PATH, DESK_PATH, FLOWBOARD_PATH, SAYSO_PATH, detail, openRun, openRuns, recorded, timeline } from "./helpers";

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

    test("a run in agent time, zoomed in on a call that is chosen, has none", async ({ page }) => {
      await openRun(page, `${SAYSO_PATH}?time=agent`);
      await timeline(page).getByRole("button", { name: /^POST \/api\/quotes\. API call/ }).click();
      await page.getByRole("button", { name: "Zoom to the chosen one" }).click();
      await expect(page.getByRole("button", { name: "Zoom out" })).toBeEnabled();
      expect(await violations(page)).toEqual([]);
    });

    test("the table view has none", async ({ page }) => {
      await openRun(page, SAYSO_PATH);
      await page.getByRole("button", { name: "Table" }).click();
      await expect(page.getByRole("table", { name: "Every bar and mark of the run, in the order they began" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the playhead, and what the person had been shown at that moment, have none", async ({ page }) => {
      await openRun(page, SAYSO_PATH);
      await page.getByRole("slider", { name: "Moment in the run" }).fill("2000");
      await expect(detail(page)).toContainText("Shown: Seat map");
      expect(await violations(page)).toEqual([]);
    });

    test("a recorded run of each of the other apps has none", async ({ page }) => {
      for (const path of [SAYSO_PATH, FLOWBOARD_PATH, DESK_PATH]) {
        await openRun(page, path);
        expect(await violations(page), path).toEqual([]);
      }
    });

    test("the overview has none", async ({ page }) => {
      await page.goto("/overview");
      await expect(page.getByText("Adding up all 71 runs.")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the overview with every chart shown as a table has none", async ({ page }) => {
      await page.goto("/overview");
      await expect(page.getByText("Adding up all 71 runs.")).toBeVisible();
      for (const button of await page.getByRole("button", { name: "table" }).all()) await button.click();
      await expect(page.getByRole("table")).toHaveCount(4);
      expect(await violations(page)).toEqual([]);
    });

    test("the overview with a column pointed at, and its tooltip showing, has none", async ({ page }) => {
      await page.goto("/overview");
      await page.getByRole("list", { name: "Runs by day" }).getByRole("listitem").nth(3).hover();
      await expect(page.getByRole("tooltip").first()).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the sources page has none", async ({ page }) => {
      await page.goto("/sources");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("How each app is connected");
      expect(await violations(page)).toEqual([]);
    });

    test("the sources page with a file taken and a file refused has none", async ({ page }) => {
      await page.goto("/sources");
      await page.locator('input[type="file"]').setInputFiles([
        { name: "good.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(recorded("sayso"))) },
        { name: "bad.json", mimeType: "application/json", buffer: Buffer.from("not json") },
      ]);
      await expect(page.getByText("bad.json was not taken.")).toBeVisible();
      await expect(page.getByRole("region", { name: "Runs sent to this browser" }).getByRole("listitem")).toHaveCount(1);
      expect(await violations(page)).toEqual([]);
    });

    test("the page an app opens, when nothing opened it, has none", async ({ page }) => {
      await page.goto("/open");
      await expect(page.getByRole("heading", { name: "This page takes a run from an app" })).toBeVisible();
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
