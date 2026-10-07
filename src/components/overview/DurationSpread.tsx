"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SourceChip } from "@/components/Chips";
import { TRACE_STATUS_LABELS } from "@/timeline/look";
import { formatMs, formatTick, percentile, plural } from "@/trace/format";
import { SOURCES, SOURCE_LABELS, type Trace, type TraceStatus } from "@/trace/schema";
import { ChartCard, DataTable } from "./ChartCard";

// How long runs took, one dot for each run, on a scale where each step along is
// ten times as long. A run of 20 milliseconds and one of two minutes are both
// in view, which no straight scale can do.

const LANE_PX = 15;
/** Dots closer than this, as a share of the track, go on another line. */
const NEAR = 0.022;
/** Lines above and below the middle one. Runs of one length sit on top of each other past this, so a crowd does not run off the page. */
const SPREAD = 3;
/** The order lines are tried in: the middle first, then out either side. */
const LINES = [0, 1, -1, 2, -2, 3, -3];

const SHAPE: Record<TraceStatus, string> = {
  ok: "rounded-full bg-series",
  failed: "rotate-45 rounded-[2px] bg-bad",
  stopped: "rounded-[2px] bg-warn",
  waiting: "rounded-full border-2 border-series bg-surface",
  running: "rounded-full border-2 border-series bg-surface",
};

type Dot = { trace: Trace; at: number; line: number };

/**
 * Places each run on a line, so that runs of nearly the same length are not on
 * top of each other: the middle line first, then above and below it. When all
 * the lines are taken at that length, the oldest placed gives way and the dots
 * overlap, which is as much a picture of how many there are as a count would be.
 */
function place(runs: Trace[], position: (ms: number) => number): Dot[] {
  const last = new Map<number, number>();
  return [...runs]
    .sort((a, b) => a.durationMs - b.durationMs)
    .map((trace) => {
      const at = position(trace.durationMs);
      const line = LINES.find((candidate) => at - (last.get(candidate) ?? -1) >= NEAR) ?? LINES.reduce((oldest, candidate) => ((last.get(candidate) ?? -1) < (last.get(oldest) ?? -1) ? candidate : oldest));
      last.set(line, at);
      return { trace, at, line };
    });
}

export function DurationSpread({ traces }: { traces: Trace[] }) {
  const sources = SOURCES.filter((source) => traces.some((trace) => trace.source === source));
  const lengths = traces.map((trace) => Math.max(1, trace.durationMs));
  const low = Math.pow(10, Math.floor(Math.log10(Math.min(...lengths, 10))));
  const high = Math.pow(10, Math.ceil(Math.log10(Math.max(...lengths, 100))));
  const position = useMemo(() => (ms: number) => (Math.log10(Math.max(ms, 1)) - Math.log10(low)) / (Math.log10(high) - Math.log10(low)), [low, high]);
  const ticks: number[] = [];
  for (let tick = low; tick <= high; tick *= 10) ticks.push(tick);

  const rows = sources.map((source) => {
    const runs = traces.filter((trace) => trace.source === source);
    const durations = runs.map((trace) => trace.durationMs);
    const dots = place(runs, position);
    const reach = Math.min(SPREAD, Math.max(0, ...dots.map((dot) => Math.abs(dot.line))));
    return { source, runs, median: percentile(durations, 0.5) ?? 0, slow: percentile(durations, 0.9) ?? 0, fastest: Math.min(...durations), slowest: Math.max(...durations), dots, reach };
  });

  return (
    <ChartCard
      id="spread"
      title="How long runs take"
      note="One dot for each run. Each tick along is ten times the last. The line is the middle run of that app. Choose a dot to open the run."
      table={
        <DataTable
          caption="How long the runs of each app took"
          head={["App", "Runs", "Fastest", "Middle", "Slowest tenth starts at", "Slowest"]}
          rows={rows.map((row) => [SOURCE_LABELS[row.source], row.runs.length, formatMs(row.fastest), formatMs(row.median), formatMs(row.slow), formatMs(row.slowest)])}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="text-[14px] text-muted">No runs to place.</p>
      ) : (
        <>
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted" aria-label="What the shapes mean">
            {(["ok", "failed", "stopped"] as const).map((status) => (
              <li key={status} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 ${SHAPE[status]}`} aria-hidden="true" />
                {TRACE_STATUS_LABELS[status]}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3.5 bg-fg/60" aria-hidden="true" />
              The middle run
            </li>
          </ul>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden sm:block" style={{ left: "11rem" }} aria-hidden="true">
              {ticks.map((tick) => (
                <span key={tick} className="absolute inset-y-0 w-px bg-line" style={{ left: `${position(tick) * 100}%` }} />
              ))}
            </div>
            <ul className="relative flex flex-col gap-3">
              {rows.map((row) => (
                <li key={row.source} className="grid gap-x-4 gap-y-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center">
                  <div>
                    <SourceChip source={row.source} />
                    <p className="text-[12px] text-faint">
                      {plural(row.runs.length, "run")}, middle {formatMs(row.median)}
                    </p>
                  </div>
                  <ul aria-label={`${SOURCE_LABELS[row.source]}, each run`} className="relative" style={{ height: (2 * row.reach + 1) * LANE_PX + 6 }}>
                    <li aria-hidden="true" className="absolute w-0.5 -translate-x-1/2 bg-fg/60" style={{ left: `${position(row.median) * 100}%`, top: 0, bottom: 0 }} />
                    {row.dots.map(({ trace, at, line }) => (
                      <li key={trace.id} className="group absolute -translate-x-1/2" style={{ left: `${at * 100}%`, top: (line + row.reach) * LANE_PX + 5 }}>
                        <Link
                          href={`/runs/${encodeURIComponent(trace.id)}`}
                          aria-label={`${trace.title}, ${formatMs(trace.durationMs)}, ${TRACE_STATUS_LABELS[trace.status].toLowerCase()}`}
                          className={`relative block h-3 w-3 ring-2 ring-surface before:absolute before:-inset-1.5 before:content-[''] ${SHAPE[trace.status]}`}
                        />
                        <span
                          role="tooltip"
                          className={`pointer-events-none absolute bottom-full z-20 mb-2 hidden w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-2 text-left shadow-lift group-focus-within:block group-hover:block ${
                            at > 0.85 ? "-translate-x-[85%]" : at < 0.15 ? "-translate-x-[15%]" : ""
                          }`}
                        >
                          <span className="tabular block text-[13px] font-semibold">{formatMs(trace.durationMs)}</span>
                          <span className="block break-words text-[12px] text-fg">{trace.title}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <div className="mt-2 grid sm:grid-cols-[11rem_minmax(0,1fr)]" aria-hidden="true">
              <span />
              <div className="relative h-4 text-[11px] text-faint">
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    className="tabular absolute top-0 whitespace-nowrap"
                    style={{ left: `${position(tick) * 100}%`, transform: position(tick) > 0.93 ? "translateX(-100%)" : position(tick) < 0.02 ? "none" : "translateX(-50%)" }}
                  >
                    {formatTick(tick)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </ChartCard>
  );
}
