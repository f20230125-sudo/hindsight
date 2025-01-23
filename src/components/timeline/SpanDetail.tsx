"use client";

import { useMemo } from "react";
import { JsonTree } from "@/components/JsonTree";
import { KIND_LABELS, SPAN_STATUS_LABELS } from "@/timeline/look";
import { formatMs, formatOffset } from "@/trace/format";
import type { Json } from "@/trace/json";
import type { Span, Trace } from "@/trace/schema";
import { KIND_ICONS } from "./kinds";

// What the timeline's selection says in words and data: when it began, how
// long it took, what it was part of, what it held, and everything the app
// recorded about it.

type Props = {
  trace: Trace;
  selected: string[];
  onSelect: (ids: string[]) => void;
};

const LISTED = 40;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-2 text-[13px] first:border-t-0">
      <dt className="shrink-0 text-faint">{label}</dt>
      <dd className="tabular min-w-0 break-words text-right">{children}</dd>
    </div>
  );
}

function SpanButton({ span, onSelect }: { span: Span; onSelect: () => void }) {
  const Icon = KIND_ICONS[span.kind];
  return (
    <li>
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-surface-2">
        <Icon size={14} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{span.name}</span>
          {span.shown && span.shown !== span.name ? <span className="block truncate text-[12px] text-faint">{span.shown}</span> : null}
        </span>
        <span className="tabular shrink-0 text-[12px] text-faint">{formatOffset(span.startMs)}</span>
      </button>
    </li>
  );
}

function Empty() {
  return (
    <div>
      <h3 className="eyebrow mb-2">Detail</h3>
      <p className="text-[14px] leading-relaxed text-muted">
        Select a bar or a mark on the timeline to see what happened there: when it began, how long it took, and everything the app recorded about it.
      </p>
    </div>
  );
}

function Group({ trace, spans, onSelect }: { trace: Trace; spans: Span[]; onSelect: (ids: string[]) => void }) {
  return (
    <div>
      <h3 className="eyebrow mb-1">{spans.length} close together</h3>
      <p className="mb-2 text-[13px] text-muted">
        From {formatOffset(spans[0].startMs)} to {formatOffset(spans.at(-1)?.startMs ?? 0)} in a run of {formatMs(trace.durationMs)}. Pick one to see it.
      </p>
      <ul className="-mx-2 max-h-[420px] overflow-y-auto">
        {spans.slice(0, 200).map((span) => (
          <SpanButton key={span.id} span={span} onSelect={() => onSelect([span.id])} />
        ))}
      </ul>
      {spans.length > 200 ? <p className="mt-2 text-[12px] text-faint">Showing the first 200 of {spans.length}.</p> : null}
    </div>
  );
}

function One({ trace, span, onSelect }: { trace: Trace; span: Span; onSelect: (ids: string[]) => void }) {
  const Icon = KIND_ICONS[span.kind];
  const parent = span.parentId ? trace.spans.find((other) => other.id === span.parentId) : undefined;
  const inside = useMemo(() => trace.spans.filter((other) => other.parentId === span.id).sort((a, b) => a.startMs - b.startMs), [trace.spans, span.id]);

  const { note, rest } = useMemo(() => {
    const { note: said, ...others } = span.attributes;
    return { note: typeof said === "string" ? said : null, rest: others as { [key: string]: Json } };
  }, [span.attributes]);

  return (
    <div>
      <h3 className="eyebrow mb-2">Detail</h3>
      <div className="flex items-start gap-2">
        <Icon size={16} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
        <p className="min-w-0 break-words text-[15px] font-medium leading-snug">{span.name}</p>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {KIND_LABELS[span.kind]} · {SPAN_STATUS_LABELS[span.status]}
      </p>

      {span.timing === "estimated" ? (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-muted">
          {note ?? "The app did not record this exactly. Its place on the timeline is worked out from what was logged."}
        </p>
      ) : null}

      <dl className="mt-3">
        <Row label="Starts">{formatOffset(span.startMs)}</Row>
        <Row label="Took">{span.durationMs > 0 ? formatMs(span.durationMs) : "A moment"}</Row>
        {span.durationMs > 0 ? <Row label="Ends">{formatOffset(span.startMs + span.durationMs)}</Row> : null}
        {parent ? (
          <Row label="Part of">
            <button type="button" onClick={() => onSelect([parent.id])} className="text-accent underline-offset-2 hover:underline">
              {parent.name}
            </button>
          </Row>
        ) : null}
      </dl>

      {span.shown ? (
        <div className="mt-3">
          <h4 className="eyebrow mb-1">Shown to the person</h4>
          <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">{span.shown}</p>
        </div>
      ) : null}

      {inside.length > 0 ? (
        <div className="mt-4">
          <h4 className="eyebrow mb-1">Inside this step · {inside.length}</h4>
          <ul className="-mx-2 max-h-[300px] overflow-y-auto">
            {inside.slice(0, LISTED).map((child) => (
              <SpanButton key={child.id} span={child} onSelect={() => onSelect([child.id])} />
            ))}
          </ul>
          {inside.length > LISTED ? <p className="mt-1 text-[12px] text-faint">And {inside.length - LISTED} more.</p> : null}
        </div>
      ) : null}

      <div className="mt-4">
        <h4 className="eyebrow mb-1">Recorded data</h4>
        {Object.keys(rest).length > 0 ? <JsonTree value={rest} label="attributes" openDepth={1} /> : <p className="text-[13px] text-faint">Nothing more was recorded.</p>}
        {span.input !== undefined ? <JsonTree value={span.input} label="input" openDepth={0} /> : null}
        {span.output !== undefined ? <JsonTree value={span.output} label="output" openDepth={0} /> : null}
      </div>
    </div>
  );
}

export function SpanDetail({ trace, selected, onSelect }: Props) {
  const byId = useMemo(() => new Map(trace.spans.map((span) => [span.id, span])), [trace.spans]);
  const spans = selected.map((id) => byId.get(id)).filter((span): span is Span => span !== undefined);

  return (
    <div className="panel p-4" aria-live="polite">
      {spans.length === 0 ? <Empty /> : spans.length > 1 ? <Group trace={trace} spans={spans} onSelect={onSelect} /> : <One trace={trace} span={spans[0]} onSelect={onSelect} />}
    </div>
  );
}
