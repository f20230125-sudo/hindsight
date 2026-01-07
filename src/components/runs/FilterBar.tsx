"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SOURCE_ICONS } from "@/components/timeline/kinds";
import { TRACE_STATUS_LABELS } from "@/timeline/look";
import { hasFilters, toggled, type Filters } from "@/trace/filters";
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

function Chip({ pressed, empty, onClick, children }: { pressed: boolean; empty: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      // A choice with no runs behind it is greyed with the faint text colour, which is picked to
      // pass the contrast minimum. Fading the whole chip would drop its text below it.
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
        pressed
          ? "border-accent/50 bg-accent-soft text-accent"
          : empty
            ? "border-line bg-surface text-faint hover:bg-surface-2"
            : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="eyebrow mr-1" aria-hidden="true">
        {label}
      </span>
      {children}
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
    <div className="flex flex-col gap-3" role="search" aria-label="Filter the runs">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Group label="App">
          {SOURCES.map((source) => {
            const Icon = SOURCE_ICONS[source];
            return (
              <Chip key={source} pressed={filters.sources.includes(source)} empty={counts.sources[source] === 0} onClick={() => onChange({ ...filters, sources: toggled(filters.sources, source) })}>
                <Icon size={14} aria-hidden="true" />
                {SOURCE_LABELS[source]}
                <span className="tabular text-[12px] text-faint">{counts.sources[source]}</span>
              </Chip>
            );
          })}
        </Group>
        <Group label="Result">
          {statuses.map((status) => (
            <Chip key={status} pressed={filters.statuses.includes(status)} empty={counts.statuses[status] === 0} onClick={() => onChange({ ...filters, statuses: toggled(filters.statuses, status) })}>
              {TRACE_STATUS_LABELS[status]}
              <span className="tabular text-[12px] text-faint">{counts.statuses[status]}</span>
            </Chip>
          ))}
        </Group>
        {agents.length > 0 ? (
          <Group label="Agent">
            {agents.map((agent) => (
              <Chip key={agent} pressed={filters.agents.includes(agent)} empty={false} onClick={() => onChange({ ...filters, agents: toggled(filters.agents, agent) })}>
                {agent}
                <span className="tabular text-[12px] text-faint">{counts.agents[agent]}</span>
              </Chip>
            ))}
          </Group>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="ring-within relative flex h-9 w-full max-w-[360px] items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search size={15} className="shrink-0 text-faint" aria-hidden="true" />
          <span className="sr-only">Search the runs</span>
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Search by title, summary or agent"
            className="ring-on-parent min-w-0 flex-1 bg-transparent text-[14px] placeholder:text-faint focus:outline-none"
          />
        </label>
        {hasFilters(filters) ? (
          <button
            type="button"
            onClick={() => {
              setText("");
              onChange({ sources: [], agents: [], statuses: [], q: "" });
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X size={14} aria-hidden="true" />
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
