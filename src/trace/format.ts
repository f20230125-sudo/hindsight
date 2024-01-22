// How times and durations are written, so every page says them the same way.

/** "under 1 ms", "218 ms", "2.03 s", "14.2 s", "1 min 12 s", "2 h 5 min". */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "unknown";
  if (ms < 1) return "under 1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  // Round on whole units, not on the float: 2025 ms is 2.03 s, though 2.025 is stored as 2.02499….
  if (ms < 10_000) return `${(Math.round(ms / 10) / 100).toFixed(2)} s`;
  if (ms < 60_000) return `${(Math.round(ms / 100) / 10).toFixed(1)} s`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** An axis label: "0", "500 ms", "2 s", "1 min 30 s". Whole numbers where it can, so ticks stay short. */
export function formatTick(ms: number): string {
  if (ms === 0) return "0";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${Number((ms / 1000).toFixed(2))} s`;
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
}

/** How far into a run something happened: "+0.28 s". */
export function formatOffset(ms: number): string {
  return ms < 1 ? "+0 ms" : `+${formatMs(ms)}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "3 h ago", "2 days ago". Older than a month gives the date. */
export function formatAgo(iso: string | null, now: number): string {
  if (!iso) return "unknown";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "unknown";
  const gap = now - then;
  if (gap < 0) return "just now";
  if (gap < MINUTE) return "just now";
  if (gap < HOUR) return `${Math.floor(gap / MINUTE)} min ago`;
  if (gap < DAY) return `${Math.floor(gap / HOUR)} h ago`;
  if (gap < 30 * DAY) {
    const days = Math.floor(gap / DAY);
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }
  return formatDate(iso);
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const clockFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export function formatDate(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "unknown" : dateFormat.format(at);
}

/** "5 Oct, 00:42" in the visitor's own time zone. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "unknown";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "unknown" : dateTimeFormat.format(at);
}

/** "00:42:31". */
export function formatClock(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "unknown" : clockFormat.format(at);
}

/** "1 call", "3 calls". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The middle value of a list of numbers, or null for none. */
export function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  // Linear interpolation between the two nearest ranks, so the median of two values is their mean.
  const rank = (sorted.length - 1) * Math.min(1, Math.max(0, fraction));
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}
