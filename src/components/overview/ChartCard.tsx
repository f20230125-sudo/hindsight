"use client";

import { useState, type ReactNode } from "react";
import { Segmented } from "@/components/Segmented";

// The frame every chart sits in: a title, a sentence on what it shows, and a
// switch between the chart and the same numbers as a table. A chart is never
// the only way to reach a number.

type Props = {
  id: string;
  title: string;
  note: string;
  /** The chart. */
  children: ReactNode;
  /** The same data as a table. */
  table: ReactNode;
};

export function ChartCard({ id, title, note, children, table }: Props) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section aria-labelledby={`${id}-heading`} className="sheet min-w-0 p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id={`${id}-heading`} className="text-[18px] font-semibold">
            {title}
          </h2>
          <p className="mt-1 max-w-[64ch] text-[13px] leading-relaxed text-ink-2">{note}</p>
        </div>
        <Segmented
          label={`${title}: how to show it`}
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "chart", className: "capitalize" },
            { value: "table", label: "table", className: "capitalize" },
          ]}
        />
      </header>
      {view === "chart" ? (
        children
      ) : (
        // A table wider than the plate scrolls inside it. A scrolling box has to be reachable by the keyboard, so it is
        // a place in the tab order, with a name. (A group, not a region: the plate is already the region of this title.)
        <div role="group" aria-label={`${title}, as a table`} tabIndex={0} className="overflow-x-auto">
          {table}
        </div>
      )}
    </section>
  );
}

/** A table in the plain style every chart's table view uses. */
export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full min-w-[480px] text-left text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="label border-b border-rule">
          {head.map((label, index) => (
            <th key={label} scope="col" className={`py-2 font-medium ${index === 0 ? "pr-3" : "px-3 text-right"}`}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, at) => (
          <tr key={at} className="border-b border-rule">
            {row.map((cell, index) => (
              <td key={index} className={`tabular py-2 align-top ${index === 0 ? "pr-3" : "px-3 text-right"}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
