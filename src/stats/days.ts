import type { Trace, TraceStatus } from "@/trace/schema";

// Runs by the day they began, in the viewer's own time zone.

/** "2026-10-07", the day an instant falls on where the viewer is. Null for no time, or a bad one. */
export function dayOf(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

const nextDay = (day: string): string => {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(year, month - 1, date + 1);
  return dayOf(next.toISOString())!;
};

export type Day = {
  day: string;
  counts: Record<TraceStatus, number>;
  total: number;
};

const emptyCounts = (): Record<TraceStatus, number> => ({ ok: 0, failed: 0, stopped: 0, waiting: 0, running: 0 });

/**
 * One entry for each day from the first run to the last, a day with no run
 * included, so a gap in the chart is a gap in time. At most `limit` days: the latest.
 */
export function byDay(traces: Trace[], limit = 21): Day[] {
  const days = new Map<string, Day>();
  for (const trace of traces) {
    const day = dayOf(trace.startedAt);
    if (!day) continue;
    const entry = days.get(day) ?? { day, counts: emptyCounts(), total: 0 };
    entry.counts[trace.status] += 1;
    entry.total += 1;
    days.set(day, entry);
  }
  if (days.size === 0) return [];

  const sorted = [...days.keys()].sort();
  const all: Day[] = [];
  for (let day = sorted[0]; day <= sorted.at(-1)!; day = nextDay(day)) all.push(days.get(day) ?? { day, counts: emptyCounts(), total: 0 });
  return all.slice(-limit);
}
