// Records the runs of the GitHub bot's public snapshot as a sample file.
//
//   node scripts/record-github-bot.mjs [snapshot URL or local path]
//
// The live site reads the same file on every visit. This copy is what it falls
// back to when GitHub cannot be reached, and what the tests read, so they
// never touch the network.

import { readFile, writeFile } from "node:fs/promises";

const URL_DEFAULT = "https://raw.githubusercontent.com/f20230125-sudo/github-bot/main/frontend/public/showcase/snapshot.json";
const from = process.argv[2] ?? URL_DEFAULT;

const text = /^https?:/.test(from) ? await (await fetch(from)).text() : await readFile(from, "utf8");
const snapshot = JSON.parse(text);

const list = Object.entries(snapshot.routes).find(([key]) => key.startsWith("/api/runs?"))?.[1];
const runs = [];
for (const run of list?.runs ?? []) {
  const detail = snapshot.routes[`/api/runs/${run.run_id}`];
  if (detail?.run && Array.isArray(detail.events)) runs.push({ run: detail.run, events: detail.events });
}
runs.sort((a, b) => b.run.started_at.localeCompare(a.run.started_at));

const out = new URL("../src/samples/github-bot.json", import.meta.url);
await writeFile(out, `${JSON.stringify({ recordedAt: new Date().toISOString(), snapshotExportedAt: snapshot.exported_at, from, runs })}\n`);
console.log(`Saved ${runs.length} runs (${runs.reduce((sum, entry) => sum + entry.events.length, 0)} events) from the snapshot exported ${snapshot.exported_at}.`);
