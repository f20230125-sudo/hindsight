import { describe, expect, it } from "vitest";
import { makeSpan, makeTrace } from "@/test/traces";
import { MIN_WINDOW_MS, START, fullWindow, paramsFromView, panned, reduceView, viewFromParams, windowAround, zoomed } from "./view";

const FULL = { from: 0, to: 10_000 };
const trace = makeTrace({ durationMs: 10_000, spans: [makeSpan("a"), makeSpan("b")] });

describe("zooming", () => {
  it("shows half as much of the run around a moment, keeping that moment where it is on the track", () => {
    // 5000 is half way along the track. After zooming in it is still half way.
    expect(zoomed(null, FULL, 0.5, 5000)).toEqual({ from: 2500, to: 7500 });
    // 1000 is a tenth of the way along. After zooming in it is still a tenth of the way along.
    const window = zoomed(null, FULL, 0.5, 1000)!;
    expect((1000 - window.from) / (window.to - window.from)).toBeCloseTo(0.1);
  });

  it("never goes past the ends of the run", () => {
    expect(zoomed(null, FULL, 0.1, 0)).toEqual({ from: 0, to: 1000 });
    expect(zoomed(null, FULL, 0.1, 10_000)).toEqual({ from: 9000, to: 10_000 });
    expect(zoomed({ from: 2000, to: 4000 }, FULL, 0.5, 2000)!.from).toBe(2000);
  });

  it("goes back to all of the run when it is zoomed out as far as it will go", () => {
    expect(zoomed({ from: 2500, to: 7500 }, FULL, 2, 5000)).toBeNull();
    expect(zoomed({ from: 2500, to: 7500 }, FULL, 4, 5000)).toBeNull();
  });

  it("stops at the least that is worth showing", () => {
    const window = zoomed({ from: 100, to: 120 }, FULL, 0.01, 110)!;
    expect(window.to - window.from).toBe(MIN_WINDOW_MS);
  });
});

describe("panning", () => {
  it("moves by a share of the window, and stops at the ends", () => {
    expect(panned({ from: 2000, to: 4000 }, FULL, 0.5)).toEqual({ from: 3000, to: 5000 });
    expect(panned({ from: 2000, to: 4000 }, FULL, -5)).toEqual({ from: 0, to: 2000 });
    expect(panned({ from: 8000, to: 10_000 }, FULL, 5)).toEqual({ from: 8000, to: 10_000 });
  });

  it("does nothing when all of the run is shown", () => {
    expect(panned(null, FULL, 0.5)).toBeNull();
  });
});

describe("a window around a span", () => {
  it("leaves a quarter of its length either side", () => {
    expect(windowAround(4000, 1000, FULL)).toEqual({ from: 3750, to: 5250 });
  });

  it("stays inside the run", () => {
    expect(windowAround(0, 400, FULL)).toEqual({ from: 0, to: 500 });
  });

  it("is all of the run when the span fills it", () => {
    expect(windowAround(0, 10_000, FULL)).toBeNull();
  });

  it("gives a moment a window it can be seen in", () => {
    const window = windowAround(500, 0, FULL)!;
    expect(window.to - window.from).toBeGreaterThanOrEqual(MIN_WINDOW_MS);
  });
});

describe("the view", () => {
  it("changes one thing at a time", () => {
    const view = reduceView(reduceView(reduceView(START, { type: "mode", mode: "agent" }), { type: "select", ids: ["a"] }), { type: "window", window: { from: 1, to: 9 } });
    expect(view).toEqual({ mode: "agent", window: { from: 1, to: 9 }, selected: ["a"], playhead: null });
    expect(reduceView(view, { type: "playhead", at: 5 }).playhead).toBe(5);
  });
});

describe("the address", () => {
  it("has nothing in it for the plain view", () => {
    expect(paramsFromView(START).toString()).toBe("");
  });

  it("holds the mode, the one span that is chosen, and the window, and not the playhead", () => {
    const text = paramsFromView({ mode: "agent", window: { from: 100.4, to: 900.6 }, selected: ["a"], playhead: 300 }).toString();
    expect(text).toBe("time=agent&span=a&from=100&to=901");
  });

  it("leaves out a choice of several marks", () => {
    expect(paramsFromView({ ...START, selected: ["a", "b"] }).toString()).toBe("");
  });

  it("reads back what it wrote", () => {
    const view = { mode: "agent" as const, window: { from: 100, to: 900 }, selected: ["a"], playhead: null };
    expect(viewFromParams(paramsFromView(view), trace)).toEqual(view);
  });

  it("ignores what does not fit the run", () => {
    const read = (query: string) => viewFromParams(new URLSearchParams(query), trace);
    expect(read("span=ghost").selected).toEqual([]);
    expect(read("time=sideways").mode).toBe("real");
    expect(read("from=-5&to=100").window).toBeNull();
    expect(read("from=100&to=99999").window).toBeNull();
    expect(read("from=500&to=502").window).toBeNull();
    expect(read("from=abc&to=def").window).toBeNull();
    expect(read("from=100").window).toBeNull();
  });

  it("does not keep a window that is all of the run", () => {
    expect(viewFromParams(new URLSearchParams("from=0&to=10000"), trace).window).toBeNull();
    expect(fullWindow(trace)).toEqual(FULL);
  });
});
