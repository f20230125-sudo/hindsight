import { z } from "zod";
import sample from "@/samples/github-bot.json";
import { formatDate } from "@/trace/format";
import { traceSchema, type Trace } from "@/trace/schema";
import { adaptDeskRun } from "../agentdesk/adapt";
import type { Loaded } from "../loaded";
import { deskRunDetailSchema } from "../agentdesk/schema";
import { runsFromSnapshot } from "./snapshot";

// The GitHub bot's runs, read live from the file its scheduled job commits.
// When that file cannot be read, the copy recorded with this app is used
// instead, and says so.

export const SNAPSHOT_URL =
  process.env.HINDSIGHT_SNAPSHOT_URL ?? "https://raw.githubusercontent.com/f20230125-sudo/github-bot/main/frontend/public/showcase/snapshot.json";

/** The most the bot's snapshot lists, so every run its own site links to can be opened here. */
export const MAX_RUNS = 100;

export type { Loaded };

export type LoadDeps = {
  fetch: typeof fetch;
  now: () => Date;
  url?: string;
};

const sampleSchema = z.object({ recordedAt: z.string(), runs: z.array(deskRunDetailSchema) });

function tracesOf(runs: z.infer<typeof deskRunDetailSchema>[], how: "live" | "sample", at: string): Trace[] {
  const traces: Trace[] = [];
  for (const detail of runs) {
    const trace = adaptDeskRun(detail, { source: "github-bot", origin: { how, at } });
    // A run that does not come out as a valid trace is left out, not shown broken.
    if (traceSchema.safeParse(trace).success) traces.push(trace);
  }
  traces.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
  return traces.slice(0, MAX_RUNS);
}

/** The recorded copy, for when GitHub cannot be reached. */
export function loadRecorded(why: string): Loaded {
  const recorded = sampleSchema.parse(sample);
  return {
    traces: tracesOf(recorded.runs, "sample", recorded.recordedAt),
    how: "sample",
    at: recorded.recordedAt,
    note: `${why} These are the runs recorded on ${formatDate(recorded.recordedAt)}.`,
  };
}

export async function loadGithubBot({ fetch, now, url = SNAPSHOT_URL }: LoadDeps): Promise<Loaded> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    return loadRecorded("GitHub could not be reached.");
  }
  if (!response.ok) return loadRecorded(`GitHub answered ${response.status}.`);

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return loadRecorded("The bot's snapshot could not be read.");
  }

  const runs = runsFromSnapshot(data);
  if (!runs || runs.length === 0) return loadRecorded("The bot's snapshot held no runs Hindsight could read.");

  const at = now().toISOString();
  return { traces: tracesOf(runs, "live", at), how: "live", at, note: null };
}
