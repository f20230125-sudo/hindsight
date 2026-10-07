import type { Trace } from "@/trace/schema";
import type { Mode, Scale, Window } from "./scale";

// How a run is being looked at: in real time or agent time, how much of it is on
// the track, what is chosen, and where the playhead is. The mode, the window and
// the choice are kept in the address, so any view of a run is a link.

export type View = {
  mode: Mode;
  /** The part of the run on the track. Null for all of it. */
  window: Window | null;
  selected: string[];
  /** Where the playhead is, in milliseconds from the start of the run. Null when it is not shown. */
  playhead: number | null;
};

export const START: View = { mode: "real", window: null, selected: [], playhead: null };

/** The least of the run that can be on the track: zoomed in any further there would be nothing to see. */
export const MIN_WINDOW_MS = 5;

export const fullWindow = (trace: Trace): Window => ({ from: 0, to: trace.durationMs });

const sameWindow = (a: Window, b: Window) => Math.abs(a.from - b.from) < 0.5 && Math.abs(a.to - b.to) < 0.5;

/**
 * Shows less (factor under 1) or more (over 1) of what is on the track, about
 * its middle. `scale` is the track as it is now.
 *
 * It is worked out along the track, not in milliseconds. In real time the two
 * are the same. In agent time they are not: the middle of the run in
 * milliseconds is often inside a wait that has been squeezed to a sliver, and
 * zooming in on it would leave nothing but that wait on show.
 */
export function zoomed(scale: Scale, full: Window, factor: number): Window | null {
  // The whole run in the track's own measure, where 0 and 1 are the ends of what is on show now.
  const low = scale.x(full.from);
  const high = scale.x(full.to);
  const width = Math.min(high - low, factor);
  // About the middle, moved along where that would run past an end of the run.
  const left = Math.min(Math.max(low, 0.5 - width / 2), high - width);
  let from = Math.max(full.from, scale.ms(left));
  let to = Math.min(full.to, scale.ms(left + width));
  if (to - from < MIN_WINDOW_MS) {
    const middle = (from + to) / 2;
    from = Math.min(Math.max(full.from, middle - MIN_WINDOW_MS / 2), Math.max(full.from, full.to - MIN_WINDOW_MS));
    to = Math.min(full.to, from + MIN_WINDOW_MS);
  }
  const next = { from, to };
  return sameWindow(next, full) ? null : next;
}

/** Moves the window along the run by a share of its own width, and no further than the ends. */
export function panned(current: Window | null, full: Window, fraction: number): Window | null {
  if (!current) return null;
  const width = current.to - current.from;
  const from = Math.min(Math.max(full.from, current.from + fraction * width), full.to - width);
  return { from, to: from + width };
}

/** A window around a span, with some room either side. Null when that is all of the run. */
export function windowAround(start: number, length: number, full: Window): Window | null {
  const room = Math.max(length * 0.25, MIN_WINDOW_MS);
  const from = Math.max(full.from, start - room);
  let to = Math.min(full.to, start + length + room);
  if (to - from < MIN_WINDOW_MS) to = Math.min(full.to, from + MIN_WINDOW_MS);
  return sameWindow({ from, to }, full) ? null : { from, to };
}

export type ViewAction =
  | { type: "mode"; mode: Mode }
  | { type: "window"; window: Window | null }
  | { type: "select"; ids: string[] }
  | { type: "playhead"; at: number | null };

export function reduceView(view: View, action: ViewAction): View {
  switch (action.type) {
    case "mode":
      return { ...view, mode: action.mode };
    case "window":
      return { ...view, window: action.window };
    case "select":
      return { ...view, selected: action.ids };
    case "playhead":
      return { ...view, playhead: action.at };
  }
}

/** What goes in the address. What is not worth keeping (the playhead, a group of marks) is left out. */
export function paramsFromView(view: View): URLSearchParams {
  const params = new URLSearchParams();
  if (view.mode !== "real") params.set("time", view.mode);
  if (view.selected.length === 1) params.set("span", view.selected[0]);
  if (view.window) {
    params.set("from", String(Math.round(view.window.from)));
    params.set("to", String(Math.round(view.window.to)));
  }
  return params;
}

type Params = { get(name: string): string | null };

/** Reads a view out of an address, ignoring anything that does not fit the run. */
export function viewFromParams(params: Params, trace: Trace): View {
  const mode: Mode = params.get("time") === "agent" ? "agent" : "real";
  const span = params.get("span");
  const selected = span && trace.spans.some((entry) => entry.id === span) ? [span] : [];

  const from = Number(params.get("from"));
  const to = Number(params.get("to"));
  const full = fullWindow(trace);
  const valid = params.get("from") !== null && params.get("to") !== null && Number.isFinite(from) && Number.isFinite(to) && from >= full.from && to <= full.to && to - from >= MIN_WINDOW_MS;
  const window = valid && !sameWindow({ from, to }, full) ? { from, to } : null;

  return { mode, window, selected, playhead: null };
}
