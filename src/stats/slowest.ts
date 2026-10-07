import { percentile } from "@/trace/format";
import type { SourceName, Span, Trace } from "@/trace/schema";

// The steps that took longest. Waiting for a person is left out: that is how
// long a person took, not how slow the app was. Steps that hold others are left
// out too, so a ten-second step is not listed beside the nine-second call in it.

export type SlowStep = {
  source: SourceName;
  name: string;
  /** How many times a step of this name ran, across the runs. */
  count: number;
  medianMs: number;
  /** The longest of them, and the run it was in. */
  slowest: { trace: Trace; span: Span };
};

export function slowestSteps(traces: Trace[], limit = 8): SlowStep[] {
  const groups = new Map<string, { source: SourceName; name: string; durations: number[]; slowest: { trace: Trace; span: Span } }>();
  for (const trace of traces) {
    const holders = new Set(trace.spans.map((span) => span.parentId).filter((id): id is string => id !== null));
    for (const span of trace.spans) {
      if (span.durationMs <= 0 || span.kind === "wait" || holders.has(span.id)) continue;
      const key = `${trace.source}|${span.name}`;
      const group = groups.get(key);
      if (!group) groups.set(key, { source: trace.source, name: span.name, durations: [span.durationMs], slowest: { trace, span } });
      else {
        group.durations.push(span.durationMs);
        if (span.durationMs > group.slowest.span.durationMs) group.slowest = { trace, span };
      }
    }
  }
  return [...groups.values()]
    .map((group) => ({ source: group.source, name: group.name, count: group.durations.length, medianMs: percentile(group.durations, 0.5) ?? 0, slowest: group.slowest }))
    .sort((a, b) => b.slowest.span.durationMs - a.slowest.span.durationMs || a.name.localeCompare(b.name))
    .slice(0, limit);
}
