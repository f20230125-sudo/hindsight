import type { Trace } from "./schema";

/**
 * One list out of several: a run that appears twice (read live, and also
 * sent by its app) is kept once, as the copy picked up last. Newest runs
 * first; runs with no start time go at the end.
 */
export function mergeTraces(...lists: Trace[][]): Trace[] {
  const byId = new Map<string, Trace>();
  for (const trace of lists.flat()) {
    const kept = byId.get(trace.id);
    if (!kept || trace.origin.at >= kept.origin.at) byId.set(trace.id, trace);
  }
  return [...byId.values()].sort((a, b) => {
    if (a.startedAt === b.startedAt) return a.id.localeCompare(b.id);
    if (a.startedAt === null) return 1;
    if (b.startedAt === null) return -1;
    return b.startedAt.localeCompare(a.startedAt);
  });
}
