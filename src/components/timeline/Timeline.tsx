"use client";

import { CircleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CATEGORY_FILL, CATEGORY_OF, KIND_LABELS, SPAN_STATUS_LABELS } from "@/timeline/look";
import { clusterMarkers, layoutOf, percentOf, ticksFor, type Cluster, type Row } from "@/timeline/rows";
import { formatMs, formatOffset, formatTick } from "@/trace/format";
import type { Span, Trace } from "@/trace/schema";
import { KIND_ICONS } from "./kinds";

// A run on a time axis: one row for each stretch of work, one bar on the row,
// and the things that happened at a moment drawn as small marks on it.
//
// Bars and marks are positioned in percentages of the track, so the picture
// follows the width of its box with no measuring. The width is read only to
// decide which marks are too close together to be drawn apart.

type Props = {
  trace: Trace;
  /** The ids of the spans shown in the detail panel. */
  selected: string[];
  onSelect: (ids: string[]) => void;
};

function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // The observer reports once when it starts, so the first width needs no separate read.
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** What shows when a bar or mark is hovered: the length first, since it is what the eye came for. */
function Tip({ span, align }: { span: Span; align: "left" | "right" }) {
  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute bottom-full z-20 mb-2 hidden w-max max-w-[260px] rounded-lg border border-line bg-surface px-2.5 py-2 text-left shadow-lift group-hover:block group-has-[:focus-visible]:block ${
        align === "right" ? "right-0" : "left-0"
      }`}
    >
      {span.durationMs > 0 ? <span className="tabular block text-[13px] font-semibold text-fg">{formatMs(span.durationMs)}</span> : null}
      <span className="block break-words text-[12.5px] leading-snug text-fg">{span.name}</span>
      <span className="mt-0.5 block text-[12px] leading-snug text-muted">
        {KIND_LABELS[span.kind]} · {SPAN_STATUS_LABELS[span.status]} · {formatOffset(span.startMs)}
      </span>
      {span.timing === "estimated" ? <span className="block text-[12px] text-faint">Worked out from the log</span> : null}
    </span>
  );
}

function BarButton({ span, durationMs, selected, onSelect }: { span: Span; durationMs: number; selected: boolean; onSelect: () => void }) {
  const left = percentOf(span.startMs, durationMs);
  const fill = CATEGORY_FILL[CATEGORY_OF[span.kind]];
  const dim = span.status === "skipped" || span.status === "stopped";
  return (
    <span className="group absolute top-1/2 -translate-y-1/2" style={{ left: `${left}%`, width: `max(${percentOf(span.durationMs, durationMs)}%, 5px)` }}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${span.name}. ${KIND_LABELS[span.kind]}, ${SPAN_STATUS_LABELS[span.status].toLowerCase()}. Starts ${formatOffset(span.startMs)}, took ${formatMs(span.durationMs)}.${
          span.timing === "estimated" ? " Worked out from the log." : ""
        }`}
        className={`block h-[14px] w-full rounded-[4px] ${fill} ${span.timing === "estimated" ? "hatched" : ""} ${dim ? "opacity-55" : ""} ${
          span.status === "failed" ? "shadow-[inset_0_-3px_0_var(--bad)]" : ""
        } ${selected ? "outline-2 outline-offset-2 outline-fg" : ""}`}
      />
      <Tip span={span} align={left > 60 ? "right" : "left"} />
    </span>
  );
}

function MarkButton({ span, durationMs, selected, onSelect }: { span: Span; durationMs: number; selected: boolean; onSelect: () => void }) {
  const left = percentOf(span.startMs, durationMs);
  return (
    <span className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%` }}>
      <button
        type="button"
        tabIndex={-1}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${span.name}, ${formatOffset(span.startMs)}`}
        className={`relative block h-[10px] w-[10px] rotate-45 rounded-[2px] ring-2 ring-surface before:absolute before:-inset-2 before:content-[''] ${
          span.status === "failed" ? "bg-bad" : selected ? "bg-accent" : CATEGORY_OF[span.kind] === "own" ? "bg-fg/70" : CATEGORY_FILL[CATEGORY_OF[span.kind]]
        } ${selected ? "scale-125" : ""}`}
      />
      <Tip span={span} align={left > 60 ? "right" : "left"} />
    </span>
  );
}

function ClusterButton({ cluster, durationMs, selected, onSelect }: { cluster: Cluster; durationMs: number; selected: boolean; onSelect: () => void }) {
  const left = percentOf(cluster.at, durationMs);
  const failed = cluster.items.filter((item) => item.status === "failed").length;
  return (
    <span className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%` }}>
      <button
        type="button"
        tabIndex={-1}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${cluster.items.length} things happened close together from ${formatOffset(cluster.at)}${failed > 0 ? `, ${failed} failed` : ""}`}
        className={`tabular relative flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-fg ring-1 before:absolute before:-inset-1.5 before:content-[''] ${
          selected ? "bg-fg text-bg ring-fg" : "bg-surface-2 ring-line-strong"
        } ${failed > 0 ? "shadow-[inset_0_-2px_0_var(--bad)]" : ""}`}
      >
        {cluster.items.length}
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full z-20 mb-2 hidden w-max max-w-[260px] rounded-lg border border-line bg-surface px-2.5 py-2 text-left shadow-lift group-hover:block ${
          left > 60 ? "right-0" : "left-0"
        }`}
      >
        <span className="block text-[13px] font-semibold">{cluster.items.length} close together</span>
        <span className="block text-[12px] text-muted">{cluster.items[0].name}, and more. Click to list them.</span>
      </span>
    </span>
  );
}

function RowView({
  row,
  durationMs,
  gapMs,
  selected,
  onSelect,
}: {
  row: Row;
  durationMs: number;
  gapMs: number;
  selected: Set<string>;
  onSelect: (ids: string[]) => void;
}) {
  const { span } = row;
  const Icon = KIND_ICONS[span.kind];
  const clusters = useMemo(() => clusterMarkers(row.markers, gapMs), [row.markers, gapMs]);
  return (
    <li className="flex min-h-10 flex-col border-t border-line/70 sm:grid sm:grid-cols-[var(--label)_1fr] sm:items-center">
      <div className="flex min-w-0 items-center gap-2 pb-0.5 pr-3 pt-2 sm:py-1" style={{ paddingLeft: row.depth * 14 }}>
        <Icon size={14} className="shrink-0 text-faint" aria-hidden="true" />
        <span className="min-w-0 truncate text-[13px]" title={span.name}>
          {span.name}
        </span>
        {span.status === "failed" ? (
          <>
            <CircleAlert size={13} className="shrink-0 text-bad" aria-hidden="true" />
            <span className="sr-only">(failed)</span>
          </>
        ) : null}
        <span className="tabular ml-auto shrink-0 text-[12px] text-faint">{formatMs(span.durationMs)}</span>
      </div>
      <div className="relative h-7 sm:h-10">
        <BarButton span={span} durationMs={durationMs} selected={selected.has(span.id)} onSelect={() => onSelect([span.id])} />
        {clusters.map((cluster) =>
          cluster.items.length === 1 ? (
            <MarkButton
              key={cluster.items[0].id}
              span={cluster.items[0]}
              durationMs={durationMs}
              selected={selected.has(cluster.items[0].id)}
              onSelect={() => onSelect([cluster.items[0].id])}
            />
          ) : (
            <ClusterButton
              key={cluster.items[0].id}
              cluster={cluster}
              durationMs={durationMs}
              selected={cluster.items.every((item) => selected.has(item.id)) && selected.size === cluster.items.length}
              onSelect={() => onSelect(cluster.items.map((item) => item.id))}
            />
          ),
        )}
      </div>
    </li>
  );
}

export function Timeline({ trace, selected, onSelect }: Props) {
  const layout = useMemo(() => layoutOf(trace), [trace]);
  const trackRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(trackRef);
  const ticks = useMemo(() => ticksFor(trace.durationMs, Math.max(3, Math.min(8, Math.round(width / 90)))), [trace.durationMs, width]);
  // Marks closer than this many milliseconds would sit on top of each other.
  const gapMs = (trace.durationMs * 16) / Math.max(width, 1);
  const chosen = useMemo(() => new Set(selected), [selected]);
  const topClusters = useMemo(() => clusterMarkers(layout.top, gapMs), [layout.top, gapMs]);

  return (
    <div className="relative [--label:0px] sm:[--label:min(14rem,34%)]">
      <div className="grid grid-cols-[var(--label)_1fr]">
        <div />
        <div ref={trackRef} className="relative h-7" aria-hidden="true">
          {ticks.map((tick) => {
            const at = percentOf(tick, trace.durationMs);
            return (
              <span
                key={tick}
                className="tabular absolute top-0 whitespace-nowrap text-[11px] text-faint"
                style={{ left: `${at}%`, transform: at === 0 ? "none" : at > 94 ? "translateX(-100%)" : "translateX(-50%)" }}
              >
                {formatTick(tick)}
              </span>
            );
          })}
        </div>
      </div>

      {/* Hairlines down from each tick, behind the bars. */}
      <div className="pointer-events-none absolute bottom-0 right-0 top-7" style={{ left: "var(--label)" }} aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} className="absolute inset-y-0 w-px bg-line" style={{ left: `${percentOf(tick, trace.durationMs)}%` }} />
        ))}
      </div>

      <ol aria-label="What happened, in order" className="relative">
        {layout.top.length > 0 ? (
          <li className="flex min-h-10 flex-col border-t border-line/70 sm:grid sm:grid-cols-[var(--label)_1fr] sm:items-center">
            <div className="pb-0.5 pr-3 pt-2 text-[13px] text-muted sm:py-1">The run</div>
            <div className="relative h-7 sm:h-10">
              {topClusters.map((cluster) =>
                cluster.items.length === 1 ? (
                  <MarkButton
                    key={cluster.items[0].id}
                    span={cluster.items[0]}
                    durationMs={trace.durationMs}
                    selected={chosen.has(cluster.items[0].id)}
                    onSelect={() => onSelect([cluster.items[0].id])}
                  />
                ) : (
                  <ClusterButton
                    key={cluster.items[0].id}
                    cluster={cluster}
                    durationMs={trace.durationMs}
                    selected={cluster.items.every((item) => chosen.has(item.id)) && chosen.size === cluster.items.length}
                    onSelect={() => onSelect(cluster.items.map((item) => item.id))}
                  />
                ),
              )}
            </div>
          </li>
        ) : null}
        {layout.rows.map((row) => (
          <RowView key={row.span.id} row={row} durationMs={trace.durationMs} gapMs={gapMs} selected={chosen} onSelect={onSelect} />
        ))}
      </ol>

      {layout.rows.length === 0 && layout.top.length === 0 ? <p className="border-t border-line py-6 text-[14px] text-muted">This run logged nothing that has a place on a timeline.</p> : null}
    </div>
  );
}
