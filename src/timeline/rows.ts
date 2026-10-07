import { scaleLinear } from "d3-scale";
import type { Span, Trace } from "@/trace/schema";

// Turning a run's flat list of spans into the rows of the timeline.
//
// A span with some length is a bar and gets a row, indented under the span
// that holds it. A span with no length is a marker: something that happened
// at a moment. Markers are drawn on the row of the span they belong to, or on
// the top row of the run when nothing holds them.

export type Row = {
  span: Span;
  depth: number;
  markers: Span[];
};

export type Layout = {
  /** Markers that no bar holds. */
  top: Span[];
  rows: Row[];
};

const byStart = (a: Span, b: Span) => a.startMs - b.startMs;

export function layoutOf(trace: Trace): Layout {
  const children = new Map<string | null, Span[]>();
  for (const span of trace.spans) {
    const list = children.get(span.parentId) ?? [];
    list.push(span);
    children.set(span.parentId, list);
  }
  const held = (id: string | null) => [...(children.get(id) ?? [])].sort(byStart);

  // A span that holds others is a bar, even when it has no length itself.
  const isBar = (span: Span) => span.durationMs > 0 || (children.get(span.id)?.length ?? 0) > 0;

  const rows: Row[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const span of held(parentId)) {
      if (!isBar(span)) continue;
      rows.push({ span, depth, markers: held(span.id).filter((child) => !isBar(child)) });
      visit(span.id, depth + 1);
    }
  };
  visit(null, 0);

  return { top: held(null).filter((span) => !isBar(span)), rows };
}

export type Cluster = {
  /** Where the first of them happened. */
  at: number;
  items: Span[];
};

/**
 * Markers that would sit on top of each other are drawn as one, with a count.
 * `positionPx` says where a time falls on the track in pixels, so this holds
 * for any scale; markers closer than `gapPx` to the first of a group join it.
 */
export function clusterMarkers(markers: Span[], positionPx: (ms: number) => number, gapPx: number): Cluster[] {
  const clusters: Cluster[] = [];
  for (const marker of [...markers].sort(byStart)) {
    const last = clusters.at(-1);
    if (last && positionPx(marker.startMs) - positionPx(last.at) < gapPx) last.items.push(marker);
    else clusters.push({ at: marker.startMs, items: [marker] });
  }
  return clusters;
}

export type Place = { row: number; col: number };

/**
 * Where the arrow keys can stand: a row, and a bar or mark on it. `counts` says
 * how many of those each row has on show. A row can have none, when the part of
 * the run on the track does not reach it, and such a row cannot be stood on: the
 * nearest row that can is taken, looking the way the key was going first, and
 * the other way if there is nothing that way.
 */
export function placeOn(counts: number[], row: number, col: number, direction: 1 | -1 = 1): Place {
  const start = Math.max(0, Math.min(counts.length - 1, row));
  const nearest = (from: number, step: 1 | -1): number | null => {
    for (let at = from; at >= 0 && at < counts.length; at += step) if (counts[at] > 0) return at;
    return null;
  };
  const found = nearest(start, direction) ?? nearest(start - direction, direction === 1 ? -1 : 1) ?? start;
  return { row: found, col: Math.max(0, Math.min((counts[found] ?? 0) - 1, col)) };
}

/** Round numbers to put on the time axis, from 0 to the end of the run. */
export function ticksFor(durationMs: number, target = 6): number[] {
  if (durationMs <= 0) return [0];
  return scaleLinear().domain([0, durationMs]).ticks(target);
}

/** Where a time falls along the track, as a percentage of its width. */
export function percentOf(ms: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.min(100, Math.max(0, (ms / durationMs) * 100));
}
