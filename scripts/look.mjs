// Opens a page of Hindsight in a real browser and saves a picture of it, so a
// change can be looked at, not only tested.
//
//   node scripts/look.mjs [path] [light|dark] [width] [name]
//
// Set LOOK_DIR to choose where pictures go, BASE_URL to look at another
// address (the live site, say), and CLICK to click something first: a CSS
// selector, or text=... for a button with that text.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3040";
const [path = "/", theme = "light", width = "1280", name = "look"] = process.argv.slice(2);
const dir = process.env.LOOK_DIR ?? join(process.env.TEMP ?? ".", "hindsight-look");
await mkdir(dir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: Number(width), height: 900 }, colorScheme: theme, deviceScaleFactor: 1, timezoneId: "Asia/Dubai" });
await context.addInitScript((value) => {
  try {
    localStorage.setItem("hindsight:theme", value);
  } catch {
    // Storage may be switched off.
  }
}, theme);
const page = await context.newPage();
const problems = [];
page.on("console", (message) => {
  if (message.type() === "error") problems.push(message.text());
});
page.on("pageerror", (error) => problems.push(String(error)));

await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
if (process.env.CLICK) {
  await page.locator(process.env.CLICK).first().click();
  await page.waitForTimeout(400);
}
await page.waitForTimeout(300);

const file = join(dir, `${name}-${theme}-${width}.png`);
await page.screenshot({ path: file, fullPage: process.env.FULL !== "0" });
console.log(file);
console.log(problems.length === 0 ? "No console errors." : `Console errors:\n${problems.join("\n")}`);
await browser.close();
