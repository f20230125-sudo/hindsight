import { describe, expect, it } from "vitest";
import { makeSpan } from "@/test/traces";
import type { Span } from "@/trace/schema";
import { MAX_FRAME_MS, PLAY_AGENT_MS, PLAY_MAX_MS, PLAY_MIN_MS, playTimeOf, played } from "./playback";
import { makeScale, type Mode } from "./scale";

const FRAME = 1000 / 60;

/** Plays a run from the start, a frame at a time, and says how long it took and where it ended. */
function playThrough(spans: Span[], durationMs: number, mode: Mode, frame = FRAME) {
  const scale = makeScale(spans, durationMs, mode);
  let at = 0;
  let frames = 0;
  let ended = false;
  const places: number[] = [];
  // Twice as long as any run should take, so a run that never ends is caught and does not hang the test.
  while (!ended && frames * frame < 2 * Math.max(PLAY_MAX_MS, PLAY_AGENT_MS)) {
    ({ at, ended } = played(at, frame, durationMs, scale));
    places.push(at);
    frames += 1;
  }
  return { ended, at, tookMs: frames * frame, places };
}

describe("in real time", () => {
  it("plays a run at the speed it happened, when that is neither too quick to follow nor too long to sit through", () => {
    expect(playTimeOf(6000)).toBe(6000);
    const { ended, at, tookMs } = playThrough([], 6000, "real");
    expect(ended).toBe(true);
    expect(at).toBe(6000);
    expect(tookMs).toBeGreaterThan(5950);
    expect(tookMs).toBeLessThan(6050);
  });

  it("slows down a run that was over in a moment, so it can be followed", () => {
    // A flow that ran in 400 ms would be played in 24 frames.
    expect(playTimeOf(400)).toBe(PLAY_MIN_MS);
    const { ended, at, tookMs } = playThrough([], 400, "real");
    expect(ended).toBe(true);
    expect(at).toBe(400);
    expect(tookMs).toBeGreaterThan(PLAY_MIN_MS - 50);
    expect(tookMs).toBeLessThan(PLAY_MIN_MS + 50);
  });

  it("speeds up a run that took minutes", () => {
    expect(playTimeOf(300_000)).toBe(PLAY_MAX_MS);
    const { ended, tookMs } = playThrough([], 300_000, "real");
    expect(ended).toBe(true);
    expect(tookMs).toBeGreaterThan(PLAY_MAX_MS - 50);
    expect(tookMs).toBeLessThan(PLAY_MAX_MS + 50);
  });

  it("only ever moves forward, and stops exactly at the end", () => {
    const { places } = playThrough([], 2500, "real");
    expect(places).toEqual([...places].sort((a, b) => a - b));
    expect(places.at(-1)).toBe(2500);
  });
});

describe("in agent time", () => {
  const wait = (startMs: number, durationMs: number) => makeSpan(`wait-${startMs}`, { kind: "wait", startMs, durationMs });

  it("crosses the track at an even pace, so a squeezed wait passes quickly", () => {
    // A second of work, four of waiting (300 ms of track), a second of work: a track 2300 wide.
    const spans = [wait(1000, 4000)];
    const { ended, at, tookMs, places } = playThrough(spans, 6000, "agent");
    expect(ended).toBe(true);
    expect(at).toBe(6000);
    expect(tookMs).toBeGreaterThan(PLAY_AGENT_MS - 50);
    expect(tookMs).toBeLessThan(PLAY_AGENT_MS + 50);
    // The first second of work is 1000 of 2300 of the track, so it takes that share of the time: 3.9 s. The wait after it takes 1.2 s.
    const framesToReach = (ms: number) => places.findIndex((place) => place >= ms) + 1;
    expect(framesToReach(1000) * FRAME).toBeCloseTo((1000 / 2300) * PLAY_AGENT_MS, -2);
    expect((framesToReach(5000) - framesToReach(1000)) * FRAME).toBeCloseTo((300 / 2300) * PLAY_AGENT_MS, -2);
  });

  it("reaches the end of a run that ends while still waiting, where the end of the track works out a hair short", () => {
    // Found by trying 40,000 made-up runs: for these the time at the end of the
    // track came back as 45918.99999999999 and the like, short of the run, and
    // playing them never finished.
    const cases: { durationMs: number; waits: [number, number][] }[] = [
      { durationMs: 45_919, waits: [[4563, 41_356]] },
      { durationMs: 28_020, waits: [[9817, 18_203]] },
      { durationMs: 8351, waits: [[66, 742], [1092, 1787], [3257, 5094]] },
      { durationMs: 40_520, waits: [[1310, 19_710], [30_167, 10_353]] },
      { durationMs: 58_442, waits: [[3154, 31_344], [43_400, 2337], [45_955, 12_487]] },
    ];
    for (const { durationMs, waits } of cases) {
      const spans = waits.map(([startMs, length]) => wait(startMs, length));
      // The track's own end is the run's end, exactly.
      expect(makeScale(spans, durationMs, "agent").ms(1)).toBe(durationMs);
      const { ended, at, tookMs } = playThrough(spans, durationMs, "agent");
      expect(ended).toBe(true);
      expect(at).toBe(durationMs);
      expect(tookMs).toBeLessThan(PLAY_AGENT_MS + 50);
    }
  });

  it("ends for every one of a spread of made-up runs", () => {
    let seed = 2026;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let round = 0; round < 300; round += 1) {
      const durationMs = 200 + Math.floor(random() * 60_000);
      const cuts = Array.from({ length: 4 }, () => Math.floor(random() * durationMs)).sort((a, b) => a - b);
      const spans = [wait(cuts[0], cuts[1] - cuts[0]), wait(cuts[2], (round % 3 === 0 ? durationMs : cuts[3]) - cuts[2])].filter((span) => span.durationMs > 0);
      // Coarse frames, so three hundred runs are played in no time.
      const { ended, at } = playThrough(spans, durationMs, "agent", 90);
      expect(ended).toBe(true);
      expect(at).toBe(durationMs);
    }
  });
});

describe("either way", () => {
  it("a run of no length is over at once", () => {
    expect(played(0, FRAME, 0, makeScale([], 0, "real"))).toEqual({ at: 0, ended: true });
    expect(played(0, FRAME, 0, makeScale([], 0, "agent"))).toEqual({ at: 0, ended: true });
  });

  it("does not leap ahead after a tab was left in the background", () => {
    // One frame that says a minute has gone by counts for a tenth of a second.
    const scale = makeScale([], 6000, "real");
    expect(played(1000, 60_000, 6000, scale)).toEqual({ at: 1000 + MAX_FRAME_MS, ended: false });
    expect(played(1000, -5, 6000, scale)).toEqual({ at: 1000, ended: false });
  });
});
