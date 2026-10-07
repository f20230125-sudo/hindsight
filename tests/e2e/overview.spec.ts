import { expect, test, type Page } from "@playwright/test";
import { detail, runsTable } from "./helpers";

// The overview: all the runs added up. The runs are the recorded ones, so the
// numbers are the same every time: the bot's 54 and the other apps' 17.

const chart = (page: Page, name: string) => page.getByRole("region", { name });
const open = async (page: Page, query = "") => {
  await page.goto(`/overview${query}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where the time went, across every run");
  await expect(page.getByText(/Adding up/)).not.toHaveText("Reading the runs…");
};

test("shows four charts of every run, each with its table", async ({ page }) => {
  await open(page);
  await expect(page.getByText("Adding up all 71 runs.")).toBeVisible();
  for (const name of ["Where the time goes", "Runs by day", "How long runs take", "The slowest steps"]) {
    await expect(chart(page, name)).toBeVisible();
  }
});

test.describe("where the time goes", () => {
  test("says what each app spent its time on", async ({ page }) => {
    await open(page);
    const time = chart(page, "Where the time goes");
    // In a Sayso run it is mostly a person thinking; in the bot's it is mostly calls to GitHub.
    await expect(time.getByRole("listitem").filter({ hasText: "Sayso" }).first()).toContainText(/Waiting for a person\s*9\d%/);
    await expect(time.getByRole("listitem").filter({ hasText: "GitHub bot" }).first()).toContainText(/API calls\s*9\d%/);
    await expect(time.getByText("11 runs, 40.0 s in all")).toBeVisible();
  });

  test("opens the list of that app's runs from its bar", async ({ page }) => {
    await open(page);
    await chart(page, "Where the time goes").getByRole("link", { name: /^Sayso: .* Show these runs\.$/ }).click();
    await expect(page).toHaveURL(/\/\?source=sayso$/);
    await expect(page.getByText("Showing 11 of 11")).toBeVisible();
  });

  test("is also a table, with every time written out", async ({ page }) => {
    await open(page);
    const time = chart(page, "Where the time goes");
    await time.getByRole("button", { name: "table" }).click();
    const table = time.getByRole("table", { name: "Time by what was going on, for each app" });
    await expect(table.getByRole("row")).toHaveCount(5);
    await expect(table.getByRole("row", { name: /^Sayso/ })).toContainText("11");
    await time.getByRole("button", { name: "chart" }).click();
    await expect(time.getByRole("table")).toHaveCount(0);
  });
});

test.describe("runs by day", () => {
  test("has a column for each day, and the part of a column that was chosen opens exactly those runs", async ({ page }) => {
    await open(page);
    const days = chart(page, "Runs by day");
    await expect(days.getByRole("list", { name: "Runs by day" }).getByRole("listitem")).toHaveCount(4);

    // The failed runs of the 7th: Sayso's failed call and unread words, and Flowboard's weather service being down.
    await days.getByRole("link", { name: "7 Oct 2026: 3 failed runs. Show them." }).click();
    await expect(page).toHaveURL(/\/\?day=2026-10-07&status=failed$/);
    await expect(page.getByText("Showing 3 of 3")).toBeVisible();
    await expect(runsTable(page).getByRole("row")).toHaveCount(4);

    // The day is a filter like any other, and can be let go of.
    await page.getByRole("button", { name: /^7 Oct 2026 Remove this filter$/ }).click();
    await expect(page).toHaveURL(/\/\?status=failed$/);
  });

  test("says what a day was like when it is pointed at", async ({ page }) => {
    await open(page);
    await chart(page, "Runs by day").getByRole("list", { name: "Runs by day" }).getByRole("listitem").nth(1).hover();
    await expect(page.getByRole("tooltip").filter({ hasText: "5 Oct 2026" })).toBeVisible();
  });

  test("is also a table, newest day first", async ({ page }) => {
    await open(page);
    const days = chart(page, "Runs by day");
    await days.getByRole("button", { name: "table" }).click();
    const table = days.getByRole("table", { name: "Runs by day, and how they ended" });
    await expect(table.getByRole("row")).toHaveCount(5);
    await expect(table.getByRole("row").nth(1)).toContainText("7 Oct 2026");
  });
});

test.describe("how long runs take", () => {
  test("puts a dot for each run in a band no taller than a few lines, however many have the same length", async ({ page }) => {
    await open(page);
    const bot = chart(page, "How long runs take").getByRole("list", { name: "GitHub bot, each run" });
    await expect(bot.getByRole("link")).toHaveCount(54);
    const box = (await bot.boundingBox())!;
    // Fifty-four runs, most of them the same few lengths, in seven lines of dots at most.
    expect(box.height).toBeLessThan(130);
  });

  test("opens a run from its dot", async ({ page }) => {
    await open(page);
    await chart(page, "How long runs take").getByRole("link", { name: /^Audit repositories, 21\.1 s, succeeded$/ }).click();
    await expect(page).toHaveURL(/\/runs\/agent-desk%3Aaudit-/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Audit repositories");
  });

  test("is also a table", async ({ page }) => {
    await open(page);
    const spread = chart(page, "How long runs take");
    await spread.getByRole("button", { name: "table" }).click();
    await expect(spread.getByRole("table", { name: "How long the runs of each app took" }).getByRole("row")).toHaveCount(5);
  });
});

test.describe("the slowest steps", () => {
  test("opens the run a step was slowest in, on that step", async ({ page }) => {
    await open(page);
    const first = chart(page, "The slowest steps").getByRole("link").first();
    await expect(first).toHaveAttribute("aria-label", /^POST \/graphql, GitHub bot, longest 5\.67 s, 26 times\. Open the run\.$/);
    await first.click();

    await expect(page).toHaveURL(/\/runs\/github-bot%3Aaudit-0721cc42cb\?span=/);
    await expect(detail(page)).toContainText("POST /graphql");
    await expect(detail(page)).toContainText("5.67 s");
  });

  test("leaves out waits for a person, which are not the app being slow", async ({ page }) => {
    await open(page);
    await expect(chart(page, "The slowest steps")).not.toContainText("Waiting for the traveller");
  });
});

test.describe("scoped by the filters", () => {
  test("adds up only the runs that are chosen, and says how many", async ({ page }) => {
    await open(page, "?source=sayso");
    await expect(page.getByText("Adding up 11 runs of 71.")).toBeVisible();
    const time = chart(page, "Where the time goes");
    await expect(time.getByRole("listitem").filter({ hasText: "Sayso" }).first()).toBeVisible();
    await expect(time).not.toContainText("GitHub bot");
  });

  test("keeps the choice in the address, and applies a chip when it is pressed", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: /^Flowboard 5$/ }).click();
    await expect(page).toHaveURL(/\/overview\?source=flowboard$/);
    await expect(page.getByText("Adding up 5 runs of 71.")).toBeVisible();
  });

  test("says so when nothing is left to add up", async ({ page }) => {
    await open(page, "?q=zzzz-nothing-like-this");
    await expect(chart(page, "Where the time goes")).toContainText("No runs to add up.");
    await expect(chart(page, "Runs by day")).toContainText("No run has a start time to place it on a day.");
    await expect(chart(page, "The slowest steps")).toContainText("No step took any time.");
  });
});
