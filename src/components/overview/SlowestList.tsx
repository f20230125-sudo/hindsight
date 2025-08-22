"use client";

import Link from "next/link";
import { SourceChip } from "@/components/Chips";
import { slowestSteps } from "@/stats/slowest";
import { CATEGORY_FILL, CATEGORY_OF } from "@/timeline/look";
import { formatMs, plural } from "@/trace/format";
import { SOURCE_LABELS, type Trace } from "@/trace/schema";
import { ChartCard, DataTable } from "./ChartCard";

// The steps that took longest, by what they were: the longest of each kind, how
// many there were, and the middle length. Choosing one opens the run it was in,
// on that step.

export function SlowestList({ traces }: { traces: Trace[] }) {
  const steps = slowestSteps(traces, 8);
  const longest = Math.max(1, ...steps.map((step) => step.slowest.span.durationMs));
  return (
    <ChartCard
      id="slowest"
      title="The slowest steps"
      note="The longest of each kind of step across these runs, leaving out waits for a person. Choose one to open the run it was in, on that step."
      table={
        <DataTable
          caption="The slowest steps"
          head={["Step", "App", "Longest", "Middle", "Times"]}
          rows={steps.map((step) => [step.name, SOURCE_LABELS[step.source], formatMs(step.slowest.span.durationMs), formatMs(step.medianMs), step.count])}
        />
      }
    >
      {steps.length === 0 ? (
        <p className="text-[14px] text-ink-2">No step took any time.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-rule">
          {steps.map((step) => (
            <li key={`${step.source}|${step.name}`}>
              <Link
                href={`/runs/${encodeURIComponent(step.slowest.trace.id)}?span=${encodeURIComponent(step.slowest.span.id)}`}
                aria-label={`${step.name}, ${SOURCE_LABELS[step.source]}, longest ${formatMs(step.slowest.span.durationMs)}, ${plural(step.count, "time")}. Open the run.`}
                className="grid items-center gap-x-4 gap-y-1 rounded-control px-2 py-2.5 transition-colors duration-150 hover:bg-paper-2 sm:grid-cols-[calc(var(--gutter)-0.5rem)_minmax(0,1fr)_10.5rem]"
              >
                <span className="min-w-0">
                  <span className="gutter-label block break-words">{step.name}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink-3">
                    <SourceChip source={step.source} />
                  </span>
                </span>
                {/* The bar takes the colour of the kind of time its slowest step was: the same rule as the timeline. */}
                <span className="h-[var(--bar)] rounded-bar bg-paper-2" aria-hidden="true">
                  <span className={`block h-full rounded-bar ${CATEGORY_FILL[CATEGORY_OF[step.slowest.span.kind]]}`} style={{ width: `${(step.slowest.span.durationMs / longest) * 100}%` }} />
                </span>
                <span className="tabular text-right">
                  <span className="block text-[13.5px] font-semibold">{formatMs(step.slowest.span.durationMs)}</span>
                  <span className="block text-[12.5px] text-ink-3">
                    middle {formatMs(step.medianMs)}, {plural(step.count, "time")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </ChartCard>
  );
}
