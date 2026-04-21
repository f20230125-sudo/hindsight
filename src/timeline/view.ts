import type { Trace } from "@/trace/schema";
import type { Mode, Window } from "./scale";

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

/** Shows less (factor under 1) or more (over 1) of the run, keeping the moment `around` where it is on the track. */
export function zoomed(current: Window | null, full: Window, factor: number, around: number): Window | null {
  const window = current ?? full;
  const width = Math.min(full.to - full.from, Math.max(MIN_WINDOW_MS, (window.to - window.from) * factor));
  // Keep the moment `around` at the same share of the track.
  const share = window.to > window.from ? (around - window.from) / (window.to - window.from) : 0.5;
  let from = around - share * width;
  from = Math.min(Math.max(full.from, from), full.to - width);
  const next = { from, to: from + width };
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
