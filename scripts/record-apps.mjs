// Records real runs from Sayso and Flowboard, for the samples Hindsight shows
// until a visitor sends their own.
//
//   node scripts/record-apps.mjs [sayso|flowboard]
//
// Both apps must be running (production builds are best):
//   Sayso      http://127.0.0.1:3030   (npm run start in its folder)
//   Flowboard  http://127.0.0.1:3020
//
// A browser drives each app the way a person would, with pauses between
// actions, and presses its "Open in Hindsight" button. Hindsight's own page is
// stood in for, at the address the apps send to, so what the apps hand over is
// captured exactly as it would arrive. Nothing here is typed by hand.
//
// What is real and what is not: the apps, their code, their journeys and the
// times are real. The outside services they call (the weather, a model, a
// ticket system) are answered by stand-ins, after a delay, so the recording
// needs no keys and no network and is repeatable.

import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const SAYSO = process.env.SAYSO_URL ?? "http://127.0.0.1:3030";
const FLOWBOARD = process.env.FLOWBOARD_URL ?? "http://127.0.0.1:3020";
const HINDSIGHT = process.env.HINDSIGHT_URL ?? "https://hindsight-sand.vercel.app";
const OUT = new URL("../src/samples/", import.meta.url);

const which = process.argv[2];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STAND_IN = `<!doctype html><title>Hindsight</title><script>
  window.addEventListener("message", (event) => {
    window.__received = event.data;
    window.opener.postMessage({ type: "hindsight:received" }, event.origin);
  });
  window.opener.postMessage({ type: "hindsight:ready" }, "*");
</script>`;

const browser = await chromium.launch();

/** A fresh browser, so each recording starts from the app as a new visitor finds it. */
async function visitor(setup) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Dubai", deviceScaleFactor: 1 });
  await context.route(`${HINDSIGHT}/open`, (route) => route.fulfill({ contentType: "text/html", body: STAND_IN }));
  const page = await context.newPage();
  await setup?.(page, context);
  return { page, context };
}

/** Presses the app's button and takes what it hands to Hindsight. */
async function capture(page) {
  const opened = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open in Hindsight" }).click();
  const popup = await opened;
  await popup.waitForFunction(() => window.__received !== undefined);
  const envelope = await popup.evaluate(() => window.__received);
  await popup.close();
  return envelope;
}

const slowly = (ms, handler) => async (route) => {
  await wait(ms);
  return handler(route);
};

// --- Sayso --------------------------------------------------------------------

async function say(page, words) {
  await page.getByLabel("Say what you need").fill(words);
  await page.keyboard.press("Enter");
}

const grid = (page) => page.getByRole("grid");
const price = (page) => page.getByRole("region", { name: "Price summary" });
const receipt = (page) => page.getByRole("region", { name: "Receipt" });

async function chooseWindowSeat(page) {
  await grid(page).waitFor();
  await wait(2300);
  await page.getByRole("button", { name: /window, free/ }).nth(2).click();
  await wait(1100);
  await page.getByRole("button", { name: /^Choose \d/ }).click();
}

async function payAndWaitForReceipt(page) {
  await price(page).waitFor();
  await wait(1800);
  await price(page).getByRole("button", { name: /^Pay / }).click();
  await receipt(page).waitFor();
  await wait(700);
}

async function openPanel(page) {
  await page.getByRole("button", { name: "How it worked", exact: true }).click();
  await page.getByRole("complementary", { name: "How it worked" }).waitFor();
}

async function openSayso(page) {
  await page.goto(SAYSO);
  await page.getByRole("heading", { name: /^Hello,/ }).waitFor();
  await wait(1200);
}

const MODEL = "gemini-3.5-flash-lite";

const saysoJourneys = {
  "a window seat, paid for": async (page) => {
    await say(page, "a window seat on my London flight");
    await chooseWindowSeat(page);
    await payAndWaitForReceipt(page);
  },
  "waiting at the seat map": async (page) => {
    // Captured while the desk is still waiting for the traveller to choose.
    await say(page, "a window seat on my London flight");
    await grid(page).waitFor();
    await wait(3200);
  },
  "three requests in one sentence": async (page) => {
    await say(page, "Move my London flight to next week, window seat, and add a bag");
    const days = page.getByRole("region", { name: "Days to choose from" });
    await days.waitFor();
    await wait(2000);
    await days.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d/ }).nth(2).click();
    const flights = page.getByRole("list", { name: "Flights to choose from" });
    await flights.waitFor();
    await wait(1700);
    await flights.getByRole("button").first().click();
    await chooseWindowSeat(page);
    await payAndWaitForReceipt(page);
  },
  "left unfinished": async (page) => {
    await say(page, "a window seat on my London flight");
    await grid(page).waitFor();
    await wait(2600);
    await say(page, "never mind");
    await page.getByText(/Left unfinished/).waitFor();
    await wait(500);
  },
  "a call that failed": async (page) => {
    await page.route("**/api/flights/*/seats", slowly(420, (route) => route.fulfill({ status: 500, json: { error: { code: "server_error", message: "The seat map could not be loaded." } } })));
    await say(page, "a window seat on my London flight");
    await page.getByRole("button", { name: "Try again" }).waitFor();
    await wait(1200);
  },
  "a call that failed, tried again": async (page) => {
    let calls = 0;
    await page.route("**/api/flights/*/seats", async (route) => {
      calls += 1;
      if (calls === 1) {
        await wait(420);
        return route.fulfill({ status: 500, json: { error: { code: "server_error", message: "The seat map could not be loaded." } } });
      }
      return route.continue();
    });
    await say(page, "a window seat on my London flight");
    await page.getByRole("button", { name: "Try again" }).waitFor();
    await wait(1800);
    await page.getByRole("button", { name: "Try again" }).click();
    await chooseWindowSeat(page);
    await payAndWaitForReceipt(page);
  },
  "words it could not read": async (page) => {
    await say(page, "sing me a song");
    await page.getByText(/I did not understand|not sure what/i).first().waitFor();
    await wait(400);
  },
  "small talk": async (page) => {
    await say(page, "hello");
    await page.getByText(/^Hello\. Say what you need/).waitFor();
    await wait(400);
  },
  "a question about the account": async (page) => {
    await say(page, "How much have I spent this year?");
    await page.getByText(/You have spent AED/).waitFor();
    await wait(600);
  },
  "a flight cancelled and refunded": async (page) => {
    await say(page, "cancel my Istanbul trip");
    const refund = page.getByRole("button", { name: /^Cancel booking, refund AED/ });
    await refund.waitFor();
    await wait(2400);
    await refund.click();
    await page.getByText("Your booking is cancelled.").waitFor();
    await wait(600);
  },
  "read by a model": async (page) => {
    // A saved model, and a stand-in for the provider that answers after a moment, as a real one does.
    await page.route("https://generativelanguage.googleapis.com/**", slowly(1150, (route) =>
      route.fulfill({ status: 200, json: { choices: [{ message: { content: JSON.stringify({ kind: "request", intents: [{ journey: "seat", wish: "window", trip: "K7QM2P" }] }) } }] } }),
    ));
    await say(page, "I'd love to look out at the clouds on the way to London");
    await chooseWindowSeat(page);
    await payAndWaitForReceipt(page);
  },
};

async function recordSayso() {
  const runs = [];
  for (const [name, journey] of Object.entries(saysoJourneys)) {
    const { page, context } = await visitor(async (p) => {
      if (name === "read by a model") {
        await p.addInitScript(
          ([key, value]) => window.localStorage.setItem(key, value),
          ["sayso:ai", JSON.stringify({ provider: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", apiKey: "stand-in-key", model: MODEL })],
        );
      }
    });
    await openSayso(page);
    await journey(page);
    await openPanel(page);
    const envelope = await capture(page);
    runs.push({ label: name, envelope });
    console.log(`Sayso: ${name} (${envelope.data.status ?? "no run"}, ${envelope.data.log.length} things logged)`);
    await context.close();
  }
  return runs;
}

// --- Flowboard ----------------------------------------------------------------

const json = (status, body) => ({
  status,
  contentType: "application/json",
  headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" },
  body: JSON.stringify(body),
});

async function stubApis(context, { weather = { current: { time: "2026-10-07T12:00", temperature_2m: 38.4, wind_speed_10m: 14.2 } }, weatherStatus = 200 } = {}) {
  await context.route("https://api.open-meteo.com/**", slowly(520, (route) => route.fulfill(json(weatherStatus, weather))));
  await context.route("https://jsonplaceholder.typicode.com/**", slowly(380, (route) => route.fulfill(json(201, { id: 101 }))));
  await context.route("https://api.groq.com/**", (route) => route.fulfill({ status: 204, headers: json(200, {}).headers }));
}

async function openTemplate(page, name, firstBlock) {
  await page.goto(`${FLOWBOARD}/`);
  await page.getByRole("button", { name }).click();
  await page.waitForURL(/\/flows\/[0-9a-f]+$/);
  await page.getByTestId(`rf__node-${firstBlock}`).waitFor();
  await wait(1500);
}

const runButton = (page) => page.getByRole("button", { name: "Run", exact: true });

const flowboardFlows = {
  "heat check, hot day": async (page, context) => {
    await stubApis(context);
    await openTemplate(page, /Heat check/, "getWeather");
    await runButton(page).click();
    await page.getByRole("tab", { name: /Run succeeded/ }).waitFor();
  },
  "heat check, mild day": async (page, context) => {
    await stubApis(context, { weather: { current: { time: "2026-10-07T12:00", temperature_2m: 24.1, wind_speed_10m: 9.8 } } });
    await openTemplate(page, /Heat check/, "getWeather");
    await runButton(page).click();
    await page.getByRole("tab", { name: /Run succeeded/ }).waitFor();
  },
  "heat check, the weather service down": async (page, context) => {
    await stubApis(context, { weather: { error: "Service Unavailable" }, weatherStatus: 503 });
    await openTemplate(page, /Heat check/, "getWeather");
    await runButton(page).click();
    await page.getByRole("tab", { name: /Run failed/ }).waitFor();
  },
  "support ticket triage with the sample reply": async (page, context) => {
    await stubApis(context);
    await openTemplate(page, /Support ticket triage/, "classify");
    await runButton(page).click();
    await page.getByRole("tab", { name: /Run succeeded/ }).waitFor();
  },
  "a wait that was stopped": async (page, context) => {
    await stubApis(context);
    await page.goto(`${FLOWBOARD}/`);
    await page.getByRole("button", { name: "New flow" }).click();
    await page.waitForURL(/\/flows\//);
    await page.locator(".react-flow__node").first().click();
    await page.getByRole("button", { name: "Add Delay" }).click();
    await page.getByLabel("Wait (ms)").fill("60000");
    await page.getByLabel("Wait (ms)").blur();
    await wait(1200);
    await runButton(page).click();
    await page.locator(".react-flow__node", { hasText: "wait1" }).getByText("Running").waitFor();
    await wait(2400);
    await page.getByRole("button", { name: "Stop" }).click();
    await page.getByRole("tab", { name: /Run stopped/ }).waitFor();
  },
};

async function recordFlowboard() {
  const runs = [];
  for (const [name, flow] of Object.entries(flowboardFlows)) {
    const { page, context } = await visitor();
    await flow(page, context);
    await wait(400);
    const envelope = await capture(page);
    runs.push({ label: name, envelope });
    console.log(`Flowboard: ${name} (${envelope.data.run.status}, ${envelope.data.run.steps.length} blocks)`);
    await context.close();
  }
  return runs;
}

// --- Out ----------------------------------------------------------------------

async function save(file, app, runs) {
  await mkdir(OUT, { recursive: true });
  const body = {
    app,
    recordedAt: new Date().toISOString(),
    note: "Recorded by scripts/record-apps.mjs from the running app, in a browser. The services the app calls (weather, ticket system, model provider) were answered by stand-ins.",
    runs,
  };
  await writeFile(new URL(file, OUT), `${JSON.stringify(body)}\n`);
  console.log(`Saved ${runs.length} runs to src/samples/${file}`);
}

try {
  if (!which || which === "sayso") await save("sayso.json", "sayso", await recordSayso());
  if (!which || which === "flowboard") await save("flowboard.json", "flowboard", await recordFlowboard());
} finally {
  await browser.close();
}
