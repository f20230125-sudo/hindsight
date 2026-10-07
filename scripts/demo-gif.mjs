// Records the short demo at the top of the README.
//
//   HINDSIGHT_SNAPSHOT_URL=http://127.0.0.1:9/none npm run start    (in one terminal)
//   npm run gif                                                      (in another)
//
// A browser is driven through the app while every frame it draws is kept, and
// the frames become docs/demo.gif. The server answers with the recorded runs,
// so the tour comes out the same every time.

import { mkdir, stat } from "node:fs/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3040";
const OUT = process.env.OUT_FILE ?? "docs/demo.gif";
const VIEW = { width: 1180, height: 720 };

// --- Drawn on top of the page: a pointer, since a headless browser has none,
// --- and one line saying what is happening.

function overlay() {
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:ui-sans-serif,system-ui,sans-serif";
  layer.innerHTML = `
    <div id="demo-caption" style="position:absolute;left:50%;top:70px;transform:translateX(-50%);padding:8px 16px;
      border-radius:12px;background:rgba(20,23,28,.96);color:#f3f5f8;font-size:15px;
      font-weight:500;white-space:nowrap;box-shadow:0 10px 30px rgba(16,24,40,.25);display:none"></div>
    <div id="demo-pointer" style="position:absolute;left:0;top:0;width:24px;height:24px;margin:-2px 0 0 -4px">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><path d="M5 3 L5 24 L11 18.5 L15 27 L19 25 L15 16.8 L23 16.8 Z"
        fill="#14171c" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>
    </div>`;
  document.body.appendChild(layer);
  const pointer = document.getElementById("demo-pointer");
  document.addEventListener("mousemove", (event) => {
    pointer.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
  }, true);
  window.demoCaption = (text) => {
    const caption = document.getElementById("demo-caption");
    caption.textContent = text;
    caption.style.display = text ? "" : "none";
  };
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEW, colorScheme: "light", deviceScaleFactor: 1, timezoneId: "Asia/Dubai" });
const page = await context.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.getByRole("heading", { level: 1 }).waitFor();
await page.getByRole("table", { name: "Runs, newest first" }).waitFor();
await page.waitForTimeout(600);
await page.evaluate(overlay);

let at = { x: 590, y: 330 };
await page.mouse.move(at.x, at.y);

const wait = (ms) => page.waitForTimeout(ms);
const caption = (text) => page.evaluate((line) => window.demoCaption(line), text);

/** Glide the pointer to the middle of something, then click it. */
async function click(target) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const steps = 12;
  for (let step = 1; step <= steps; step += 1) {
    // Ease out: quick at first, slowing as it arrives.
    const part = 1 - (1 - step / steps) ** 2;
    await page.mouse.move(at.x + (to.x - at.x) * part, at.y + (to.y - at.y) * part);
    await wait(18);
  }
  at = to;
  await wait(160);
  await page.mouse.click(to.x, to.y);
}

// Keep every frame drawn from here on, with the time it was drawn.
const frames = [];
let recording = true;
const camera = (async () => {
  while (recording) frames.push({ at: Date.now(), png: await page.screenshot() });
})();

await wait(500);
await caption("Every run of four apps, in one list");
await wait(1700);

await caption("Filter by app");
await click(page.getByRole("button", { name: /^Sayso 11$/ }));
await wait(1100);

await caption("Open a run");
// The oldest Sayso recording is the first journey recorded: a seat chosen and paid for.
await click(page.getByRole("link", { name: "a window seat on my London flight" }).last());
const timeline = page.getByRole("list", { name: "What happened, in order" });
await timeline.waitFor();
await wait(1000);
await caption("On a timeline. Nearly all of it is the traveller thinking");
await page.evaluate(() => window.scrollTo({ top: 300, behavior: "smooth" }));
await wait(2600);

await caption("Agent time squeezes the waits, so the app's own work shows");
await click(page.getByRole("button", { name: "Agent time" }));
await wait(2600);

await caption("Choose a bar for everything the app recorded");
await click(timeline.getByRole("button", { name: /^POST \/api\/quotes\. API call/ }));
await wait(2400);

await caption("Play it back: what was going on, and what the person was shown");
await click(page.getByRole("button", { name: "Play", exact: true }));
await wait(5200);
await page.getByRole("button", { name: "Pause" }).click().catch(() => {});
await wait(700);

await caption("All the runs added up");
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await wait(900);
await click(page.getByRole("link", { name: "Overview" }));
await page.getByRole("heading", { name: "Where the time goes" }).waitFor();
await wait(3200);

recording = false;
await camera;
await browser.close();

// --- Frames to a GIF -------------------------------------------------------------

// Each frame stays up until the next one was drawn. Frames in which nothing
// changed are folded into the one before, which keeps the file small.
const kept = [];
frames.forEach((frame, index) => {
  const ms = (frames[index + 1]?.at ?? frame.at + 100) - frame.at;
  const last = kept[kept.length - 1];
  if (last && last.png.equals(frame.png)) last.ms += ms;
  else kept.push({ png: frame.png, ms });
});

await mkdir(OUT.split("/").slice(0, -1).join("/") || ".", { recursive: true });
await sharp(kept.map((frame) => frame.png), { join: { animated: true } })
  .gif({
    delay: kept.map((frame) => frame.ms),
    loop: 0,
    colours: 96,
    dither: 0,
    effort: 8,
    // Pixels that barely changed are left as they were in the frame before.
    interFrameMaxError: 6,
    interPaletteMaxError: 8,
  })
  .toFile(OUT);

const seconds = kept.reduce((sum, frame) => sum + frame.ms, 0) / 1000;
const { size } = await stat(OUT);
console.log(`saved ${OUT}: ${kept.length} frames, ${seconds.toFixed(1)} s, ${(size / 1_048_576).toFixed(2)} MB`);
