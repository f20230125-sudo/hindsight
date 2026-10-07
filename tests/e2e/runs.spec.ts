import { expect, test } from "@playwright/test";
import { AUDIT_PATH, CUT_AUDIT_PATH, detail, openRun, openRuns, runsTable, timeline } from "./helpers";

test.describe("the list of runs", () => {
  test("shows the runs of every app with their figures, and says which are recordings", async ({ page }) => {
    await openRuns(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("What your agents did, after the fact");

    // The bot's 54 runs and 17 recorded runs of the other three apps.
    const figures = page.getByRole("region", { name: "Figures for the runs shown" });
    await expect(figures.getByText("71", { exact: true })).toBeVisible();
    await expect(figures.getByText("Used a model")).toBeVisible();

    // The test server has no way to reach GitHub, and the page says so rather than showing the copy as live.
    const origin = page.getByRole("region", { name: "Where the runs come from" });
    await expect(origin).toContainText("GitHub bot");
    await expect(origin).toContainText("GitHub could not be reached");
    await expect(origin).toContainText("Sayso11 recorded runs");
    await expect(origin).toContainText("Flowboard5 recorded runs");
    await expect(origin).toContainText("Agent Desk1 recorded run");

    // Twenty-five at first, and the rest on request.
    await expect(runsTable(page).getByRole("row")).toHaveCount(26);
    await expect(page.getByText("Showing 25 of 71")).toBeVisible();
    await page.getByRole("button", { name: "Show 25 more" }).click();
    await expect(runsTable(page).getByRole("row")).toHaveCount(51);
    await page.getByRole("button", { name: "Show 21 more" }).click();
    await expect(page.getByText("Showing 71 of 71")).toBeVisible();
  });

  test("filters by agent, keeps the choice in the address, and clears it", async ({ page }) => {
    await openRuns(page);
    await page.getByRole("button", { name: /^pitch 4$/ }).click();
    await expect(page).toHaveURL(/\?agent=pitch$/);
    await expect(runsTable(page).getByRole("row")).toHaveCount(5);
    await expect(runsTable(page).getByRole("link", { name: "Read Patch's notes" })).toHaveCount(4);

    // The address is the view: opening it again gives the same list.
    await page.reload();
    await expect(page.getByRole("button", { name: /^pitch 4$/ })).toHaveAttribute("aria-pressed", "true");
    await expect(runsTable(page).getByRole("row")).toHaveCount(5);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(runsTable(page).getByRole("row")).toHaveCount(26);
  });

  test("searches the titles and summaries", async ({ page }) => {
    await openRuns(page);
    await page.getByRole("searchbox", { name: "Search the runs" }).fill("audit");
    await expect(page).toHaveURL(/\?q=audit$/);
    // The bot's 25 audits and the desk's own.
    await expect(page.getByText("Showing 25 of 26")).toBeVisible();

    await page.getByRole("searchbox", { name: "Search the runs" }).fill("zzzz nothing like this");
    await expect(page.getByRole("heading", { name: "No run matches these filters" })).toBeVisible();
  });

  test("filters by app, and shows the recorded runs of the app that was chosen", async ({ page }) => {
    await openRuns(page);
    await expect(page.getByRole("button", { name: /^Sayso 11$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Flowboard 5$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Agent Desk 1$/ })).toBeVisible();

    await page.getByRole("button", { name: /^Sayso 11$/ }).click();
    await expect(page).toHaveURL(/\?source=sayso$/);
    await expect(page.getByText("Showing 11 of 11")).toBeVisible();
    // A recording says so beside its name, so it is never taken for a run that just happened.
    await expect(runsTable(page).getByText("recorded", { exact: true }).first()).toBeVisible();
    await expect(runsTable(page).getByRole("link", { name: "a window seat on my London flight" }).first()).toBeVisible();
  });

  test("filters by how a run ended", async ({ page }) => {
    await openRuns(page, "?status=failed");
    // Sayso's failed call and its words that were not understood, and Flowboard's weather service being down.
    await expect(page.getByText("Showing 3 of 3")).toBeVisible();
    await openRuns(page, "?status=stopped");
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();
  });

  test("shows an error with a way to try again when the runs cannot be read", async ({ page }) => {
    await page.route("**/api/runs/github-bot", (route) => route.fulfill({ status: 500, json: {} }));
    await page.goto("/");
    // Next.js keeps an alert of its own for announcing page changes, so ours is picked by its words.
    await expect(page.getByRole("alert").filter({ hasText: "could not be read" })).toContainText("The GitHub bot's runs could not be read");

    await page.unroute("**/api/runs/github-bot");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(runsTable(page)).toBeVisible();
  });
});

test.describe("one run", () => {
  test("opens from the list and shows the run's figures", async ({ page }) => {
    await openRuns(page);
    await runsTable(page).getByRole("link", { name: "Audit repositories" }).first().click();
    // The newest audit is the desk's own recorded one; the bot's are older.
    await expect(page).toHaveURL(/\/runs\/(agent-desk|github-bot)%3Aaudit-/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Audit repositories");
    await expect(timeline(page)).toBeVisible();
  });

  test("lays the audit out as five steps with its four calls under the first", async ({ page }) => {
    await openRun(page, AUDIT_PATH);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Audit repositories");

    const figures = page.getByRole("region", { name: "Figures for this run" });
    await expect(figures).toContainText("Calls4");
    await expect(figures).toContainText("Failed1");
    await expect(figures).toContainText("Calls avoided13");

    const rows = timeline(page).getByRole("listitem");
    await expect(rows).toHaveCount(9);
    for (const name of ["sync", "details", "checks", "repo", "summary"]) {
      await expect(rows.filter({ hasText: name }).first()).toBeVisible();
    }
    await expect(timeline(page).getByRole("button", { name: /^POST \/graphql\. API call/ })).toHaveCount(2);
  });

  test("shows what a call did when its bar is chosen", async ({ page }) => {
    await openRun(page, AUDIT_PATH);
    await expect(detail(page)).toContainText("Select a bar or a mark");

    await timeline(page).getByRole("button", { name: /^POST \/graphql\. API call, done\. Starts \+635 ms/ }).click();
    await expect(detail(page)).toContainText("POST /graphql");
    await expect(detail(page)).toContainText("Starts+635 ms");
    await expect(detail(page)).toContainText("Took5.67 s");
    await expect(detail(page)).toContainText("Part ofsync");
    await expect(detail(page)).toContainText("status: 200");

    // The refused call is marked as failed, in words as well as colour.
    await timeline(page).getByRole("button", { name: /^GET \/user\/repos\. API call, failed/ }).click();
    await expect(detail(page)).toContainText("API call · Failed");
    await expect(detail(page)).toContainText("status: 403");
  });

  test("works from the keyboard alone", async ({ page }) => {
    await openRun(page, AUDIT_PATH);
    const bar = timeline(page).getByRole("button", { name: /^GET \/user\/repos\. API call/ });
    await bar.focus();
    await page.keyboard.press("Enter");
    await expect(bar).toHaveAttribute("aria-pressed", "true");
    await expect(detail(page)).toContainText("GET /user/repos");
  });

  test("lists the marks of a crowded step when its count is chosen, and opens one", async ({ page }) => {
    await openRun(page, AUDIT_PATH);
    await timeline(page).getByRole("button", { name: /^49 things happened close together/ }).click();
    await expect(detail(page)).toContainText("49 close together");
    await detail(page).getByRole("button", { name: /No topics/ }).first().click();
    await expect(detail(page)).toContainText("No topics. Nobody can find it.");
    await expect(detail(page)).toContainText("severity: \"medium\"");
  });

  test("explains a call that began before the run was recorded", async ({ page }) => {
    await openRun(page, CUT_AUDIT_PATH);
    await timeline(page).getByRole("button", { name: /^GET \/user\/repos\. API call, failed\. Starts \+0 ms, took 18 ms\. Worked out from the log\./ }).click();
    await expect(detail(page)).toContainText("This call took 218 ms and began 200 ms before the run was recorded");
  });

  test("says so when there is no run at the address", async ({ page }) => {
    await page.goto("/runs/github-bot%3Anot-a-run");
    await expect(page.getByRole("heading", { name: "There is no run with this address" })).toBeVisible();
    await page.getByRole("link", { name: "All runs" }).click();
    await expect(runsTable(page)).toBeVisible();
  });
});

test("the theme can be switched and is remembered", async ({ page }) => {
  await openRuns(page);
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  await page.getByRole("button", { name: /^Switch to (dark|light) theme$/ }).click();
  const after = await html.getAttribute("data-theme");
  expect(after).not.toBe(before);
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", after ?? "");
});
