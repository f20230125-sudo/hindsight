import { describe, expect, it } from "vitest";
import { makeSpan, makeTrace } from "@/test/traces";
import { makeScale, type Window } from "./scale";
import { MIN_WINDOW_MS, START, fullWindow, paramsFromView, panned, reduceView, viewFromParams, windowAround, zoomed } from "./view";

const FULL = { from: 0, to: 10_000 };
const trace = makeTrace({ durationMs: 10_000, spans: [makeSpan("a"), makeSpan("b")] });

describe("zooming", () => {
  /** The track in real time, with this much of the run on it. */
  const real = (window?: Window) => makeScale([], 10_000, "real", window);

  it("shows half as much of the run, about the middle of what is on the track", () => {
    expect(zoomed(real(), FULL, 0.5)).toEqual({ from: 2500, to: 7500 });
    expect(zoomed(real({ from: 2500, to: 7500 }), FULL, 0.5)).toEqual({ from: 3750, to: 6250 });
    expect(zoomed(real({ from: 0, to: 1000 }), FULL, 0.5)).toEqual({ from: 250, to: 750 });
  });

  it("shows twice as much, and never goes past the ends of the run", () => {
    expect(zoomed(real({ from: 4000, to: 6000 }), FULL, 2)).toEqual({ from: 3000, to: 7000 });
    // At an end there is no more that way, so the rest is taken from the other side.
    expect(zoomed(real({ from: 0, to: 1000 }), FULL, 2)).toEqual({ from: 0, to: 2000 });
    expect(zoomed(real({ from: 9000, to: 10_000 }), FULL, 2)).toEqual({ from: 8000, to: 10_000 });
  });

  it("goes back to all of the run when it is zoomed out as far as it will go", () => {
    expect(zoomed(real({ from: 2500, to: 7500 }), FULL, 2)).toBeNull();
    expect(zoomed(real({ from: 2500, to: 7500 }), FULL, 4)).toBeNull();
  });

  it("stops at the least that is worth showing", () => {
    const window = zoomed(real({ from: 100, to: 120 }), FULL, 0.01)!;
    expect(window.to - window.from).toBe(MIN_WINDOW_MS);
    expect((window.from + window.to) / 2).toBe(110);
    // A run shorter than that is always shown whole.
    expect(zoomed(makeScale([], 3, "real"), { from: 0, to: 3 }, 0.5)).toBeNull();
  });

  describe("in agent time", () => {
    // A second of work, four seconds of a person choosing, a second of work: the
    // wait is squeezed to 300 ms of track, so the track is 2300 wide in all.
    const spans = [makeSpan("first", { kind: "tool", startMs: 0, durationMs: 1000 }), makeSpan("choose", { kind: "wait", startMs: 1000, durationMs: 4000 }), makeSpan("second", { kind: "tool", startMs: 5000, durationMs: 1000 })];
    const whole = { from: 0, to: 6000 };
    const agent = (window?: Window) => makeScale(spans, 6000, "agent", window);

    it("keeps the middle of the picture in the middle, with the work either side of the wait still on show", () => {
      const window = zoomed(agent(), whole, 0.5)!;
      // The middle half of a track 2300 wide runs from 575 to 1725 along it: 575 ms into the first second of work, and 425 ms into the last.
      expect(window.from).toBeCloseTo(575);
      expect(window.to).toBeCloseTo(5425);
      // What was a quarter and three quarters of the way along are now the two ends.
      const zoomedIn = agent(window);
      expect(zoomedIn.x(window.from)).toBe(0);
      expect(agent().x(window.from)).toBeCloseTo(0.25);
      expect(agent().x(window.to)).toBeCloseTo(0.75);
      // Measured in milliseconds the middle half would be 1500 to 4500: nothing but the wait.
      expect(window.from).toBeLessThan(1000);
      expect(window.to).toBeGreaterThan(5000);
    });

    it("comes back out to the same picture", () => {
      const inside = zoomed(agent(), whole, 0.5)!;
      expect(zoomed(agent(inside), whole, 2)).toBeNull();
    });
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
