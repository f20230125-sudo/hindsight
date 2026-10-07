import { expect, test, type Page } from "@playwright/test";
import { SAYSO_TITLE, recorded } from "./helpers";

// The Sources page: how each app is connected, and the drop for a run file.

const file = (name: string, content: string | Buffer) => ({ name, mimeType: "application/json", buffer: Buffer.isBuffer(content) ? content : Buffer.from(content) });
const input = (page: Page) => page.locator('input[type="file"]');

test("says how each app is connected, and how many runs of each there are", async ({ page }) => {
  await page.goto("/sources");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How each app is connected");

  const apps = page.getByRole("region", { name: "The apps" });
  await expect(apps.getByRole("article")).toHaveCount(4);
  await expect(apps.getByRole("article", { name: "Sayso" })).toContainText("press Open in Hindsight");
  await expect(apps.getByRole("article", { name: "Sayso" })).toContainText("11 recorded runs until one is sent");
  await expect(apps.getByRole("article", { name: "Flowboard" })).toContainText("Run panel");
  await expect(apps.getByRole("article", { name: "Agent Desk" })).toContainText("runs on its owner's own machine");
  await expect(apps.getByRole("article", { name: "GitHub bot" })).toContainText("Nothing to send");
  await expect(apps.getByRole("link", { name: "Open Sayso" })).toHaveAttribute("href", "https://sayso-sigma.vercel.app");
  await expect(page.getByRole("heading", { name: "What an app sends" })).toBeVisible();
});

test.describe("dropping a run file", () => {
  test("takes a file an app saved, opens it, keeps it, and lets it go", async ({ page }) => {
    await page.goto("/sources");
    await input(page).setInputFiles(file("hindsight-sayso-run.json", JSON.stringify(recorded("sayso", "a window seat, paid for"))));

    await expect(page.getByText("hindsight-sayso-run.json was read.")).toBeVisible();
    await page.getByRole("link", { name: `Open “${SAYSO_TITLE}”` }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SAYSO_TITLE);
    await expect(page.getByText("Dropped as a file, ")).toBeVisible();

    // It is listed as sent to this browser, and is still there after a reload.
    await page.goto("/sources");
    const sent = page.getByRole("region", { name: "Runs sent to this browser" });
    await expect(sent.getByRole("listitem")).toHaveCount(1);
    await page.reload();
    await expect(sent.getByRole("listitem")).toHaveCount(1);

    await sent.getByRole("button", { name: `Remove “${SAYSO_TITLE}”` }).click();
    await expect(sent.getByText("None yet.")).toBeVisible();
  });

  test("takes several files at once, and says for each what became of it", async ({ page }) => {
    await page.goto("/sources");
    await input(page).setInputFiles([
      file("good.json", JSON.stringify(recorded("flowboard"))),
      file("notes.json", "this is not json"),
      file("other.json", JSON.stringify({ hello: "world" })),
      file("future.json", JSON.stringify({ ...recorded("sayso"), version: 2 })),
    ]);

    const results = page.getByRole("status", { name: "What became of the files" });
    await expect(results).toContainText("good.json was read.");
    await expect(results).toContainText("notes.json was not taken. This is not JSON, so it is not a run.");
    await expect(results).toContainText("other.json was not taken. This is not a run written by one of the apps.");
    await expect(results).toContainText("future.json was not taken. This run is in version 2 of the format. This Hindsight reads version 1.");
    // Only the good one was kept.
    await expect(page.getByRole("region", { name: "Runs sent to this browser" }).getByRole("listitem")).toHaveCount(1);
  });

  test("refuses a file that is too big, without reading it", async ({ page }) => {
    await page.goto("/sources");
    await input(page).setInputFiles(file("big.json", Buffer.alloc(2_100_000, 32)));
    await expect(page.getByRole("status", { name: "What became of the files" })).toContainText("big.json was not taken. This file is 2.1 MB. Hindsight takes runs up to 2 MB.");
  });

  test("takes a file a run was saved to when the tab was blocked, even for the desk", async ({ page }) => {
    await page.goto("/sources");
    await input(page).setInputFiles(file("desk.json", JSON.stringify(recorded("agent-desk"))));
    await expect(page.getByText("desk.json was read.")).toBeVisible();
    await page.getByRole("link", { name: "Open “Audit repositories”" }).click();
    await expect(timeline(page)).toBeVisible();
    await expect(page.getByText("Dropped as a file, ")).toBeVisible();
  });
});

const timeline = (page: Page) => page.getByRole("list", { name: "What happened, in order" });

test("a run can be removed all at once", async ({ page }) => {
  await page.goto("/sources");
  await input(page).setInputFiles([file("a.json", JSON.stringify(recorded("sayso"))), file("b.json", JSON.stringify(recorded("flowboard")))]);
  const sent = page.getByRole("region", { name: "Runs sent to this browser" });
  await expect(sent.getByRole("listitem")).toHaveCount(2);
  await sent.getByRole("button", { name: "Remove all" }).click();
  await expect(sent.getByText("None yet.")).toBeVisible();
});

test("keeps a run even when the page is reloaded the moment it was read", async ({ page }) => {
  // A run is saved a moment after it arrives. A reload inside that moment used to lose it.
  await page.goto("/sources");
  await input(page).setInputFiles(file("quick.json", JSON.stringify(recorded("sayso"))));
  await expect(page.getByText("quick.json was read.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Runs sent to this browser" }).getByRole("listitem")).toHaveCount(1);
});
