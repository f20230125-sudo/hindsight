import { SOURCES, TRACE_STATUSES, type SourceName, type Trace, type TraceStatus } from "@/trace/schema";

/** How many runs there are for each choice a filter offers, counted before any filter is applied. */
export function countsOf(traces: Pick<Trace, "source" | "status" | "agent">[]) {
  const sources = Object.fromEntries(SOURCES.map((source) => [source, 0])) as Record<SourceName, number>;
  const statuses = Object.fromEntries(TRACE_STATUSES.map((status) => [status, 0])) as Record<TraceStatus, number>;
  const agents: Record<string, number> = {};
  for (const trace of traces) {
    sources[trace.source] += 1;
    statuses[trace.status] += 1;
    if (trace.agent) agents[trace.agent] = (agents[trace.agent] ?? 0) + 1;
  }
  return { sources, statuses, agents };
}
