"use client";

import { scaleLinear } from "d3-scale";
import { CircleAlert, CircleCheck, CircleMinus, Clock, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { byDay, type Day } from "@/stats/days";
import { TRACE_STATUS_LABELS } from "@/timeline/look";
import { formatDate, plural } from "@/trace/format";
import { TRACE_STATUSES, type Trace, type TraceStatus } from "@/trace/schema";
import { ChartCard, DataTable } from "./ChartCard";

// The runs of each day, stacked by how they ended. Each part of a column is a
// link to the list of exactly those runs.

const FILL: Record<TraceStatus, string> = {
  ok: "bg-viz-good",
  stopped: "bg-viz-warning",
  failed: "bg-viz-critical",
  waiting: "bg-viz-own",
  running: "bg-viz-own",
};
const ICONS: Record<TraceStatus, typeof CircleCheck> = { ok: CircleCheck, stopped: CircleMinus, failed: CircleAlert, waiting: Clock, running: LoaderCircle };
/** From the bottom of a column up. */
const STACK: TraceStatus[] = ["ok", "stopped", "failed", "waiting", "running"];

const PLOT_HEIGHT = 168;

/** "6 Oct" for the first day and the first of a month, "7" for the rest. */
function dayLabel(day: string, first: boolean): string {
  const date = Number(day.slice(8));
  return first || date === 1 ? formatDate(`${day}T12:00:00`).replace(/ \d{4}$/, "") : String(date);
}

function Column({ day, max }: { day: Day; max: number }) {
  const parts = STACK.filter((status) => day.counts[status] > 0);
  const readout = parts.map((status) => `${day.counts[status]} ${TRACE_STATUS_LABELS[status].toLowerCase()}`).join(", ");
  return (
    <li className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
      <div className="flex w-full max-w-[24px] flex-col-reverse gap-[2px]">
        {parts.map((status, at) => (
          <Link
            key={status}
            href={`/?day=${day.day}&status=${status}`}
            aria-label={`${formatDate(`${day.day}T12:00:00`)}: ${plural(day.counts[status], `${TRACE_STATUS_LABELS[status].toLowerCase()} run`)}. Show them.`}
            className={`block w-full ${FILL[status]} ${at === parts.length - 1 ? "rounded-t-[4px]" : ""}`}
            style={{ height: Math.max(3, (day.counts[status] / max) * PLOT_HEIGHT - 2) }}
          />
        ))}
      </div>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full z-20 mb-2 hidden w-max max-w-[220px] rounded-lg border border-line bg-surface px-2.5 py-2 text-left shadow-lift group-focus-within:block group-hover:block"
      >
        <span className="tabular block text-[13px] font-semibold">{plural(day.total, "run")}</span>
        <span className="block text-[12px] text-muted">{formatDate(`${day.day}T12:00:00`)}</span>
        <span className="block text-[12px] text-muted">{readout || "No runs"}</span>
      </span>
    </li>
  );
}

export function RunsPerDay({ traces }: { traces: Trace[] }) {
  const days = byDay(traces);
  const max = Math.max(1, ...days.map((day) => day.total));
  const ticks = scaleLinear().domain([0, max]).nice(3).ticks(3);
  const top = ticks.at(-1) ?? max;
  const statuses = TRACE_STATUSES.filter((status) => days.some((day) => day.counts[status] > 0));
  const step = Math.max(1, Math.ceil(days.length / 9));

  return (
    <ChartCard
      id="days"
      title="Runs by day"
      note="How many runs began each day, and how they ended. Choose a part of a column to see those runs."
      table={
        <DataTable
          caption="Runs by day, and how they ended"
          head={["Day", ...TRACE_STATUSES.map((status) => TRACE_STATUS_LABELS[status]), "All"]}
          rows={[...days].reverse().map((day) => [formatDate(`${day.day}T12:00:00`), ...TRACE_STATUSES.map((status) => day.counts[status]), day.total])}
        />
      }
    >
      {days.length === 0 ? (
        <p className="text-[14px] text-muted">No run has a start time to place it on a day.</p>
      ) : (
        <>
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted" aria-label="How a run ended">
            {statuses.map((status) => {
              const Icon = ICONS[status];
              return (
                <li key={status} className="flex items-center gap-1.5">
                  <span className={`inline-block h-2.5 w-3.5 rounded-[3px] ${FILL[status]}`} aria-hidden="true" />
                  <Icon size={12} aria-hidden="true" />
                  {TRACE_STATUS_LABELS[status]}
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2 pt-2">
            <div className="relative w-6 shrink-0 text-right text-[11px] text-faint" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
              {ticks.map((tick) => (
                <span key={tick} className="tabular absolute right-0 -translate-y-1/2" style={{ bottom: (tick / top) * PLOT_HEIGHT }}>
                  {tick}
                </span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative" style={{ height: PLOT_HEIGHT }}>
                {ticks.map((tick) => (
                  <span key={tick} className="absolute inset-x-0 h-px bg-line" style={{ bottom: (tick / top) * PLOT_HEIGHT }} aria-hidden="true" />
                ))}
                <ul aria-label="Runs by day" className="relative flex h-full items-end gap-1.5">
                  {days.map((day) => (
                    <Column key={day.day} day={day} max={top} />
                  ))}
                </ul>
              </div>
              <div className="mt-1.5 flex gap-1.5 text-[11px] text-faint" aria-hidden="true">
                {days.map((day, index) => (
                  <span key={day.day} className="tabular min-w-0 flex-1 whitespace-nowrap text-center">
                    {index % step === 0 || index === days.length - 1 ? dayLabel(day.day, index === 0) : ""}
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
