"use client";

import { useMemo, useState } from "react";
import { KIND_LABELS, SPAN_STATUS_LABELS } from "@/timeline/look";
import { formatMs, formatOffset } from "@/trace/format";
import type { Trace } from "@/trace/schema";
import { KIND_ICONS } from "./kinds";

// The same run as a list: every bar and mark, in the order they began, with
// each time written out. Nothing in the timeline is only in the timeline.

const FIRST = 150;

export function SpanTable({ trace, selected, onSelect }: { trace: Trace; selected: string[]; onSelect: (ids: string[]) => void }) {
  const [shown, setShown] = useState(FIRST);
  const spans = useMemo(() => [...trace.spans].sort((a, b) => a.startMs - b.startMs), [trace.spans]);
  const rows = spans.slice(0, shown);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <caption className="sr-only">Every bar and mark of the run, in the order they began</caption>
          <thead>
            <tr className="eyebrow border-b border-line">
              <th scope="col" className="py-2 pr-3 font-medium">
                Starts
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Took
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Kind
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                What
              </th>
              <th scope="col" className="py-2 pl-3 font-medium">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((span) => {
              const Icon = KIND_ICONS[span.kind];
              const chosen = selected.length === 1 && selected[0] === span.id;
              return (
                <tr key={span.id} className={`border-b border-line/70 ${chosen ? "bg-accent-soft" : "hover:bg-surface-2/60"}`}>
                  <td className="tabular whitespace-nowrap py-2 pr-3 align-top text-muted">{formatOffset(span.startMs)}</td>
                  <td className="tabular whitespace-nowrap px-3 py-2 text-right align-top">{span.durationMs > 0 ? formatMs(span.durationMs) : "a moment"}</td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon size={13} aria-hidden="true" />
                      {KIND_LABELS[span.kind]}
                    </span>
                  </td>
                  <td className="min-w-0 px-3 py-2 align-top">
                    <button type="button" aria-pressed={chosen} onClick={() => onSelect([span.id])} className="break-words text-left font-medium hover:underline">
                      {span.name}
                    </button>
                    {span.timing === "estimated" ? <span className="ml-2 text-[12px] text-faint">worked out from the log</span> : null}
                  </td>
                  <td className="whitespace-nowrap py-2 pl-3 align-top">{SPAN_STATUS_LABELS[span.status]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {shown < spans.length ? (
        <button type="button" onClick={() => setShown((count) => count + FIRST)} className="mt-3 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium hover:bg-surface-2">
          Show {Math.min(FIRST, spans.length - shown)} more of {spans.length - shown}
        </button>
      ) : null}
    </div>
  );
}
