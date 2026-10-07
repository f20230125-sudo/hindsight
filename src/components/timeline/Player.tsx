"use client";

import { Pause, Play } from "lucide-react";
import { formatMs } from "@/trace/format";

// Plays a run back: a button, and a slider along the whole of it. The slider is
// how the keyboard moves the playhead, as the pointer does on the time axis.

type Props = {
  durationMs: number;
  at: number | null;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onMove: (ms: number) => void;
};

export function Player({ durationMs, at, playing, onPlay, onPause, onMove }: Props) {
  const here = at ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" role="group" aria-label="Play the run back">
      <button
        type="button"
        onClick={playing ? onPause : onPlay}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-fg hover:opacity-90"
      >
        {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        {playing ? "Pause" : at !== null && at >= durationMs ? "Play again" : "Play"}
      </button>
      <input
        type="range"
        aria-label="Moment in the run"
        aria-valuetext={at === null ? "Not set" : `${formatMs(here)} of ${formatMs(durationMs)}`}
        min={0}
        max={Math.max(1, durationMs)}
        step={1}
        value={here}
        onChange={(event) => onMove(Number(event.target.value))}
        className="h-2 min-w-[8rem] flex-1 cursor-pointer accent-[var(--accent)]"
      />
      <span className="tabular w-full shrink-0 text-[12px] text-muted sm:w-[8.5rem] sm:text-right">
        {at === null ? "Not playing" : `${formatMs(here)} of ${formatMs(durationMs)}`}
      </span>
    </div>
  );
}
