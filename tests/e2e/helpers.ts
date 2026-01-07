import { expect, type Page } from "@playwright/test";

// The server is started with nothing at the GitHub bot's snapshot address
// (see playwright.config.ts), so every test reads the recorded copy: the same
// 54 runs, the newest first.

/** A full audit that ran on its own: five phases, four calls, one of them refused. */
export const AUDIT_PATH = "/runs/github-bot%3Aaudit-0721cc42cb";

/** An audit whose calls were logged after the fact, so two of them are cut at the start of the run. */
export const CUT_AUDIT_PATH = "/runs/github-bot%3Aaudit-de93568290";

export const runsTable = (page: Page) => page.getByRole("table", { name: "Runs, newest first" });
export const timeline = (page: Page) => page.getByRole("list", { name: "What happened, in order" });
export const detail = (page: Page) => page.getByRole("complementary", { name: "Selected span" });

/** Opens the list and waits until the runs have been read. */
export async function openRuns(page: Page, query = "") {
  await page.goto(`/${query}`);
  await expect(runsTable(page)).toBeVisible();
}

/** Opens one run and waits for its timeline. */
export async function openRun(page: Page, path: string) {
  await page.goto(path);
  await expect(timeline(page)).toBeVisible();
}
