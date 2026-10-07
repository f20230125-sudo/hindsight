// Takes the pictures in the README, and the page preview image.
//
//   HINDSIGHT_SNAPSHOT_URL=http://127.0.0.1:9/none npm run start    (in one terminal)
//   npm run screenshots                                              (in another)
//
// The server is pointed at an address with nothing at it, so it answers with
// the recorded runs and the pictures come out the same every time.

import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3040";
const OUT = "docs/screenshots";
const SAYSO_SEAT = "/runs/sayso%3A" + (process.env.SAYSO_TURN ?? "turn-muxs1zkw-1");
const BOT_AUDIT = "/runs/github-bot%3Aaudit-0721cc42cb";

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

async function shot({ path, name, theme = "light", width = 1280, height = 900, full = false, scroll = 0, folder = OUT, click, css }) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, deviceScaleFactor: 1, timezoneId: "Asia/Dubai" });
  await context.addInitScript((value) => localStorage.setItem("hindsight:theme", value), theme);
  const page = await context.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  if (css) await page.addStyleTag({ content: css });
  if (click) await click(page);
  await page.waitForTimeout(900);
  if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${folder}/${name}.png`, fullPage: full });
  await context.close();
  console.log(`saved ${folder}/${name}.png`);
}

// The list, with the recordings of the other apps in it.
await shot({ path: "/", name: "runs" });

// A real Sayso run in agent time: the traveller's waits squeezed, the app's calls readable.
await shot({
  path: `${SAYSO_SEAT}?time=agent`,
  name: "run-agent-time",
  full: true,
  click: async (page) => {
    await page.getByRole("button", { name: /^POST \/api\/quotes\. API call/ }).click();
  },
});

// The same run in real time, for comparison: the calls are slivers.
await shot({ path: SAYSO_SEAT, name: "run-real-time", full: true });

// The GitHub bot's audit, in the dark theme, with its crowd of findings as a count.
await shot({ path: BOT_AUDIT, name: "run-github-bot-dark", theme: "dark", full: true });

// Everything added up.
await shot({ path: "/overview", name: "overview", full: true, height: 900 });

// The page preview, at the size link previews use: a headline beside the real timeline panel of a real run.
{
  const source = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light", deviceScaleFactor: 2, timezoneId: "Asia/Dubai" });
  const run = await source.newPage();
  await run.goto(`${BASE}${SAYSO_SEAT}?time=agent`, { waitUntil: "networkidle" });
  await run.getByRole("heading", { level: 1 }).waitFor();
  await run.waitForTimeout(900);
  const panel = (await run.locator('section[aria-labelledby="timeline-heading"]').screenshot()).toString("base64");
  await source.close();

  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(`<!doctype html><html><body style="margin:0;width:1200px;height:630px;background:#f4f5f7;color:#14171c;font-family:Geist,ui-sans-serif,system-ui,Segoe UI,sans-serif;display:flex;align-items:center;gap:44px;padding:0 56px;box-sizing:border-box;overflow:hidden">
    <div style="width:400px;flex:none">
      <div style="display:flex;align-items:center;gap:12px;font-size:26px;font-weight:600;letter-spacing:-0.01em">
        <svg width="34" height="34" viewBox="0 0 18 18"><rect x="1" y="2" width="9" height="3.5" rx="1.5" fill="#2a78d6"/><rect x="5" y="7.25" width="7" height="3.5" rx="1.5" fill="#eb6834"/><rect x="9" y="12.5" width="8" height="3.5" rx="1.5" fill="#1baf7a"/></svg>
        Hindsight
      </div>
      <div style="margin-top:34px;font-size:50px;line-height:1.08;font-weight:650;letter-spacing:-0.025em">What your agents did, after the fact</div>
      <div style="margin-top:22px;font-size:21px;line-height:1.45;color:#4a5361">Every run of four apps on one timeline: what was understood, each call, each wait, each check.</div>
    </div>
    <img alt="" src="data:image/png;base64,${panel}" style="width:660px;flex:none;border-radius:18px;box-shadow:0 1px 2px rgba(16,24,40,.06),0 16px 40px rgba(16,24,40,.12);border:1px solid #dfe3e8">
  </body></html>`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "src/app/opengraph-image.png" });
  await context.close();
  console.log("saved src/app/opengraph-image.png");
}

await browser.close();
