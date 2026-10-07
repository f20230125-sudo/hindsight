import { percentile } from "@/trace/format";
import type { Trace } from "@/trace/schema";

export type Summary = {
  runs: number;
  /** Runs that have an outcome: not still going, and not waiting for a person. */
  finished: number;
  /** The share of finished runs that succeeded, 0 to 1. Null when none has finished. */
  successRate: number | null;
  medianMs: number | null;
  /** The length that nine runs in ten stay under. */
  slowMs: number | null;
  /** Runs that called a model at least once. */
  modelRuns: number;
  failedCalls: number;
};

export function summarise(traces: Trace[]): Summary {
  const finished = traces.filter((trace) => trace.status === "ok" || trace.status === "failed" || trace.status === "stopped");
  const durations = traces.map((trace) => trace.durationMs);
  return {
    runs: traces.length,
    finished: finished.length,
    successRate: finished.length === 0 ? null : finished.filter((trace) => trace.status === "ok").length / finished.length,
    medianMs: percentile(durations, 0.5),
    slowMs: percentile(durations, 0.9),
    modelRuns: traces.filter((trace) => trace.totals.modelCalls > 0).length,
    failedCalls: traces.reduce((sum, trace) => sum + trace.totals.failures, 0),
  };
}
