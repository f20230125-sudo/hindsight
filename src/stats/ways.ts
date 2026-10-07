import { SOURCES, type SourceName, type Trace } from "@/trace/schema";

/** How many runs of one app reached Hindsight each way. */
export type Ways = { live: number; recorded: number; sent: number; file: number };

/** For each app, how its runs got here: read live, from a recording, sent from the app, or dropped as a file. */
export function waysOf(traces: Trace[]): Record<SourceName, Ways> {
  const ways = Object.fromEntries(SOURCES.map((source) => [source, { live: 0, recorded: 0, sent: 0, file: 0 }])) as Record<SourceName, Ways>;
  for (const trace of traces) {
    const way = trace.origin.how === "sample" ? "recorded" : trace.origin.how;
    ways[trace.source][way] += 1;
  }
  return ways;
}
