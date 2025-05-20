"use client";

import { useState, type ReactNode } from "react";

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
    <section aria-labelledby={`${id}-heading`} className="panel p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id={`${id}-heading`} className="text-[16px] font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mt-1 max-w-[64ch] text-[13px] leading-relaxed text-muted">{note}</p>
        </div>
        <div role="group" aria-label={`${title}: how to show it`} className="inline-flex shrink-0 rounded-lg border border-line bg-surface p-0.5">
          {(["chart", "table"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={`h-7 rounded-md px-2.5 text-[12.5px] font-medium capitalize transition-colors ${view === value ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
            >
              {value}
            </button>
          ))}
        </div>
      </header>
      {view === "chart" ? children : <div className="overflow-x-auto">{table}</div>}
    </section>
  );
}

/** A table in the plain style every chart's table view uses. */
export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full min-w-[480px] text-left text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="eyebrow border-b border-line">
          {head.map((label, index) => (
            <th key={label} scope="col" className={`py-2 font-medium ${index === 0 ? "pr-3" : "px-3 text-right"}`}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, at) => (
          <tr key={at} className="border-b border-line/70">
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
