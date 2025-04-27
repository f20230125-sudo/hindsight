import { expect, test, type Page } from "@playwright/test";
import { AUDIT_PATH, SAYSO_PATH, detail, openRun, timeline } from "./helpers";

// Exploring one run: the clock it is drawn by, how much of it is on show, the
// keyboard, playing it back, and the same run as a table. The run is a real
// Sayso journey in which the traveller took 3.66 s to choose a seat and 1.93 s
// to agree the price, between calls that took 100, 158 and 39 ms.

const bar = (page: Page, name: RegExp) => timeline(page).getByRole("button", { name });
const QUOTE = /^POST \/api\/quotes\. API call/;
const widthOf = async (page: Page, name: RegExp) => (await bar(page, name).boundingBox())!.width;
const focused = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
const slider = (page: Page) => page.getByRole("slider", { name: "Moment in the run" });

test.describe("the clock", () => {
  test("agent time squeezes the waits, so the app's own calls can be seen", async ({ page }) => {
    await openRun(page, SAYSO_PATH);
    const real = await widthOf(page, QUOTE);

    await page.getByRole("button", { name: "Agent time" }).click();
    await expect(page.getByRole("button", { name: "Agent time" })).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/time=agent/);
    const agent = await widthOf(page, QUOTE);
    // A 158 ms call is a sliver of a 5.9 s run, and several times that once the traveller's waits are squeezed.
    expect(agent).toBeGreaterThan(real * 3);

    // The squeezed waits say how long they really were.
    const axis = page.getByTestId("time-axis");
    await expect(axis.getByText("3.66 s", { exact: true })).toBeVisible();
    await expect(axis.getByText("1.93 s", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Real time" }).click();
    await expect(page).not.toHaveURL(/time=agent/);
    expect(await widthOf(page, QUOTE)).toBeCloseTo(real, 0);
  });

  test("a link to agent time opens in agent time", async ({ page }) => {
    await openRun(page, `${SAYSO_PATH}?time=agent`);
    await expect(page.getByRole("button", { name: "Agent time" })).toHaveAttribute("aria-pressed", "true");
  });

  test("says so when a run has no wait for a person, which is all agent time changes", async ({ page }) => {
    await openRun(page, AUDIT_PATH);
    await expect(page.getByRole("button", { name: "Agent time" })).toHaveAttribute("title", /no wait for a person/);
  });
});

test.describe("zooming", () => {
  test("zooms in and out, and says where in the address", async ({ page }) => {
    await openRun(page, AUDIT_PATH);
    await expect(page.getByRole("button", { name: "Zoom out" })).toBeDisabled();

    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page).toHaveURL(/from=\d+&to=\d+/);
    await expect(page.getByRole("button", { name: "Zoom out" })).toBeEnabled();
    const [from, to] = [...page.url().matchAll(/(?:from|to)=(\d+)/g)].map((match) => Number(match[1]));
    // Half of an 8 s run, in the middle.
    expect(to - from).toBe(3999);

    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(page).not.toHaveURL(/from=/);
  });

  test("moves along the run, and shows all of it again", async ({ page }) => {
    await openRun(page, AUDIT_PATH);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    const before = page.url();
    await page.getByRole("button", { name: "Move later" }).click();
    expect(page.url()).not.toBe(before);

    await page.getByRole("button", { name: "Show all of the run" }).click();
    await expect(page).not.toHaveURL(/from=/);
  });

  test("works from the keyboard: plus and minus, brackets, zero", async ({ page }) => {
    await openRun(page, AUDIT_PATH);
    await bar(page, /^sync\. Step/).focus();
    await page.keyboard.press("+");
    await expect(page).toHaveURL(/from=/);
    await page.keyboard.press("]");
    await page.keyboard.press("[");
    await page.keyboard.press("-");
    await expect(page).not.toHaveURL(/from=/);
    await page.keyboard.press("+");
    await page.keyboard.press("0");
    await expect(page).not.toHaveURL(/from=/);
  });

  test("zooms to the span that is chosen, so a call fills the track", async ({ page }) => {
    await openRun(page, SAYSO_PATH);
    const before = await widthOf(page, QUOTE);
    await bar(page, QUOTE).click();
    await page.getByRole("button", { name: "Zoom to the chosen one" }).click();
    await expect(page).toHaveURL(/span=.*from=\d+&to=\d+|from=\d+&to=\d+.*span=/);
    expect(await widthOf(page, QUOTE)).toBeGreaterThan(before * 5);
  });

  test("a link to a zoomed view opens zoomed, on the chosen span", async ({ page }) => {
    await openRun(page, `${AUDIT_PATH}?from=1000&to=3000&span=${encodeURIComponent("event-5")}`);
    await expect(page.getByRole("button", { name: "Zoom out" })).toBeEnabled();
  });
});

test.describe("the keyboard", () => {
  test("moves between bars with the arrow keys, and into the marks on a bar", async ({ page }) => {
    await openRun(page, AUDIT_PATH);
    await bar(page, /^sync\. Step/).focus();

    // Down to the next row, which is the first call under it.
    await page.keyboard.press("ArrowDown");
    expect(await focused(page)).toMatch(/^GET \/user\/repos\. API call/);
    await page.keyboard.press("ArrowUp");
    expect(await focused(page)).toMatch(/^sync\. Step/);

    // Right goes into the marks on the same row: the lines the step said.
    await page.keyboard.press("ArrowRight");
    expect(await focused(page)).toMatch(/^Asking GitHub what changed\./);
    await page.keyboard.press("Enter");
    await expect(detail(page)).toContainText("Asking GitHub what changed.");

    await page.keyboard.press("Home");
    expect(await focused(page)).toMatch(/^sync\. Step/);
    await page.keyboard.press("End");
    expect(await focused(page)).toMatch(/Asking|First look/);

    // Escape lets go of the choice.
    await page.keyboard.press("Escape");
    await expect(detail(page)).toContainText("Select a bar or a mark");
  });

  test("is one place in the tab order, whichever row it is on", async ({ page }) => {
    await openRun(page, AUDIT_PATH);
    await bar(page, /^details\. Step/).focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    // Back in the timeline, where it was.
    expect(await focused(page)).toMatch(/^details\. Step/);
    const stops = await timeline(page).locator('button[tabindex="0"]').count();
    expect(stops).toBe(1);
  });
});

test.describe("playing a run back", () => {
  test("shows what was going on, and what the person had been shown, at a moment", async ({ page }) => {
    await openRun(page, SAYSO_PATH);
    await slider(page).fill("2000");

    const panel = detail(page);
    await expect(panel.getByRole("button", { name: "At this moment" })).toHaveAttribute("aria-pressed", "true");
    await expect(panel).toContainText("+2.00 s");
    await expect(panel.getByRole("heading", { name: "Going on" })).toBeVisible();
    await expect(panel).toContainText("Waiting for the traveller to choose a seat");
    await expect(panel).toContainText("1.89 s so far");
    await expect(panel).toContainText("Shown: Seat map");
    await expect(panel).not.toContainText("Receipt");

    // Later, the receipt has been shown and nothing is going on.
    await slider(page).fill("5917");
    await expect(panel).toContainText("Shown: Receipt");
    await expect(panel).toContainText("Nothing. The run had not begun, or had ended.");
  });

  test("points at the time axis to set the moment", async ({ page }) => {
    await openRun(page, SAYSO_PATH);
    const box = (await page.getByTestId("time-axis").boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
    await expect(detail(page).getByRole("button", { name: "At this moment" })).toHaveAttribute("aria-pressed", "true");
    // Half way along a run of 5.92 s.
    await expect(detail(page)).toContainText(/\+2\.\d\d s/);
    expect(Number(await slider(page).inputValue())).toBeGreaterThan(2500);
  });

  test("plays, and stops at the end", async ({ page }) => {
    await openRun(page, `${SAYSO_PATH}?time=agent`);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(detail(page).getByRole("button", { name: "At this moment" })).toHaveAttribute("aria-pressed", "true");
    // It moves.
    await expect.poll(async () => Number(await slider(page).inputValue()), { timeout: 5000 }).toBeGreaterThan(200);

    await page.getByRole("button", { name: "Pause" }).click();
    const stopped = Number(await slider(page).inputValue());
    await page.waitForTimeout(400);
    expect(Number(await slider(page).inputValue())).toBe(stopped);
  });

  test("plays a run to the end and offers to play it again", async ({ page }) => {
    await openRun(page, SAYSO_PATH);
    await slider(page).fill("5917");
    await page.getByRole("button", { name: "Play again" }).click();
    // It is at the end, so it begins again from the start rather than stopping at once.
    await expect.poll(async () => Number(await slider(page).inputValue()), { timeout: 5000 }).toBeLessThan(5900);
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  });
});

test.describe("the table", () => {
  test("lists every bar and mark with its times, and choosing one chooses it everywhere", async ({ page }) => {
    await openRun(page, SAYSO_PATH);
    await page.getByRole("button", { name: "Table" }).click();

    const table = page.getByRole("table", { name: "Every bar and mark of the run, in the order they began" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("row")).toHaveCount(16);
    await expect(table.getByRole("row").nth(1)).toContainText("+0 ms");
    await expect(table.getByRole("row", { name: /Waiting for the traveller to choose a seat/ })).toContainText("3.66 s");

    await table.getByRole("button", { name: "POST /api/quotes" }).click();
    await expect(detail(page)).toContainText("POST /api/quotes");
    await expect(page).toHaveURL(/span=/);

    // Back to the timeline, with the same span chosen.
    await page.getByRole("button", { name: "Timeline", exact: true }).click();
    await expect(bar(page, QUOTE)).toHaveAttribute("aria-pressed", "true");
  });
});

test("a chosen span is in the address, and a link to it opens on it", async ({ page }) => {
  await openRun(page, SAYSO_PATH);
  await bar(page, QUOTE).click();
  await expect(page).toHaveURL(/span=/);
  const link = page.url();

  await page.goto("/");
  await page.goto(link);
  await expect(timeline(page)).toBeVisible();
  await expect(bar(page, QUOTE)).toHaveAttribute("aria-pressed", "true");
  await expect(detail(page)).toContainText("POST /api/quotes");
});
