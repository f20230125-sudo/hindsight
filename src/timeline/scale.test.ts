import { describe, expect, it } from "vitest";
import { z } from "zod";
import saysoSample from "@/samples/sayso.json";
import { adaptSayso } from "@/sources/sayso/adapt";
import { saysoRunSchema } from "@/sources/sayso/schema";
import { makeSpan } from "@/test/traces";
import { axisTicks, makeScale, waitsOf } from "./scale";

// A run of 6000 ms in which a person took 4000 ms to choose, between two bursts
// of the app's work of 1000 ms each.
const spans = [
  makeSpan("first", { kind: "tool", startMs: 0, durationMs: 1000 }),
  makeSpan("choose", { kind: "wait", startMs: 1000, durationMs: 4000 }),
  makeSpan("second", { kind: "tool", startMs: 5000, durationMs: 1000 }),
];
const DURATION = 6000;

describe("real time", () => {
  const scale = makeScale(spans, DURATION, "real");

  it("is a straight line from the start of the run to its end", () => {
    expect([0, 1500, 3000, 6000].map((ms) => scale.x(ms))).toEqual([0, 0.25, 0.5, 1]);
    expect(scale.ms(0.25)).toBe(1500);
    expect(scale.breaks).toEqual([]);
  });
});

describe("agent time", () => {
  const scale = makeScale(spans, DURATION, "agent");

  it("squeezes each wait for a person to a share of the work around it, and leaves the work alone", () => {
    // Two seconds of work, so a squeezed wait is 15% of that: 300 ms.
    const squeezed = 2000 * 0.15;
    const total = 2000 + squeezed;
    expect(scale.x(0)).toBe(0);
    expect(scale.x(1000)).toBeCloseTo(1000 / total);
    expect(scale.x(5000)).toBeCloseTo((1000 + squeezed) / total);
    expect(scale.x(6000)).toBe(1);
    // The wait, which was two thirds of the run, is now a small part of it.
    expect(scale.x(5000) - scale.x(1000)).toBeCloseTo(squeezed / total);
  });

  it("says where the squeezed wait falls, to draw a break there", () => {
    expect(scale.breaks).toHaveLength(1);
    expect(scale.breaks[0]).toMatchObject({ from: 1000, to: 5000 });
    expect(scale.breaks[0].x0).toBeCloseTo(scale.x(1000));
    expect(scale.breaks[0].x1).toBeCloseTo(scale.x(5000));
  });

  it("goes only one way: a later time is never further left", () => {
    const xs = Array.from({ length: 61 }, (_, index) => scale.x(index * 100));
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it("can be undone: the time at a position is the time that fell there", () => {
    for (const ms of [0, 250, 999, 1000, 3000, 4999, 5000, 5500, 6000]) {
      // Inside a squeezed wait many times share a spot, so only times outside it are exact.
      if (ms > 1000 && ms < 5000) continue;
      expect(scale.ms(scale.x(ms))).toBeCloseTo(ms, 6);
    }
    // Inside it, the position still gives a time inside the wait.
    expect(scale.ms(scale.x(3000))).toBeCloseTo(3000, 6);
  });

  it("gives the two ends of the track back exactly, not nearly", () => {
    // A run that ends while still waiting. Worked out, the end of this track is 45918.99999999999.
    const waiting = [makeSpan("w", { kind: "wait", startMs: 4563, durationMs: 41_356 })];
    const whole = makeScale(waiting, 45_919, "agent");
    expect(whole.x(45_919)).toBe(1);
    expect(whole.ms(1)).toBe(45_919);
    expect(whole.ms(0)).toBe(0);
    // And of a window on it.
    const part = makeScale(waiting, 45_919, "agent", { from: 1000, to: 30_000 });
    expect(part.ms(0)).toBe(1000);
    expect(part.ms(1)).toBe(30_000);
    // Beyond the ends it still goes on as a straight line.
    expect(whole.ms(1.5)).toBeGreaterThan(45_919);
    expect(whole.ms(-0.5)).toBeLessThan(0);
  });

  it("is the same as real time when no one was waited for", () => {
    const work = [makeSpan("a", { kind: "tool", startMs: 0, durationMs: 500 })];
    const agent = makeScale(work, 500, "agent");
    expect(agent.x(250)).toBe(0.5);
    expect(agent.breaks).toEqual([]);
  });

  it("leaves a wait shorter than the squeezed width as it is, rather than making it longer", () => {
    const short = [makeSpan("a", { kind: "tool", startMs: 0, durationMs: 10_000 }), makeSpan("w", { kind: "wait", startMs: 10_000, durationMs: 100 })];
    const scale2 = makeScale(short, 10_100, "agent");
    expect(scale2.breaks).toEqual([]);
    expect(scale2.x(10_000)).toBeCloseTo(10_000 / 10_100);
  });

  it("keeps a squeezed wait between 80 ms and 2 s of weight, whatever the work around it", () => {
    const tiny = makeScale([makeSpan("a", { kind: "tool", startMs: 0, durationMs: 100 }), makeSpan("w", { kind: "wait", startMs: 100, durationMs: 9000 })], 9100, "agent");
    // 100 ms of work: the wait is the 80 ms floor, not 15 ms.
    expect(tiny.x(100)).toBeCloseTo(100 / 180);
    const huge = makeScale([makeSpan("a", { kind: "tool", startMs: 0, durationMs: 100_000 }), makeSpan("w", { kind: "wait", startMs: 100_000, durationMs: 900_000 })], 1_000_000, "agent");
    // 100 s of work: the wait is the 2 s ceiling, not 15 s.
    expect(huge.x(100_000)).toBeCloseTo(100_000 / 102_000);
  });
});

describe("a zoomed window", () => {
  it("puts the window across the whole track", () => {
    const scale = makeScale(spans, DURATION, "real", { from: 1000, to: 2000 });
    expect([scale.x(1000), scale.x(1500), scale.x(2000)]).toEqual([0, 0.5, 1]);
    // What is outside it falls outside the track.
    expect(scale.x(0)).toBe(-1);
    expect(scale.x(3000)).toBe(2);
    expect(scale.ms(0.5)).toBe(1500);
  });

  it("works in agent time too, and only reports the breaks that are in the window", () => {
    const inside = makeScale(spans, DURATION, "agent", { from: 500, to: 5500 });
    expect(inside.breaks).toHaveLength(1);
    const outside = makeScale(spans, DURATION, "agent", { from: 0, to: 900 });
    expect(outside.breaks).toEqual([]);
    expect(outside.x(900)).toBe(1);
  });
});

describe("waitsOf", () => {
  it("joins waits that overlap, and keeps them inside the run", () => {
    const joined = waitsOf(
      [
        makeSpan("a", { kind: "wait", startMs: 100, durationMs: 400 }),
        makeSpan("b", { kind: "wait", startMs: 400, durationMs: 300 }),
        makeSpan("c", { kind: "wait", startMs: 900, durationMs: 500 }),
        makeSpan("d", { kind: "tool", startMs: 0, durationMs: 50 }),
      ],
      1000,
    );
    expect(joined).toEqual([
      { from: 100, to: 700 },
      { from: 900, to: 1000 },
    ]);
  });
});

describe("axisTicks", () => {
  it("labels round times from the start, spaced at least as far apart as asked", () => {
    const ticks = axisTicks(makeScale(spans, DURATION, "real"), 600);
    expect(ticks[0]).toEqual({ ms: 0, x: 0 });
    for (let index = 1; index < ticks.length; index += 1) expect((ticks[index].x - ticks[index - 1].x) * 600).toBeGreaterThanOrEqual(72);
  });

  it("in agent time labels the two ends of a squeezed wait, and nothing inside it", () => {
    const scale = makeScale(spans, DURATION, "agent");
    const times = axisTicks(scale, 900).map((tick) => tick.ms);
    expect(times).toContain(1000);
    expect(times).toContain(5000);
    expect(times.some((ms) => ms > 1000 && ms < 5000)).toBe(false);
  });

  it("keeps every label inside the window", () => {
    const scale = makeScale(spans, DURATION, "real", { from: 1200, to: 1800 });
    for (const tick of axisTicks(scale, 600)) {
      expect(tick.ms).toBeGreaterThanOrEqual(1200);
      expect(tick.ms).toBeLessThanOrEqual(1800);
    }
  });
});

describe("a real run", () => {
  it("shows the app's own time at a usable size when the traveller's wait is squeezed", () => {
    const recorded = z.object({ runs: z.array(z.object({ label: z.string(), envelope: z.object({ data: saysoRunSchema }) })) }).parse(saysoSample).runs;
    const run = recorded.find((entry) => entry.label === "a window seat, paid for")!.envelope.data;
    const trace = adaptSayso(run, { origin: { how: "sample", at: "2026-10-07T00:00:00.000Z" } });
    const call = trace.spans.find((span) => span.name === "POST /api/quotes")!;
    const real = makeScale(trace.spans, trace.durationMs, "real");
    const agent = makeScale(trace.spans, trace.durationMs, "agent");
    const width = (scale: ReturnType<typeof makeScale>) => scale.x(call.startMs + call.durationMs) - scale.x(call.startMs);
    // A 158 ms call is under 3% of the run in real time, and several times that in agent time.
    expect(width(real)).toBeLessThan(0.03);
    expect(width(agent)).toBeGreaterThan(width(real) * 3);
  });
});
