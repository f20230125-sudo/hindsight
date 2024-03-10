import type { Json } from "@/trace/json";
import { toRecord } from "@/trace/json";
import type { Origin, Span, SpanKind, SpanStatus, Trace, TraceStatus } from "@/trace/schema";
import type { FlowboardRun, FlowboardStep } from "./schema";

// The last run of a Flowboard flow as a Trace.
//
// Every block that ran is a bar, from when it began to when it finished. Blocks
// run side by side when nothing joins them, so bars can overlap. A block that
// did not run is a mark, with the reason, placed where the run decided to leave
// it out.

type Options = { origin: Origin };

const TYPE_LABELS: Record<string, string> = {
  trigger: "Trigger",
  http: "HTTP request",
  condition: "Condition",
  set: "Set",
  filter: "Filter",
  ai: "AI",
  delay: "Delay",
  output: "Output",
};

const REASONS: Record<string, string> = {
  "not-connected": "nothing leads to it from the trigger",
  "in-loop": "it is part of a loop",
  "no-data": "the path into it was not taken",
  "run-ended": "the run ended before it was reached",
};

const STATUS: Record<FlowboardStep["status"], SpanStatus> = {
  running: "ok",
  succeeded: "ok",
  failed: "failed",
  skipped: "skipped",
  cancelled: "stopped",
};

const RUN_STATUS: Record<FlowboardRun["run"]["status"], TraceStatus> = {
  idle: "stopped",
  running: "running",
  succeeded: "ok",
  failed: "failed",
  stopped: "stopped",
};

const clip = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

/** An AI block with no key answers with a sample. No model was called, so it is not drawn as a call to one. */
const answeredBySample = (step: FlowboardStep) => (step.note ?? "").toLowerCase().startsWith("sample reply");

export function adaptFlowboard(data: FlowboardRun, { origin }: Options): Trace {
  const { flow, run } = data;
  const blocks = new Map(flow.blocks.map((block) => [block.id, block]));
  const t0 = run.startedAt ?? Math.min(...run.steps.map((step) => step.startedAt ?? Number.POSITIVE_INFINITY), 0);
  const rel = (at: number) => Math.max(0, Math.round(at - t0));

  const ranUntil = run.steps.reduce((latest, step) => (step.startedAt !== null ? Math.max(latest, rel(step.startedAt) + Math.round(step.ms ?? 0)) : latest), 0);
  const durationMs = Math.max(Math.round(run.ms ?? 0), ranUntil);

  // When each block that ran was done, so a block left out can be placed when it was decided.
  const finishedAt = new Map<string, number>();
  for (const step of run.steps) if (step.startedAt !== null) finishedAt.set(step.id, rel(step.startedAt) + Math.round(step.ms ?? 0));

  const spans: Span[] = [];
  for (const step of run.steps) {
    const block = blocks.get(step.id);
    const type = block?.type ?? "unknown";
    const name = `${block?.name ?? "(a block that was deleted)"} · ${TYPE_LABELS[type] ?? type}`;
    const status = STATUS[step.status];

    if (step.startedAt === null) {
      // It never began. It was left out when the blocks leading to it settled, or when the run ended.
      const sources = flow.connections.filter((connection) => connection.to === step.id).map((connection) => finishedAt.get(connection.from));
      const known = sources.filter((at): at is number => at !== undefined);
      const decided = step.reason === "run-ended" ? durationMs : known.length > 0 ? Math.max(...known) : 0;
      spans.push({
        id: `block-${step.id}`,
        parentId: null,
        kind: "step",
        name,
        startMs: Math.min(decided, durationMs),
        durationMs: 0,
        status: "skipped",
        // The run does not note the moment a block is left out; this is when the blocks before it were done.
        timing: "estimated",
        shown: undefined,
        attributes: { type, reason: step.reason ?? null, why: step.reason ? (REASONS[step.reason] ?? step.reason) : null },
      });
      continue;
    }

    const sample = type === "ai" && answeredBySample(step);
    const kind: SpanKind = type === "http" ? "tool" : type === "ai" && !sample ? "model" : "step";
    const output = step.output;
    const attributes = toRecord({
      type,
      branch: step.branch,
      note: step.note,
      error: step.error,
      httpStatus: type === "http" && output !== null && typeof output === "object" && !Array.isArray(output) ? (output as { status?: Json }).status : undefined,
    });
    // What a flow ends with is what the person who ran it sees.
    const shown = type === "output" && output !== null ? clip(typeof output === "string" ? output : JSON.stringify(output), 500) : undefined;

    spans.push({
      id: `block-${step.id}`,
      parentId: null,
      kind,
      name: sample ? `${name}, sample reply` : name,
      startMs: Math.min(rel(step.startedAt), durationMs),
      durationMs: Math.min(Math.round(step.ms ?? 0), Math.max(0, durationMs - rel(step.startedAt))),
      status,
      timing: "measured",
      ...(shown ? { shown } : {}),
      attributes,
      ...(step.input !== null ? { input: step.input } : {}),
      ...(output !== null ? { output } : {}),
    });
  }

  spans.sort((a, b) => a.startMs - b.startMs);

  const failed = run.steps.find((step) => step.status === "failed");
  const ran = run.steps.filter((step) => step.startedAt !== null).length;
  const summary =
    failed?.error
      ? `${blocks.get(failed.id)?.name ?? "A block"} failed: ${clip(failed.error.message, 200)}`
      : `${ran} of ${flow.blocks.length} ${flow.blocks.length === 1 ? "block" : "blocks"} ran`;

  const modelCalls = spans.filter((span) => span.kind === "model").length;

  return {
    id: `flowboard:${run.startedAt ?? 0}`,
    source: "flowboard",
    agent: null,
    title: clip(flow.name, 500),
    summary,
    startedAt: run.startedAt === null ? null : new Date(run.startedAt).toISOString(),
    durationMs,
    status: RUN_STATUS[run.status],
    spans,
    totals: {
      calls: spans.filter((span) => span.kind === "tool" || span.kind === "model").length,
      modelCalls,
      tokens: null,
      failures: spans.filter((span) => span.status === "failed").length,
      avoided: null,
    },
    origin,
  };
}
