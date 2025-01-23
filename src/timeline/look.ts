import type { SpanKind, SpanStatus, TraceStatus } from "@/trace/schema";

// How a span looks. Three kinds of time are worth telling apart at a glance,
// and each has a colour; everything else the app does is grey, because it is
// not an identity, only the rest of the work.

export type Category = "model" | "call" | "wait" | "own";

export const CATEGORY_OF: Record<SpanKind, Category> = {
  understand: "own",
  plan: "own",
  step: "own",
  tool: "call",
  model: "model",
  wait: "wait",
  check: "own",
  said: "own",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  model: "Model calls",
  call: "API calls",
  wait: "Waiting for a person",
  own: "The app's own steps",
};

/** Static class names, so Tailwind finds them. */
export const CATEGORY_FILL: Record<Category, string> = {
  model: "bg-viz-model",
  call: "bg-viz-call",
  wait: "bg-viz-wait",
  own: "bg-viz-own",
};

export const KIND_LABELS: Record<SpanKind, string> = {
  understand: "Understanding",
  plan: "Planning",
  step: "Step",
  tool: "API call",
  model: "Model call",
  wait: "Waiting for a person",
  check: "Check",
  said: "Said to the person",
};

export const SPAN_STATUS_LABELS: Record<SpanStatus, string> = {
  ok: "Done",
  failed: "Failed",
  skipped: "Skipped",
  stopped: "Stopped",
};

export const TRACE_STATUS_LABELS: Record<TraceStatus, string> = {
  ok: "Succeeded",
  failed: "Failed",
  stopped: "Stopped",
  waiting: "Waiting",
  running: "Running",
};
