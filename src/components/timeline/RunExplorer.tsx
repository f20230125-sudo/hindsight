"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useReducer, useState, type KeyboardEvent } from "react";
import { Controls } from "./Controls";
import { Legend } from "./Legend";
import { MomentPanel } from "./MomentPanel";
import { Player } from "./Player";
import { SpanDetail } from "./SpanDetail";
import { SpanTable } from "./SpanTable";
import { Timeline } from "./Timeline";
import { played } from "@/timeline/playback";
import { makeScale, waitsOf } from "@/timeline/scale";
import { fullWindow, paramsFromView, panned, reduceView, viewFromParams, windowAround, zoomed } from "@/timeline/view";
import { plural } from "@/trace/format";
import type { Trace } from "@/trace/schema";

// One run, explored: the timeline and what can be done to it, the same run as a
// table, playing it back, and the panel beside it that says what is chosen or
// what was going on at the moment the playhead is at.
//
// The mode, the part of the run on show and the span that is chosen are kept in
// the address, so any view of a run is a link.

export function RunExplorer({ trace }: { trace: Trace }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const [view, dispatch] = useReducer(reduceView, params, (initial) => viewFromParams(initial, trace));
  const [shape, setShape] = useState<"timeline" | "table">("timeline");
  const [side, setSide] = useState<"detail" | "moment">("detail");
  const [playing, setPlaying] = useState(false);

  const full = useMemo(() => fullWindow(trace), [trace]);
  const hasWaits = useMemo(() => waitsOf(trace.spans, trace.durationMs).length > 0, [trace]);
  const scale = useMemo(() => makeScale(trace.spans, trace.durationMs, view.mode, view.window ?? full), [trace, view.mode, view.window, full]);
  // Playing walks the whole run at an even pace, however much of it is on show.
  const wholeRun = useMemo(() => makeScale(trace.spans, trace.durationMs, view.mode), [trace, view.mode]);

  // The address follows the view.
  const query = paramsFromView(view).toString();
  useEffect(() => {
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }, [query, pathname]);

  const advance = useEffectEvent((elapsed: number) => {
    const next = played(view.playhead ?? 0, elapsed, trace.durationMs, wholeRun);
    dispatch({ type: "playhead", at: next.at });
    if (next.ended) setPlaying(false);
  });

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      advance(now - last);
      last = now;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const zoom = (factor: number) => dispatch({ type: "window", window: zoomed(scale, full, factor) });
  const pan = (fraction: number) => dispatch({ type: "window", window: panned(view.window, full, fraction) });
  const reset = () => dispatch({ type: "window", window: null });

  const chosenSpan = view.selected.length === 1 ? trace.spans.find((span) => span.id === view.selected[0]) : undefined;
  const select = (ids: string[]) => {
    dispatch({ type: "select", ids });
    setSide("detail");
  };
  const point = (ms: number) => {
    dispatch({ type: "playhead", at: Math.min(trace.durationMs, Math.max(0, ms)) });
    setSide("moment");
  };
  const play = () => {
    // From the beginning, when it has already been played to the end or not begun.
    if (view.playhead === null || view.playhead >= trace.durationMs) dispatch({ type: "playhead", at: 0 });
    setSide("moment");
    setPlaying(true);
  };

  /** Keys that work anywhere in the timeline's panel. The arrow keys belong to the timeline itself. */
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (event.ctrlKey || event.metaKey || event.altKey || target.matches("input, select, textarea")) return;
    if (event.key === "+" || event.key === "=") zoom(0.5);
    else if (event.key === "-") zoom(2);
    else if (event.key === "[") pan(-0.5);
    else if (event.key === "]") pan(0.5);
    else if (event.key === "0") reset();
    else return;
    event.preventDefault();
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="panel p-4 sm:p-5" aria-labelledby="timeline-heading" onKeyDown={onKeyDown}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="timeline-heading" className="text-[15px] font-semibold">
            Timeline
          </h2>
          <span className="text-[12px] text-faint">{plural(trace.spans.length, "span")} recorded</span>
        </div>
        <Legend />
        <div className="mt-3">
          <Controls
            mode={view.mode}
            onMode={(mode) => dispatch({ type: "mode", mode })}
            hasWaits={hasWaits}
            zoomed={view.window !== null}
            onZoom={zoom}
            onPan={pan}
            onReset={reset}
            onZoomToSelection={chosenSpan ? () => dispatch({ type: "window", window: windowAround(chosenSpan.startMs, chosenSpan.durationMs, full) }) : null}
            shape={shape}
            onShape={setShape}
          />
        </div>
        <div className="mt-4">
          {shape === "timeline" ? (
            <Timeline trace={trace} scale={scale} selected={view.selected} onSelect={select} playhead={view.playhead} onPlayhead={point} />
          ) : (
            <SpanTable trace={trace} selected={view.selected} onSelect={select} />
          )}
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <Player durationMs={trace.durationMs} at={view.playhead} playing={playing} onPlay={play} onPause={() => setPlaying(false)} onMove={(ms) => (setPlaying(false), point(ms))} />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-faint">
          Keys: the arrow keys move from bar to bar and mark to mark, Enter chooses, Escape lets go, + and − zoom, [ and ] move along, 0 shows all.
        </p>
      </section>

      <aside aria-label="Detail and moment" className="flex flex-col gap-2 lg:sticky lg:top-20">
        <div role="group" aria-label="What to show" className="inline-flex self-start rounded-lg border border-line bg-surface p-0.5">
          {(
            [
              ["detail", "Detail"],
              ["moment", "At this moment"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={side === value}
              onClick={() => setSide(value)}
              className={`h-7 rounded-md px-2.5 text-[12.5px] font-medium transition-colors ${side === value ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {side === "detail" ? (
          <SpanDetail trace={trace} selected={view.selected} onSelect={select} />
        ) : (
          <div className="panel p-4">
            <MomentPanel trace={trace} at={view.playhead} />
          </div>
        )}
      </aside>
    </div>
  );
}
