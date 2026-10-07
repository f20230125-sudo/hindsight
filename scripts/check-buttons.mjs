// Presses the "Open in Hindsight" button of each app, in a real browser, and
// checks that a Hindsight page opens on the run.
//
//   node scripts/check-buttons.mjs [sayso|flowboard|agent-desk]
//
// By default it checks the apps on the web against the Hindsight on the web:
//   SAYSO_URL      https://sayso-sigma.vercel.app
//   FLOWBOARD_URL  https://flowboard-flax-seven.vercel.app
//   DESK_URL       http://127.0.0.1:3010   (the desk\u2019s site, run on this machine; its backend is
//                                           stood in for with a recorded run, since the desk has
//                                           no public address)
//   HINDSIGHT_URL  https://hindsight-sand.vercel.app
//
// Each app is built to send to the Hindsight at its own default address, so
// for a local Hindsight the apps must have been built with
// NEXT_PUBLIC_HINDSIGHT_URL set to it.
//
// What is stood in for: the weather service Flowboard's template calls, and the
// desk's backend. Everything else, including Hindsight, is the real thing.

import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const SAYSO = process.env.SAYSO_URL ?? "https://sayso-sigma.vercel.app";
const FLOWBOARD = process.env.FLOWBOARD_URL ?? "https://flowboard-flax-seven.vercel.app";
const DESK = process.env.DESK_URL ?? "http://127.0.0.1:3010";
const HINDSIGHT = (process.env.HINDSIGHT_URL ?? "https://hindsight-sand.vercel.app").replace(/\/$/, "");
const which = process.argv[2];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await chromium.launch();
const results = [];

async function check(name, run) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Dubai" });
  const page = await context.newPage();
  try {
    const found = await run(page, context);
    results.push({ name, ok: true, ...found });
    console.log(`PASS  ${name}: ${found.url}  "${found.title}"  (${found.how})`);
  } catch (problem) {
    results.push({ name, ok: false, problem: String(problem) });
    console.log(`FAIL  ${name}: ${String(problem).split("\n")[0]}`);
  } finally {
    await context.close();
  }
}

/** Presses the button on the page and reads what the new Hindsight tab shows. */
async function pressButton(page) {
  const opened = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open in Hindsight" }).click();
  const popup = await opened;
  await popup.waitForURL(new RegExp(`^${HINDSIGHT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/runs/`), { timeout: 20_000 });
  const title = await popup.getByRole("heading", { level: 1 }).innerText();
  const how = await popup.getByText(/^(Started .* · )?Took .* · /).first().innerText().catch(() => "");
  const timeline = await popup.getByRole("list", { name: "What happened, in order" }).waitFor({ timeout: 10_000 }).then(() => "timeline shown").catch(() => "no timeline");
  const spans = await popup.getByRole("button", { name: /\. (API call|Model call|Waiting|Understanding|Step|Check|Said)/ }).count();
  return { url: popup.url(), title, how: `${how}; ${timeline}; ${spans} bars` };
}

if (!which || which === "sayso") {
  await check("Sayso, on the web", async (page) => {
    await page.goto(SAYSO);
    await page.getByRole("heading", { name: /^Hello,/ }).waitFor();
    await page.getByLabel("Say what you need").fill("a window seat on my London flight");
    await page.keyboard.press("Enter");
    await page.getByRole("grid").waitFor();
    await wait(1500);
    await page.getByRole("button", { name: "How it worked", exact: true }).click();
    return pressButton(page);
  });
}

if (!which || which === "flowboard") {
  await check("Flowboard, on the web", async (page, context) => {
    await context.route("https://api.open-meteo.com/**", async (route) => {
      await wait(450);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" },
        body: JSON.stringify({ current: { time: "2026-10-07T12:00", temperature_2m: 38.4, wind_speed_10m: 14.2 } }),
      });
    });
    await page.goto(`${FLOWBOARD}/`);
    await page.getByRole("button", { name: /Heat check/ }).click();
    await page.waitForURL(/\/flows\/[0-9a-f]+$/);
    await page.getByTestId("rf__node-getWeather").waitFor();
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await page.getByRole("tab", { name: /Run succeeded/ }).waitFor();
    return pressButton(page);
  });
}

if (!which || which === "agent-desk") {
  await check("Agent Desk, run on this machine", async (page, context) => {
    const recorded = JSON.parse(await readFile(new URL("../src/samples/agent-desk.json", import.meta.url), "utf8")).runs[0].envelope.data;
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, OPTIONS" };
    await context.route("http://127.0.0.1:8010/**", (route) => {
      const url = route.request().url();
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      if (url.includes(`/api/runs/${recorded.run.run_id}`)) return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(recorded) });
      if (url.endsWith("/api/stream")) return route.abort();
      return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: "{}" });
    });
    await page.goto(`${DESK}/runs/${recorded.run.run_id}`);
    await page.getByRole("heading", { level: 1, name: "Audit repositories" }).waitFor();
    return pressButton(page);
  });
}

await browser.close();
const failed = results.filter((result) => !result.ok);
console.log(failed.length === 0 ? `\nAll ${results.length} buttons worked.` : `\n${failed.length} of ${results.length} did not.`);
process.exitCode = failed.length === 0 ? 0 : 1;
