"use client";

import Link from "next/link";
import { Duration } from "@/components/Duration";
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
// The time between steps is nothing's colour: the edge colour, half faded.
const FILL: Record<Category | "none", string> = { ...CATEGORY_FILL, none: "bg-edge/50" };

const percent = (part: number, whole: number) => (whole === 0 ? 0 : (part / whole) * 100);
const shown = (value: number) => (value > 0 && value < 1 ? "under 1%" : `${Math.round(value)}%`);

function Legend() {
  return (
    <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink-2" aria-label="What the colours mean">
      {ORDER.map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-4 rounded-bar ${FILL[key]}`} aria-hidden="true" />
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
    <li className="grid gap-x-5 gap-y-1 sm:grid-cols-[var(--gutter)_minmax(0,1fr)] sm:items-center">
      <div>
        <SourceChip source={entry.source} />
        <p className="mt-0.5 text-[12.5px] text-ink-3">
          {plural(entry.runs, "run")}, <Duration ms={entry.totalMs} /> in all
        </p>
      </div>
      <div>
        {/* The bar is 16 px; the link around it is 28 px high, so it can be pressed. */}
        <Link href={`/?source=${entry.source}`} aria-label={`${summary}. Show these runs.`} className="flex h-7 items-center rounded-bar">
          <span className="flex h-[var(--bar)] w-full gap-[2px] overflow-hidden rounded-bar bg-paper">
            {present.map((key) => (
              <span key={key} className={`block ${FILL[key]}`} style={{ width: `${percent(entry.share[key], total)}%`, minWidth: 3 }} />
            ))}
          </span>
        </Link>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-ink-2">
          {present.map((key) => (
            <li key={key} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-bar ${FILL[key]}`} aria-hidden="true" />
              {LABELS[key]} <span className="tabular text-ink">{shown(percent(entry.share[key], total))}</span>
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
        <p className="text-[14px] text-ink-2">No runs to add up.</p>
      ) : (
        <>
          <Legend />
          <ul className="flex flex-col gap-3">
            {rows.map((entry) => (
              <Row key={entry.source} entry={entry} />
            ))}
          </ul>
        </>
      )}
    </ChartCard>
  );
}
