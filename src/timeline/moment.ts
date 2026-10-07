import type { Span, SpanKind, Trace } from "@/trace/schema";

// A run at one moment: what was going on, and what the person had been shown.
// Moving the playhead along the timeline asks this for each moment it passes.

export type Moment = {
  at: number;
  /** Bars that have begun and not yet finished, the ones holding others first. */
  now: { span: Span; depth: number; elapsedMs: number }[];
  /** What had been said or shown by then, oldest first. */
  shown: { id: string; at: number; text: string; kind: SpanKind }[];
};

export function momentAt(trace: Trace, at: number): Moment {
  const byId = new Map(trace.spans.map((span) => [span.id, span]));
  const depthOf = (span: Span): number => {
    let depth = 0;
    for (let parent = span.parentId ? byId.get(span.parentId) : undefined; parent; parent = parent.parentId ? byId.get(parent.parentId) : undefined) depth += 1;
    return depth;
  };

  const now = trace.spans
    .filter((span) => span.durationMs > 0 && span.startMs <= at && at < span.startMs + span.durationMs)
    .map((span) => ({ span, depth: depthOf(span), elapsedMs: at - span.startMs }))
    .sort((a, b) => a.depth - b.depth || a.span.startMs - b.span.startMs);

  const shown = trace.spans
    .filter((span) => span.shown !== undefined && span.startMs <= at)
    .sort((a, b) => a.startMs - b.startMs)
    .map((span) => ({ id: span.id, at: span.startMs, text: span.shown!, kind: span.kind }));

  return { at, now, shown };
}
