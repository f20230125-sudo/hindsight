import { scaleLinear } from "d3-scale";
import type { Span } from "@/trace/schema";

// Where a moment falls along the track.
//
// In real time the track is a straight line: twice the time, twice the width.
// That hides what the app did, in a run where a person took four seconds to
// choose a seat and the app took a tenth of a second to answer. In agent time
// each stretch of waiting for a person is squeezed to a narrow gap, and the
// rest of the track is left as it is, so the app's own time fills the picture.
// The gap is marked as a break, with the real time written on it.
//
// A scale is a piecewise straight line: a list of stretches, each with a
// weight, and a position is the weight up to that moment over the total.
// Zooming picks a window of real time and stretches it across the track.

export type Mode = "real" | "agent";

export type Window = { from: number; to: number };

type Stretch = { from: number; to: number; weight: number; squeezed: boolean };

export type Break = { from: number; to: number; x0: number; x1: number };

export type Scale = {
  mode: Mode;
  /** The part of the run on the track, in milliseconds from its start. */
  window: Window;
  /** Where a time falls along the track: 0 at the left of the window, 1 at the right. Outside the window it falls outside 0 to 1. */
  x(ms: number): number;
  /** The time at a position along the track. The inverse of x. */
  ms(x: number): number;
  /** The squeezed stretches that are in the window, with where they fall. */
  breaks: Break[];
};

/** A squeezed wait is as wide as this share of the work around it, within these limits (milliseconds of weight). */
const SQUEEZE_SHARE = 0.15;
const SQUEEZE_MIN_MS = 80;
const SQUEEZE_MAX_MS = 2000;

/** The stretches of the run where a person was being waited for, joined where they overlap. */
export function waitsOf(spans: Span[], durationMs: number): { from: number; to: number }[] {
  const waits = spans
    .filter((span) => span.kind === "wait" && span.durationMs > 0)
    .map((span) => ({ from: Math.max(0, span.startMs), to: Math.min(durationMs, span.startMs + span.durationMs) }))
    .filter((wait) => wait.to > wait.from)
    .sort((a, b) => a.from - b.from);
  const joined: { from: number; to: number }[] = [];
  for (const wait of waits) {
    const last = joined.at(-1);
    if (last && wait.from <= last.to) last.to = Math.max(last.to, wait.to);
    else joined.push({ ...wait });
  }
  return joined;
}

function stretchesOf(spans: Span[], durationMs: number, mode: Mode): Stretch[] {
  if (durationMs <= 0) return [{ from: 0, to: 0, weight: 1, squeezed: false }];
  if (mode === "real") return [{ from: 0, to: durationMs, weight: durationMs, squeezed: false }];

  const waits = waitsOf(spans, durationMs);
  if (waits.length === 0) return [{ from: 0, to: durationMs, weight: durationMs, squeezed: false }];

  const work = durationMs - waits.reduce((sum, wait) => sum + (wait.to - wait.from), 0);
  const width = Math.min(SQUEEZE_MAX_MS, Math.max(SQUEEZE_MIN_MS, work * SQUEEZE_SHARE));

  const stretches: Stretch[] = [];
  let at = 0;
  for (const wait of waits) {
    if (wait.from > at) stretches.push({ from: at, to: wait.from, weight: wait.from - at, squeezed: false });
    const length = wait.to - wait.from;
    // A wait shorter than the squeezed width is left as it is: squeezing it would make it longer.
    const squeezed = length > width;
    stretches.push({ from: wait.from, to: wait.to, weight: squeezed ? width : length, squeezed });
    at = wait.to;
  }
  if (at < durationMs) stretches.push({ from: at, to: durationMs, weight: durationMs - at, squeezed: false });
  return stretches;
}

export function makeScale(spans: Span[], durationMs: number, mode: Mode, window: Window = { from: 0, to: durationMs }): Scale {
  const stretches = stretchesOf(spans, durationMs, mode);

  /** The weight of the run up to a time. */
  const upTo = (ms: number): number => {
    let total = 0;
    for (const stretch of stretches) {
      if (ms >= stretch.to) total += stretch.weight;
      else if (ms > stretch.from) total += (stretch.weight * (ms - stretch.from)) / (stretch.to - stretch.from);
    }
    // Before the start or after the end, a time is as far out as it would be on a straight line.
    const first = stretches[0];
    const last = stretches.at(-1)!;
    if (ms < first.from) total -= ((first.from - ms) * first.weight) / Math.max(1, first.to - first.from);
    if (ms > last.to) total += ((ms - last.to) * last.weight) / Math.max(1, last.to - last.from);
    return total;
  };

  /** The time at a weight. The inverse of upTo. */
  const at = (weight: number): number => {
    let before = 0;
    for (const stretch of stretches) {
      if (weight <= before + stretch.weight || stretch === stretches.at(-1)) {
        const share = stretch.weight === 0 ? 0 : (weight - before) / stretch.weight;
        return stretch.from + share * (stretch.to - stretch.from);
      }
      before += stretch.weight;
    }
    return 0;
  };

  const low = upTo(window.from);
  const span = upTo(window.to) - low;
  const x = (ms: number) => (span === 0 ? 0 : (upTo(ms) - low) / span);

  return {
    mode,
    window,
    x,
    ms: (position) => at(low + position * span),
    breaks: stretches
      .filter((stretch) => stretch.squeezed && stretch.to > window.from && stretch.from < window.to)
      .map((stretch) => ({
        from: stretch.from,
        to: stretch.to,
        x0: Math.max(0, x(stretch.from)),
        x1: Math.min(1, x(stretch.to)),
      })),
  };
}

export type Tick = { ms: number; x: number };

/**
 * Round times to label the axis. Across a squeezed wait no time is labelled,
 * because a thousand milliseconds of it take no room: its two ends are.
 */
export function axisTicks(scale: Scale, widthPx: number, minGapPx = 72): Tick[] {
  const { from, to } = scale.window;
  if (to <= from) return [{ ms: from, x: 0 }];

  const inBreak = (ms: number) => scale.breaks.some((gap) => ms > gap.from && ms < gap.to);
  const nice = scaleLinear().domain([from, to]).ticks(Math.max(3, Math.round(widthPx / 60)));
  const ends = scale.breaks.flatMap((gap) => [gap.from, gap.to]).filter((ms) => ms >= from && ms <= to);

  const candidates = [...new Set([from, ...nice, ...ends])].filter((ms) => !inBreak(ms)).sort((a, b) => a - b);

  const kept: Tick[] = [];
  for (const ms of candidates) {
    const position = scale.x(ms);
    const last = kept.at(-1);
    if (last === undefined || (position - last.x) * widthPx >= minGapPx) kept.push({ ms, x: position });
  }
  return kept.filter((tick) => tick.x >= -0.0001 && tick.x <= 1.0001);
}
