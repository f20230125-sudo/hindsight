import { expect, test, type Page } from "@playwright/test";
import { AUDIT_PATH, openRun } from "./helpers";

// The one moment of motion: a run draws itself once when it opens. The other
// tests run with motion reduced (see playwright.config.ts); these two look at
// the motion itself, and at what a person who asked for less of it gets.

type Window = { __draws: number[] };

/** Records when each bar starts to draw, and the time at which its animation ends (its delay plus its length). */
async function watchDrawing(page: Page) {
  await page.addInitScript(() => {
    const draws: number[] = [];
    (window as unknown as Window).__draws = draws;
    document.addEventListener(
      "animationstart",
      (event) => {
        if (event.animationName !== "draw-in") return;
        const animation = (event.target as Element).getAnimations().find((found) => (found as CSSAnimation).animationName === "draw-in");
        if (animation) draws.push(Number(animation.effect?.getComputedTiming().endTime));
      },
      true,
    );
  });
}

const draws = (page: Page) => page.evaluate(() => (window as unknown as Window).__draws);

test.describe("with motion allowed", () => {
  test.use({ reducedMotion: "no-preference" });

  test("a run draws itself in within 700 ms, once", async ({ page }) => {
    await watchDrawing(page);
    await openRun(page, AUDIT_PATH);

    // Every bar draws, and the last one is in by 700 ms.
    await expect.poll(async () => (await draws(page)).length).toBeGreaterThanOrEqual(5);
    const ends = await draws(page);
    expect(Math.max(...ends)).toBeLessThanOrEqual(700);

    // Once it is done, zooming and switching the clock do not draw it again.
    await page.waitForTimeout(1000);
    const drawn = (await draws(page)).length;
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Table" }).click();
    await page.getByRole("button", { name: "Timeline", exact: true }).click();
    await page.getByRole("button", { name: "Agent time" }).click();
    await page.waitForTimeout(500);
    expect(await draws(page)).toHaveLength(drawn);
  });
});

test.describe("with motion reduced", () => {
  test("nothing is drawn in, and the bars are there at once", async ({ page }) => {
    await watchDrawing(page);
    await openRun(page, AUDIT_PATH);
    const bar = page.getByRole("list", { name: "What happened, in order" }).getByRole("button", { name: /^POST \/graphql\. API call/ }).first();
    await expect(bar).toBeVisible();
    expect(await bar.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    expect(await draws(page)).toEqual([]);
  });
});
