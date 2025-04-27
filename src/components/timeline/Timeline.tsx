"use client";

import { CircleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { CATEGORY_FILL, CATEGORY_OF, KIND_LABELS, SPAN_STATUS_LABELS } from "@/timeline/look";
import { clusterMarkers, layoutOf, type Cluster } from "@/timeline/rows";
import { axisTicks, type Scale } from "@/timeline/scale";
import { formatMs, formatOffset, formatTick } from "@/trace/format";
import type { Span, Trace } from "@/trace/schema";
import { KIND_ICONS } from "./kinds";

// A run on a time axis: one row for each stretch of work, one bar on the row,
// and the things that happened at a moment drawn as small marks on it.
//
// Bars and marks are placed in percentages of the track, from the scale, so the
// picture follows the width of its box. The width is read only to decide which
// marks are too close together to be drawn apart, and which times to label.
//
// The whole thing is one place in the tab order. Inside it the arrow keys move
// from bar to bar and mark to mark, so a run can be read with no pointer.

type Props = {
  trace: Trace;
  scale: Scale;
  /** The ids of the spans shown in the detail panel. */
  selected: string[];
  onSelect: (ids: string[]) => void;
  /** Where the playhead is, if it is shown. */
  playhead: number | null;
  /** The traveller pointed at the time axis. */
  onPlayhead: (ms: number) => void;
};

/** Marks closer together than this on the track are drawn as one. */
const CLUSTER_PX = 16;

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

/** What shows when a bar or mark is hovered or focused: the length first, since it is what the eye came for. */
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

/** What a button in the timeline needs to take part in moving about with the arrow keys. */
type Roving = { item: string; tabIndex: number; onFocus: () => void };

type Placed = { span: Span; left: number; right: number };

function BarButton({ placed, selected, roving, onSelect }: { placed: Placed; selected: boolean; roving: Roving; onSelect: () => void }) {
  const { span, left, right } = placed;
  const fill = CATEGORY_FILL[CATEGORY_OF[span.kind]];
  const dim = span.status === "skipped" || span.status === "stopped";
  return (
    <span className="group absolute top-1/2 -translate-y-1/2" style={{ left: `${left * 100}%`, width: `max(${(right - left) * 100}%, 5px)` }}>
      <button
        type="button"
        data-item={roving.item}
        tabIndex={roving.tabIndex}
        onFocus={roving.onFocus}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${span.name}. ${KIND_LABELS[span.kind]}, ${SPAN_STATUS_LABELS[span.status].toLowerCase()}. Starts ${formatOffset(span.startMs)}, took ${formatMs(span.durationMs)}.${
          span.timing === "estimated" ? " Worked out from the log." : ""
        }`}
        className={`block h-[14px] w-full rounded-[4px] ${fill} ${span.timing === "estimated" ? "hatched" : ""} ${dim ? "opacity-55" : ""} ${
          span.status === "failed" ? "shadow-[inset_0_-3px_0_var(--bad)]" : ""
        } ${selected ? "outline-2 outline-offset-2 outline-fg" : ""}`}
      />
      <Tip span={span} align={left > 0.6 ? "right" : "left"} />
    </span>
  );
}

function MarkButton({ span, at, selected, roving, onSelect }: { span: Span; at: number; selected: boolean; roving: Roving; onSelect: () => void }) {
  return (
    <span className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${at * 100}%` }}>
      <button
        type="button"
        data-item={roving.item}
        tabIndex={roving.tabIndex}
        onFocus={roving.onFocus}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${span.name}, ${formatOffset(span.startMs)}`}
        className={`relative block h-[10px] w-[10px] rotate-45 rounded-[2px] ring-2 ring-surface before:absolute before:-inset-2 before:content-[''] ${
          span.status === "failed" ? "bg-bad" : selected ? "bg-accent" : CATEGORY_OF[span.kind] === "own" ? "bg-fg/70" : CATEGORY_FILL[CATEGORY_OF[span.kind]]
        } ${selected ? "scale-125" : ""}`}
      />
      <Tip span={span} align={at > 0.6 ? "right" : "left"} />
    </span>
  );
}

function ClusterButton({ cluster, at, selected, roving, onSelect }: { cluster: Cluster; at: number; selected: boolean; roving: Roving; onSelect: () => void }) {
  const failed = cluster.items.filter((item) => item.status === "failed").length;
  return (
    <span className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${at * 100}%` }}>
      <button
        type="button"
        data-item={roving.item}
        tabIndex={roving.tabIndex}
        onFocus={roving.onFocus}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${cluster.items.length} things happened close together from ${formatOffset(cluster.at)}${failed > 0 ? `, ${failed} failed` : ""}`}
        className={`tabular relative flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ring-1 before:absolute before:-inset-1.5 before:content-[''] ${
          selected ? "bg-fg text-bg ring-fg" : "bg-surface-2 text-fg ring-line-strong"
        } ${failed > 0 ? "shadow-[inset_0_-2px_0_var(--bad)]" : ""}`}
      >
        {cluster.items.length}
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full z-20 mb-2 hidden w-max max-w-[260px] rounded-lg border border-line bg-surface px-2.5 py-2 text-left shadow-lift group-hover:block group-has-[:focus-visible]:block ${
          at > 0.6 ? "right-0" : "left-0"
        }`}
      >
        <span className="block text-[13px] font-semibold">{cluster.items.length} close together</span>
        <span className="block text-[12px] text-muted">{cluster.items[0].name}, and more. Choose to list them.</span>
      </span>
    </span>
  );
}

type RowModel = {
  key: string;
  /** The span that has the row, or null for the top row that holds marks nothing else holds. */
  span: Span | null;
  depth: number;
  bar: Placed | null;
  marks: { cluster: Cluster; at: number }[];
};

function RowLabel({ row }: { row: RowModel }) {
  if (!row.span) return <span className="text-[13px] text-muted">The run</span>;
  const Icon = KIND_ICONS[row.span.kind];
  return (
    <>
      <Icon size={14} className="shrink-0 text-faint" aria-hidden="true" />
      <span className="line-clamp-2 min-w-0 break-words text-[13px] leading-tight" title={row.span.name}>
        {row.span.name}
      </span>
      {row.span.status === "failed" ? (
        <>
          <CircleAlert size={13} className="shrink-0 text-bad" aria-hidden="true" />
          <span className="sr-only">(failed)</span>
        </>
      ) : null}
      <span className="tabular ml-auto shrink-0 text-[12px] text-faint">{formatMs(row.span.durationMs)}</span>
    </>
  );
}

export function Timeline({ trace, scale, selected, onSelect, playhead, onPlayhead }: Props) {
  const layout = useMemo(() => layoutOf(trace), [trace]);
  const trackRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const width = useElementWidth(trackRef);
  const chosen = useMemo(() => new Set(selected), [selected]);
  const ticks = useMemo(() => axisTicks(scale, width), [scale, width]);

  // What is on the track: bars that overlap the window, and marks inside it.
  const model = useMemo<RowModel[]>(() => {
    const px = (ms: number) => scale.x(ms) * width;
    const inside = (ms: number) => scale.x(ms) >= -0.0001 && scale.x(ms) <= 1.0001;
    const marksOf = (markers: Span[]) =>
      clusterMarkers(markers.filter((marker) => inside(marker.startMs)), px, CLUSTER_PX).map((cluster) => ({ cluster, at: scale.x(cluster.at) }));

    const rows: RowModel[] = [];
    const top = marksOf(layout.top);
    if (top.length > 0) rows.push({ key: "top", span: null, depth: 0, bar: null, marks: top });
    for (const row of layout.rows) {
      const left = scale.x(row.span.startMs);
      const right = scale.x(row.span.startMs + row.span.durationMs);
      const visible = right > 0 && left < 1;
      rows.push({
        key: row.span.id,
        span: row.span,
        depth: row.depth,
        bar: visible ? { span: row.span, left: Math.max(0, left), right: Math.min(1, right) } : null,
        marks: marksOf(row.markers),
      });
    }
    return rows;
  }, [layout, scale, width]);

  // Where the arrow keys are. One button in the whole timeline is in the tab order: this one.
  const [cursor, setCursor] = useState({ row: 0, col: 0 });
  const itemsOf = (row: RowModel) => (row.bar ? 1 : 0) + row.marks.length;
  const place = (row: number, col: number) => {
    const r = Math.max(0, Math.min(model.length - 1, row));
    const count = model[r] ? itemsOf(model[r]) : 0;
    return { row: r, col: Math.max(0, Math.min(Math.max(0, count - 1), col)) };
  };
  const at = place(cursor.row, cursor.col);
  const roving = (row: number, col: number): Roving => ({
    item: `${row}-${col}`,
    tabIndex: at.row === row && at.col === col ? 0 : -1,
    onFocus: () => setCursor({ row, col }),
  });

  const move = (next: { row: number; col: number }) => {
    const target = place(next.row, next.col);
    setCursor(target);
    listRef.current?.querySelector<HTMLElement>(`[data-item="${target.row}-${target.col}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    const row = model[at.row];
    if (!row) return;
    const last = itemsOf(row) - 1;
    switch (event.key) {
      case "ArrowRight":
        move({ row: at.row, col: at.col + 1 });
        break;
      case "ArrowLeft":
        move({ row: at.row, col: at.col - 1 });
        break;
      case "ArrowDown":
        move({ row: at.row + 1, col: at.col });
        break;
      case "ArrowUp":
        move({ row: at.row - 1, col: at.col });
        break;
      case "Home":
        move(event.ctrlKey ? { row: 0, col: 0 } : { row: at.row, col: 0 });
        break;
      case "End":
        move(event.ctrlKey ? { row: model.length - 1, col: 0 } : { row: at.row, col: last });
        break;
      case "Escape":
        onSelect([]);
        return;
      default:
        return;
    }
    event.preventDefault();
  };

  /** A press or drag on the axis sets the playhead. */
  const pointAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onPlayhead(Math.round(scale.ms(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)))));
  };

  const playheadAt = playhead !== null ? scale.x(playhead) : null;
  const showPlayhead = playheadAt !== null && playheadAt >= 0 && playheadAt <= 1;

  const marksOf = (row: RowModel, rowIndex: number) =>
    row.marks.map(({ cluster, at: position }, index) => {
      const col = (row.bar ? 1 : 0) + index;
      const ids = cluster.items.map((item) => item.id);
      const isSelected = ids.length === selected.length && ids.every((id) => chosen.has(id));
      return cluster.items.length === 1 ? (
        <MarkButton key={ids[0]} span={cluster.items[0]} at={position} selected={isSelected} roving={roving(rowIndex, col)} onSelect={() => onSelect(ids)} />
      ) : (
        <ClusterButton key={ids[0]} cluster={cluster} at={position} selected={isSelected} roving={roving(rowIndex, col)} onSelect={() => onSelect(ids)} />
      );
    });

  const nothingShown = model.every((row) => row.bar === null && row.marks.length === 0);

  return (
    <div className="relative [--label:0px] sm:[--label:min(15rem,36%)]">
      {/* The time axis. Pointing at it moves the playhead; the slider under the timeline does the same for the keyboard. */}
      <div className="grid grid-cols-[var(--label)_1fr]">
        <div />
        <div
          ref={trackRef}
          data-testid="time-axis"
          className="relative h-8 cursor-col-resize touch-none select-none"
          aria-hidden="true"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            pointAt(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons === 1) pointAt(event);
          }}
        >
          {ticks.map((tick) => (
            <span
              key={tick.ms}
              className="tabular absolute top-1 whitespace-nowrap text-[11px] text-faint"
              style={{ left: `${tick.x * 100}%`, transform: tick.x < 0.02 ? "none" : tick.x > 0.94 ? "translateX(-100%)" : "translateX(-50%)" }}
            >
              {formatTick(tick.ms)}
            </span>
          ))}
          {scale.breaks.map((gap) =>
            (gap.x1 - gap.x0) * width >= 54 ? (
              <span key={gap.from} className="absolute bottom-0 top-5 flex items-center justify-center text-[10px] text-faint" style={{ left: `${gap.x0 * 100}%`, width: `${(gap.x1 - gap.x0) * 100}%` }}>
                {formatMs(gap.to - gap.from)}
              </span>
            ) : null,
          )}
          {showPlayhead ? <span className="absolute bottom-0 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-accent" style={{ left: `${playheadAt * 100}%` }} /> : null}
        </div>
      </div>

      {/* Behind the bars: a hairline at each labelled time, a band where a wait was squeezed, and the playhead. */}
      <div className="pointer-events-none absolute bottom-0 right-0 top-8" style={{ left: "var(--label)" }} aria-hidden="true">
        {scale.breaks.map((gap) => (
          <span key={gap.from} className="break-band absolute inset-y-0" style={{ left: `${gap.x0 * 100}%`, width: `${(gap.x1 - gap.x0) * 100}%` }} />
        ))}
        {ticks.map((tick) => (
          <span key={tick.ms} className="absolute inset-y-0 w-px bg-line" style={{ left: `${tick.x * 100}%` }} />
        ))}
        {showPlayhead ? <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent" style={{ left: `${playheadAt * 100}%` }} /> : null}
      </div>

      <ol ref={listRef} aria-label="What happened, in order" className="relative" onKeyDown={onKeyDown}>
        {model.map((row, rowIndex) => (
          <li key={row.key} className="flex min-h-10 flex-col border-t border-line/70 sm:grid sm:grid-cols-[var(--label)_1fr] sm:items-center">
            <div className="flex min-w-0 items-center gap-2 pb-0.5 pr-3 pt-2 sm:py-1" style={{ paddingLeft: row.depth * 14 }}>
              <RowLabel row={row} />
            </div>
            <div className="relative h-7 sm:h-10">
              {row.bar ? <BarButton placed={row.bar} selected={selected.length === 1 && chosen.has(row.bar.span.id)} roving={roving(rowIndex, 0)} onSelect={() => onSelect([row.bar!.span.id])} /> : null}
              {marksOf(row, rowIndex)}
            </div>
          </li>
        ))}
      </ol>

      {model.length === 0 ? <p className="border-t border-line py-6 text-[14px] text-muted">This run logged nothing that has a place on a timeline.</p> : null}
      {model.length > 0 && nothingShown ? <p className="border-t border-line py-6 text-[14px] text-muted">Nothing happened in the part of the run that is on show. Zoom out to see the rest.</p> : null}
    </div>
  );
}
