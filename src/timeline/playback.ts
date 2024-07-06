import type { Scale } from "./scale";

// Playing a run back: where the playhead is one frame later.
//
// In real time the playhead moves as fast as the run did, unless that would be
// over too soon to follow or take too long to sit through, so a run plays in no
// less than four seconds and no more than twelve. In agent time it crosses the
// track at an even pace, so a wait that was squeezed passes as quickly as it is
// drawn.

/** In real time, a run takes at least this long to play, however short it was. */
export const PLAY_MIN_MS = 4_000;
/** And at most this long, however long it was. */
export const PLAY_MAX_MS = 12_000;
/** In agent time, the whole track is crossed in this long. */
export const PLAY_AGENT_MS = 9_000;
/** The most one frame may count for. A tab left in the background comes back with one very long frame. */
export const MAX_FRAME_MS = 100;

/** How long a run of this length takes to play in real time. */
export const playTimeOf = (durationMs: number): number => Math.min(PLAY_MAX_MS, Math.max(PLAY_MIN_MS, durationMs));

export type Played = {
  /** Where the playhead is now, in milliseconds from the start of the run. */
  at: number;
  /** Whether it has reached the end of the run. */
  ended: boolean;
};

/**
 * Moves the playhead on by `elapsedMs` of the viewer's time. `wholeRun` is the
 * scale of all of the run in the clock it is being played by.
 */
export function played(at: number, elapsedMs: number, durationMs: number, wholeRun: Scale): Played {
  if (durationMs <= 0) return { at: 0, ended: true };
  const elapsed = Math.min(MAX_FRAME_MS, Math.max(0, elapsedMs));

  if (wholeRun.mode === "real") {
    const next = at + (elapsed * durationMs) / playTimeOf(durationMs);
    return next >= durationMs ? { at: durationMs, ended: true } : { at: next, ended: false };
  }

  // Measured along the track, and ended by the place on the track, not by a
  // time worked back from it: that can fall a hair short of the run's end.
  const position = wholeRun.x(at) + elapsed / PLAY_AGENT_MS;
  if (position >= 1) return { at: durationMs, ended: true };
  return { at: Math.min(durationMs, wholeRun.ms(position)), ended: false };
}
