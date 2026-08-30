"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { TRACE_STATUS_LABELS } from "@/timeline/look";
import { NO_FILTERS, hasFilters, toggled, type Filters } from "@/trace/filters";
import { formatDate } from "@/trace/format";
import { SOURCES, SOURCE_LABELS, TRACE_STATUSES, type SourceName, type TraceStatus } from "@/trace/schema";

type Counts = {
  sources: Record<SourceName, number>;
  statuses: Record<TraceStatus, number>;
  agents: Record<string, number>;
};

type Props = {
  filters: Filters;
  /** How many runs there are for each choice, before any filter is applied. */
  counts: Counts;
  onChange: (next: Filters) => void;
};

// A filter is a label and its options in a row. An option is a bordered control on paper, so it reads as
// something to press; the ones that are on are filled with ink.
function Option({ pressed, empty, onClick, count, children }: { pressed: boolean; empty: boolean; onClick: () => void; count?: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      // A choice with no runs behind it is greyed with the faint text colour, which is picked to
      // pass the contrast minimum. Fading the whole option would drop its text below it.
      className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-[13px] font-medium transition-colors duration-150 sm:h-8 ${
        pressed ? "border-ink bg-ink text-paper" : empty ? "border-edge bg-paper text-ink-3 hover:bg-paper-2" : "border-edge bg-paper text-ink-2 hover:bg-paper-2 hover:text-ink"
      }`}
    >
      {children}
      {count === undefined ? null : <span className={`tabular text-[12.5px] font-normal ${pressed ? "text-paper" : "text-ink-3"}`}>{count}</span>}
    </button>
  );
}

// On a phone a group is one line that scrolls sideways; wider, its options wrap.
// The padding leaves room for the focus ring, which the scrolling box would cut.
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="label w-14 shrink-0" aria-hidden="true">
        {label}
      </span>
      <div className="-my-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 pl-1 sm:m-0 sm:flex-wrap sm:overflow-visible sm:p-0">{children}</div>
    </div>
  );
}

export function FilterBar({ filters, counts, onChange }: Props) {
  // The text is kept here while typing and sent to the address shortly after,
  // so each keystroke does not rewrite the page.
  const [text, setText] = useState(filters.q);
  const latest = useRef(filters);
  useEffect(() => {
    latest.current = filters;
  });
  useEffect(() => {
    if (text.trim() === latest.current.q) return;
    const timer = setTimeout(() => onChange({ ...latest.current, q: text.trim() }), 250);
    return () => clearTimeout(timer);
  }, [text, onChange]);

  const agents = Object.keys(counts.agents).sort();
  const statuses = TRACE_STATUSES.filter((status) => counts.statuses[status] > 0 || filters.statuses.includes(status));

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-8" role="search" aria-label="Filter the runs">
      <div className="flex min-w-0 flex-col gap-2">
        <Group label="App">
          {SOURCES.map((source) => (
            <Option key={source} pressed={filters.sources.includes(source)} empty={counts.sources[source] === 0} count={counts.sources[source]} onClick={() => onChange({ ...filters, sources: toggled(filters.sources, source) })}>
              {SOURCE_LABELS[source]}
            </Option>
          ))}
        </Group>
        <Group label="Result">
          {statuses.map((status) => (
            <Option key={status} pressed={filters.statuses.includes(status)} empty={counts.statuses[status] === 0} count={counts.statuses[status]} onClick={() => onChange({ ...filters, statuses: toggled(filters.statuses, status) })}>
              {TRACE_STATUS_LABELS[status]}
            </Option>
          ))}
        </Group>
        {filters.day ? (
          <Group label="Day">
            <Option pressed empty={false} onClick={() => onChange({ ...filters, day: null })}>
              {formatDate(`${filters.day}T12:00:00`)}
              <X size={13} aria-hidden="true" />
              <span className="sr-only">Remove this filter</span>
            </Option>
          </Group>
        ) : null}
        {agents.length > 0 ? (
          <Group label="Agent">
            {agents.map((agent) => (
              <Option key={agent} pressed={filters.agents.includes(agent)} empty={false} count={counts.agents[agent]} onClick={() => onChange({ ...filters, agents: toggled(filters.agents, agent) })}>
                {agent}
              </Option>
            ))}
          </Group>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* The search sits on paper, so its edge is found against the desk. */}
        <label className="ring-within relative flex h-11 w-full items-center gap-2 rounded-control border border-edge bg-paper px-3 sm:h-9 sm:w-[340px]">
          <Search size={15} className="shrink-0 text-ink-3" aria-hidden="true" />
          <span className="sr-only">Search the runs</span>
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Search by title, summary or agent"
            className="ring-on-parent h-full min-w-0 flex-1 bg-transparent text-[14px] placeholder:text-ink-3 focus:outline-none"
          />
        </label>
        {hasFilters(filters) ? (
          <Button
            variant="ghost"
            onClick={() => {
              setText("");
              onChange(NO_FILTERS);
            }}
          >
            <X size={14} aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
