import { z } from "zod";
import agentDeskSample from "@/samples/agent-desk.json";
import flowboardSample from "@/samples/flowboard.json";
import saysoSample from "@/samples/sayso.json";
import { formatDate } from "@/trace/format";
import type { Trace } from "@/trace/schema";
import type { Loaded } from "./loaded";
import { readEnvelope } from "./receive";

// Real runs of the other three apps, recorded when Hindsight was built, so the
// list and the charts have something to show before anyone sends a run.
// scripts/record-apps.mjs made the Sayso and Flowboard ones by driving the
// apps in a browser; the Agent Desk one is a real audit by its backend.

const sampleFileSchema = z.object({
  recordedAt: z.string(),
  note: z.string(),
  runs: z.array(z.object({ label: z.string(), envelope: z.unknown() })),
});

const FILES = [saysoSample, flowboardSample, agentDeskSample];

let built: Loaded | null = null;

/** The recorded runs never change while the server runs, so they are read and adapted once. */
export function loadSamples(): Loaded {
  built ??= buildSamples();
  return built;
}

function buildSamples(): Loaded {
  const traces: Trace[] = [];
  let newest = "";
  for (const file of FILES) {
    const parsed = sampleFileSchema.parse(file);
    if (parsed.recordedAt > newest) newest = parsed.recordedAt;
    for (const run of parsed.runs) {
      const read = readEnvelope(run.envelope, "sample", parsed.recordedAt);
      // A recording that no longer reads is left out, not shown broken. The tests say which.
      if (read.ok) traces.push(read.trace);
    }
  }
  return {
    traces,
    how: "sample",
    at: newest,
    note: `Recorded from the real apps on ${formatDate(newest)}. Until a run is sent from an app, these stand in for it.`,
  };
}
