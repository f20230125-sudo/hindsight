import { CATEGORY_OF, type Category } from "@/timeline/look";
import type { SourceName, Trace } from "@/trace/schema";

// Where the time of a run went, counted so that nothing is counted twice.
//
// Spans lie inside one another: a step of ten seconds holds a call of nine. Adding
// up every span would count that nine seconds twice. So the run is cut at every
// moment a bar begins or ends, and each piece belongs to one kind of time: the
// most specific one going on in it. A model call beats an API call, which beats
// waiting for a person, which beats the app's own steps. A piece in which no bar
// is going on is time between steps.

export type Share = Record<Category | "none", number>;

export const NO_TIME: Share = { model: 0, call: 0, wait: 0, own: 0, none: 0 };

/** The order in which one kind of time wins over another when they are going on together. */
const PRIORITY: Category[] = ["model", "call", "wait", "own"];

export function timeBy(trace: Trace): Share {
  const bars = trace.spans.filter((span) => span.durationMs > 0);
  const edges = new Set<number>([0, trace.durationMs]);
  for (const bar of bars) {
    edges.add(Math.min(trace.durationMs, bar.startMs));
    edges.add(Math.min(trace.durationMs, bar.startMs + bar.durationMs));
  }
  const cuts = [...edges].sort((a, b) => a - b);

  const share: Share = { ...NO_TIME };
  for (let index = 1; index < cuts.length; index += 1) {
    const from = cuts[index - 1];
    const to = cuts[index];
    const middle = (from + to) / 2;
    const going = new Set(bars.filter((bar) => bar.startMs <= middle && middle < bar.startMs + bar.durationMs).map((bar) => CATEGORY_OF[bar.kind]));
    const category = PRIORITY.find((candidate) => going.has(candidate)) ?? "none";
    share[category] += to - from;
  }
  return share;
}

export type SourceTime = { source: SourceName; runs: number; totalMs: number; share: Share };

/** The time of every run of each app added up, for the apps that have runs. */
export function timeBySource(traces: Trace[]): SourceTime[] {
  const bySource = new Map<SourceName, SourceTime>();
  for (const trace of traces) {
    const entry = bySource.get(trace.source) ?? { source: trace.source, runs: 0, totalMs: 0, share: { ...NO_TIME } };
    const share = timeBy(trace);
    entry.runs += 1;
    entry.totalMs += trace.durationMs;
    for (const key of Object.keys(share) as (keyof Share)[]) entry.share[key] += share[key];
    bySource.set(trace.source, entry);
  }
  return [...bySource.values()];
}
