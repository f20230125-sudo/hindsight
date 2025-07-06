import type { Trace, TraceStatus } from "@/trace/schema";

// Runs by the day they began, in the viewer's own time zone.

/**
 * "2026-10-07", the day an instant falls on where the viewer is. Null for no
 * time, a bad one, or a year that is not four digits, which no run has and
 * which would not sort as text.
 */
export function dayOf(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const year = at.getFullYear();
  if (year < 1000 || year > 9999) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${year}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

const dayBefore = (day: string): string => {
  const [year, month, date] = day.split("-").map(Number);
  const pad = (value: number) => String(value).padStart(2, "0");
  // Worked out on the calendar, so a day that is 23 or 25 hours long is still one day.
  const before = new Date(year, month - 1, date - 1);
  return `${before.getFullYear()}-${pad(before.getMonth() + 1)}-${pad(before.getDate())}`;
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
  const first = sorted[0];
  // Walked back from the last day, and no further than the limit: one run dated
  // years from the rest must not make this count every day in between.
  const all: Day[] = [];
  for (let day = sorted.at(-1)!; all.length < limit && day >= first; day = dayBefore(day)) all.unshift(days.get(day) ?? { day, counts: emptyCounts(), total: 0 });
  return all;
}
