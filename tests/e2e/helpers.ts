import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

// The server is started with nothing at the GitHub bot's snapshot address
// (see playwright.config.ts), so every test reads the recorded copy: the same
// 54 runs of the bot, the newest first, and the same 17 recorded runs of the
// other three apps.

/** A full audit that ran on its own: five phases, four calls, one of them refused. */
export const AUDIT_PATH = "/runs/github-bot%3Aaudit-0721cc42cb";

/** An audit whose calls were logged after the fact, so two of them are cut at the start of the run. */
export const CUT_AUDIT_PATH = "/runs/github-bot%3Aaudit-de93568290";

type Envelope = { format: string; version: number; app: string; data: Record<string, unknown> };
type Recorded = { runs: { label: string; envelope: Envelope }[] };

/** What an app's button handed over when the recorder pressed it. */
export function recorded(file: "sayso" | "flowboard" | "agent-desk", label?: string): Envelope {
  const { runs } = JSON.parse(readFileSync(`src/samples/${file}.json`, "utf8")) as Recorded;
  const found = label ? runs.find((run) => run.label === label) : runs[0];
  if (!found) throw new Error(`No recording called "${label}" in ${file}.`);
  return found.envelope;
}

const SAYSO_SEAT = recorded("sayso", "a window seat, paid for");
const FLOWBOARD_HOT = recorded("flowboard", "heat check, hot day");
const DESK_AUDIT = recorded("agent-desk");

export const SAYSO_ID = `sayso:${SAYSO_SEAT.data.id}`;
export const SAYSO_PATH = `/runs/${encodeURIComponent(SAYSO_ID)}`;
export const SAYSO_TITLE = "a window seat on my London flight";
export const FLOWBOARD_PATH = `/runs/${encodeURIComponent(`flowboard:${(FLOWBOARD_HOT.data.run as { startedAt: number }).startedAt}`)}`;
export const DESK_PATH = `/runs/${encodeURIComponent(`agent-desk:${(DESK_AUDIT.data.run as { run_id: string }).run_id}`)}`;

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
