import type { Span, Trace } from "@/trace/schema";

// Small runs to build tests from.

export function makeSpan(id: string, over: Partial<Span> = {}): Span {
  return {
    id,
    parentId: null,
    kind: "step",
    name: id,
    startMs: 0,
    durationMs: 10,
    status: "ok",
    timing: "measured",
    attributes: {},
    ...over,
  };
}

export function makeTrace(over: Partial<Trace> = {}): Trace {
  return {
    id: "sayso:turn-1",
    source: "sayso",
    agent: null,
    title: "A window seat on my London flight",
    summary: null,
    startedAt: "2026-10-07T10:00:00.000Z",
    durationMs: 1000,
    status: "ok",
    spans: [],
    totals: { calls: 0, modelCalls: 0, tokens: null, failures: 0, avoided: null },
    origin: { how: "sent", at: "2026-10-07T10:05:00.000Z" },
    ...over,
  };
}
