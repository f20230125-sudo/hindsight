"use client";

import Link from "next/link";
import { SourceChip } from "@/components/Chips";
import { CATEGORY_FILL, CATEGORY_LABELS, type Category } from "@/timeline/look";
import { timeBySource, type Share, type SourceTime } from "@/stats/time";
import { formatMs, plural } from "@/trace/format";
import { SOURCE_LABELS, type Trace } from "@/trace/schema";
import { ChartCard, DataTable } from "./ChartCard";

// Where the time of each app's runs went: one bar for each app, cut by what was
// going on. The same colours as the timeline, and the same rule for what counts
// as what, so a bar here is every timeline of that app laid end to end.

const ORDER: (Category | "none")[] = ["model", "call", "wait", "own", "none"];
const LABELS: Record<Category | "none", string> = { ...CATEGORY_LABELS, none: "Between steps" };
const FILL: Record<Category | "none", string> = { ...CATEGORY_FILL, none: "bg-line-strong" };

const percent = (part: number, whole: number) => (whole === 0 ? 0 : (part / whole) * 100);
const shown = (value: number) => (value > 0 && value < 1 ? "under 1%" : `${Math.round(value)}%`);

function Legend() {
  return (
    <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted" aria-label="What the colours mean">
      {ORDER.map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-4 rounded-[3px] ${FILL[key]}`} aria-hidden="true" />
          {LABELS[key]}
        </li>
      ))}
    </ul>
  );
}

function Row({ entry }: { entry: SourceTime }) {
  const total = ORDER.reduce((sum, key) => sum + entry.share[key], 0);
  const present = ORDER.filter((key) => entry.share[key] > 0);
  const summary = `${SOURCE_LABELS[entry.source]}: ${present.map((key) => `${shown(percent(entry.share[key], total))} ${LABELS[key].toLowerCase()}`).join(", ")}`;
  return (
    <li className="grid gap-x-5 gap-y-1.5 sm:grid-cols-[11.5rem_minmax(0,1fr)] sm:items-center">
      <div>
        <SourceChip source={entry.source} />
        <p className="mt-0.5 text-[12px] text-faint">
          {plural(entry.runs, "run")}, {formatMs(entry.totalMs)} in all
        </p>
      </div>
      <div>
        <Link href={`/?source=${entry.source}`} aria-label={`${summary}. Show these runs.`} className="flex h-5 gap-[2px] overflow-hidden rounded-[4px] bg-surface">
          {present.map((key) => (
            <span key={key} className={`block ${FILL[key]}`} style={{ width: `${percent(entry.share[key], total)}%`, minWidth: 3 }} />
          ))}
        </Link>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-muted">
          {present.map((key) => (
            <li key={key} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-[2px] ${FILL[key]}`} aria-hidden="true" />
              {LABELS[key]} <span className="tabular text-fg">{shown(percent(entry.share[key], total))}</span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export function TimeShare({ traces }: { traces: Trace[] }) {
  const rows = timeBySource(traces);
  const cell = (share: Share, key: Category | "none") => {
    const total = ORDER.reduce((sum, name) => sum + share[name], 0);
    return `${formatMs(share[key])} (${shown(percent(share[key], total))})`;
  };
  return (
    <ChartCard
      id="time"
      title="Where the time goes"
      note="Each bar is all the time of one app's runs, cut by what was going on. Waiting for a person is how long a person took, not how slow the app was: it is shown so that it is not mistaken for the app's own time."
      table={
        <DataTable
          caption="Time by what was going on, for each app"
          head={["App", "Runs", ...ORDER.map((key) => LABELS[key])]}
          rows={rows.map((entry) => [SOURCE_LABELS[entry.source], entry.runs, ...ORDER.map((key) => cell(entry.share, key))])}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="text-[14px] text-muted">No runs to add up.</p>
      ) : (
        <>
          <Legend />
          <ul className="flex flex-col gap-4">
            {rows.map((entry) => (
              <Row key={entry.source} entry={entry} />
            ))}
          </ul>
        </>
      )}
    </ChartCard>
  );
}
