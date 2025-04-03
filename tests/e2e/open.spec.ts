import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { SAYSO_ID, SAYSO_TITLE, detail, recorded, runsTable, timeline } from "./helpers";

// What happens when an app's button opens Hindsight. The app is a page put at
// the app's own address, which does what the button does: open /open, wait to
// be told it is ready, and hand the run over.

const HINDSIGHT = "http://localhost:3040";
const SAYSO_SITE = "https://sayso-sigma.vercel.app";

async function appAt(context: BrowserContext, address: string, envelope: unknown): Promise<Page> {
  await context.route(`${address}/`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>An app</title><button id="send">Open in Hindsight</button><script>
        const envelope = ${JSON.stringify(envelope)};
        window.__answers = [];
        window.addEventListener("message", (event) => {
          if (event.origin !== "${HINDSIGHT}") return;
          if (event.data && event.data.type === "hindsight:ready") event.source.postMessage(envelope, event.origin);
          else window.__answers.push(event.data);
        });
        document.getElementById("send").onclick = () => window.open("${HINDSIGHT}/open", "hindsight");
      </script>`,
    }),
  );
  const page = await context.newPage();
  await page.goto(`${address}/`);
  return page;
}

const answers = (page: Page) => page.evaluate(() => (window as unknown as { __answers: unknown[] }).__answers);

test.describe("a run sent by an app", () => {
  test("is taken, kept, and opened as a timeline", async ({ context }) => {
    const app = await appAt(context, SAYSO_SITE, recorded("sayso", "a window seat, paid for"));
    const opened = app.waitForEvent("popup");
    await app.getByRole("button", { name: "Open in Hindsight" }).click();
    const popup = await opened;

    // The page opens the run, and the app is told it was taken.
    await expect(popup).toHaveURL(`${HINDSIGHT}/runs/${encodeURIComponent(SAYSO_ID)}`);
    await expect(popup.getByRole("heading", { level: 1 })).toHaveText(SAYSO_TITLE, { timeout: 15_000 });
    await expect(popup.getByText("Sent from Sayso, ")).toBeVisible();
    await expect.poll(() => answers(app)).toEqual([{ type: "hindsight:received", id: SAYSO_ID }]);

    // The longest bars are the traveller thinking: the run is mostly waiting for a person.
    await expect(timeline(popup)).toContainText("Waiting for the traveller to choose a seat");

    // It replaces the recorded run of the same journey in the list, and says it was sent.
    await popup.goto("/?source=sayso");
    await expect(popup.getByText("Showing 11 of 11")).toBeVisible();
    await expect(runsTable(popup).getByText("sent", { exact: true })).toHaveCount(1);

    // It is kept in this browser.
    await popup.reload();
    await expect(runsTable(popup).getByText("sent", { exact: true })).toHaveCount(1);
  });

  test("is opened on a timeline with a model call, a wait, and the data that came back, when chosen", async ({ context }) => {
    const app = await appAt(context, SAYSO_SITE, recorded("sayso", "read by a model"));
    const opened = app.waitForEvent("popup");
    await app.getByRole("button", { name: "Open in Hindsight" }).click();
    const popup = await opened;

    await expect(popup.getByRole("heading", { level: 1 })).toHaveText("I'd love to look out at the clouds on the way to London", { timeout: 15_000 });
    await timeline(popup).getByRole("button", { name: /^Read by gemini-3\.5-flash-lite\. Model call/ }).click();
    await expect(detail(popup)).toContainText("Model call · Done");
    await expect(detail(popup)).toContainText("You said");
  });

  test("is refused when it is sent as another app, and the app is told why", async ({ context }) => {
    const app = await appAt(context, SAYSO_SITE, recorded("flowboard"));
    const opened = app.waitForEvent("popup");
    await app.getByRole("button", { name: "Open in Hindsight" }).click();
    const popup = await opened;

    await expect(popup.getByRole("heading", { name: "This run was not taken" })).toBeVisible();
    await expect(popup.getByRole("alert").filter({ hasText: "may send" })).toContainText('https://sayso-sigma.vercel.app may send Sayso runs, not "flowboard" runs.');
    await expect.poll(() => answers(app)).toEqual([{ type: "hindsight:refused", reason: 'https://sayso-sigma.vercel.app may send Sayso runs, not "flowboard" runs.' }]);

    // Nothing was kept.
    await popup.goto("/");
    await expect(runsTable(popup)).toBeVisible();
    await expect(popup.getByText("sent", { exact: true })).toHaveCount(0);
  });

  test("is refused when it is not in the shape the app writes", async ({ context }) => {
    const envelope = { ...recorded("sayso"), data: { id: 7 } };
    const app = await appAt(context, SAYSO_SITE, envelope);
    const opened = app.waitForEvent("popup");
    await app.getByRole("button", { name: "Open in Hindsight" }).click();
    const popup = await opened;
    await expect(popup.getByRole("alert").filter({ hasText: "not in the shape" })).toContainText("This Sayso run is not in the shape Sayso writes.");
  });

  test("is ignored when the page sending it is not one of the apps", async ({ context }) => {
    const app = await appAt(context, "https://evil.example", recorded("sayso"));
    const opened = app.waitForEvent("popup");
    await app.getByRole("button", { name: "Open in Hindsight" }).click();
    const popup = await opened;

    // Nothing is said back, and after a while the page says nothing came.
    await expect(popup.getByRole("heading", { name: "Waiting for the run" })).toBeVisible();
    await expect(popup.getByRole("heading", { name: "Nothing has come" })).toBeVisible({ timeout: 10_000 });
    expect(await answers(app)).toEqual([]);
    await popup.goto("/");
    await expect(popup.getByText("sent", { exact: true })).toHaveCount(0);
  });
});

test("the page says what it is for when nothing opened it", async ({ page }) => {
  await page.goto("/open");
  await expect(page.getByRole("heading", { name: "This page takes a run from an app" })).toBeVisible();
  await page.getByRole("link", { name: "How each app is connected" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How each app is connected");
});
