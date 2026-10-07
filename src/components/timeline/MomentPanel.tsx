"use client";

import { useEffect, useRef } from "react";
import { momentAt } from "@/timeline/moment";
import { formatMs, formatOffset } from "@/trace/format";
import type { Trace } from "@/trace/schema";
import { KIND_ICONS } from "./kinds";

// What the run was doing at the moment the playhead is at, and everything the
// person had been shown by then: the line they would have been reading.

export function MomentPanel({ trace, at }: { trace: Trace; at: number | null }) {
  const moment = at === null ? null : momentAt(trace, at);
  const latest = useRef<HTMLLIElement>(null);

  // The newest line stays in view as the run plays.
  useEffect(() => {
    latest.current?.scrollIntoView({ block: "nearest" });
  }, [moment?.shown.length]);

  if (!moment) {
    return (
      <div>
        <h3 className="eyebrow mb-2">At this moment</h3>
        <p className="text-[14px] leading-relaxed text-muted">
          Press Play, move the slider, or point at the time axis, to see what the run was doing at that moment and what the person had been shown by then.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="eyebrow mb-1">At this moment</h3>
      <p className="tabular mb-3 text-[22px] font-semibold tracking-tight">{formatOffset(moment.at)}</p>

      <h4 className="eyebrow mb-1">Going on</h4>
      {moment.now.length === 0 ? (
        <p className="mb-4 text-[13px] text-faint">Nothing. The run had not begun, or had ended.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-1">
          {moment.now.map(({ span, depth, elapsedMs }) => {
            const Icon = KIND_ICONS[span.kind];
            return (
              <li key={span.id} className="flex items-start gap-2 text-[13px]" style={{ paddingLeft: depth * 12 }}>
                <Icon size={14} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
                <span className="min-w-0 flex-1 break-words">{span.name}</span>
                <span className="tabular shrink-0 text-[12px] text-faint">{formatMs(elapsedMs)} so far</span>
              </li>
            );
          })}
        </ul>
      )}

      <h4 className="eyebrow mb-1">Shown so far · {moment.shown.length}</h4>
      {moment.shown.length === 0 ? (
        <p className="text-[13px] text-faint">Nothing yet.</p>
      ) : (
        <ol className="max-h-[280px] overflow-y-auto pr-1">
          {moment.shown.map((entry, index) => (
            <li key={entry.id} ref={index === moment.shown.length - 1 ? latest : undefined} className={`flex gap-2.5 border-t border-line/70 py-1.5 text-[13px] first:border-t-0 ${index === moment.shown.length - 1 ? "font-medium" : "text-muted"}`}>
              <span className="tabular w-[4.2rem] shrink-0 text-[12px] text-faint">{formatOffset(entry.at)}</span>
              <span className="min-w-0 break-words">{entry.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
