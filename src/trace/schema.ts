import { z } from "zod";
import { jsonSchema } from "./json";

// The one shape every page of Hindsight reads. Each of the four apps keeps its
// runs in its own way; an adapter in src/sources turns that into a Trace, and
// nothing outside src/sources knows where a Trace came from.
//
// The schema is the source of truth: the types are worked out from it, and the
// same schema checks anything that arrives from outside (a run sent by another
// app, a file dropped on the page, a copy kept in the browser's storage).

// Zod can make its checks faster by building code from text, and finds out
// whether it may by trying. The pages forbid code made from text (see
// next.config.ts), so the try is refused, and the browser reports it as a
// breach of the page's policy though nothing came of it. Told this, Zod does
// not try. Nothing is checked while the modules are still loading, and every
// module that checks a run loads this one, so this is always said in time.
z.config({ jitless: true });

export const SOURCES = ["sayso", "flowboard", "agent-desk", "github-bot"] as const;
export type SourceName = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<SourceName, string> = {
  sayso: "Sayso",
  flowboard: "Flowboard",
  "agent-desk": "Agent Desk",
  "github-bot": "GitHub bot",
};

/**
 * What a span is.
 * - understand: reading the words (Sayso)
 * - plan: working out the steps
 * - step: a stage of the work, such as "sync" or a block of a flow
 * - tool: a call to an API
 * - model: a call to a language model
 * - wait: the run was held up for a person
 * - check: a check of the result, or a finding
 * - said: something said to the person
 */
export const SPAN_KINDS = ["understand", "plan", "step", "tool", "model", "wait", "check", "said"] as const;
export type SpanKind = (typeof SPAN_KINDS)[number];

export const SPAN_STATUSES = ["ok", "failed", "skipped", "stopped"] as const;
export type SpanStatus = (typeof SPAN_STATUSES)[number];

export const TRACE_STATUSES = ["ok", "failed", "stopped", "waiting", "running"] as const;
export type TraceStatus = (typeof TRACE_STATUSES)[number];

/** Where a run was picked up: read live, sent by an app, dropped as a file, or recorded earlier. */
export const HOWS = ["live", "sent", "file", "sample"] as const;
export type How = (typeof HOWS)[number];

export const MAX_SPANS = 3000;

const text = (max: number) => z.string().max(max);
const milliseconds = z.number().min(0).max(1e10);
/** A date and time as text that a browser can read back, so nothing after this has to wonder. */
const instant = text(40).refine((value) => !Number.isNaN(Date.parse(value)), "Not a date and time.");

export const spanSchema = z.object({
  id: text(200),
  parentId: text(200).nullable(),
  kind: z.enum(SPAN_KINDS),
  name: text(500),
  /** From the start of the run. */
  startMs: milliseconds,
  /** Zero for a marker: something that happened at a moment. */
  durationMs: milliseconds,
  status: z.enum(SPAN_STATUSES),
  /** Whether the times were measured, or had to be worked out from what was logged. */
  timing: z.enum(["measured", "estimated"]),
  /** The line the person was shown at this point, for "at this moment". */
  shown: text(2000).optional(),
  attributes: z.record(z.string(), jsonSchema),
  input: jsonSchema.optional(),
  output: jsonSchema.optional(),
});
export type Span = z.infer<typeof spanSchema>;

export const totalsSchema = z.object({
  calls: z.number().int().min(0),
  modelCalls: z.number().int().min(0),
  /** Null when the app does not say. */
  tokens: z.number().min(0).nullable(),
  failures: z.number().int().min(0),
  /** Calls the app managed without, when it says. */
  avoided: z.number().int().min(0).nullable(),
});
export type Totals = z.infer<typeof totalsSchema>;

export const originSchema = z.object({ how: z.enum(HOWS), at: instant });
export type Origin = z.infer<typeof originSchema>;

/** Spans must have unique ids, point at parents that exist, and not point at themselves in a circle. */
function checkSpans(trace: { spans: Span[] }, ctx: z.RefinementCtx): void {
  const parentOf = new Map<string, string | null>();
  for (const span of trace.spans) {
    if (parentOf.has(span.id)) ctx.addIssue({ code: "custom", message: `Two spans share the id "${span.id}".` });
    parentOf.set(span.id, span.parentId);
  }
  for (const span of trace.spans) {
    if (span.parentId !== null && !parentOf.has(span.parentId)) {
      ctx.addIssue({ code: "custom", message: `Span "${span.id}" belongs to "${span.parentId}", which is not in the run.` });
      continue;
    }
    let steps = 0;
    for (let at: string | null = span.parentId; at !== null; at = parentOf.get(at) ?? null) {
      steps += 1;
      if (steps > trace.spans.length) {
        ctx.addIssue({ code: "custom", message: `Span "${span.id}" is its own ancestor.` });
        break;
      }
    }
  }
}

export const traceSchema = z
  .object({
    /** Unique across sources: "sayso:turn-abc", "github-bot:audit-de93568290". */
    id: text(200),
    source: z.enum(SOURCES),
    /** "patch" or "pitch" for the two agents of Agent Desk. */
    agent: text(100).nullable(),
    /** What was asked, what the flow is called, what job it was. */
    title: text(500),
    /** One line on how it went, when the app says. */
    summary: text(1000).nullable(),
    /** When the run began, when the app says. */
    startedAt: instant.nullable(),
    durationMs: milliseconds,
    status: z.enum(TRACE_STATUSES),
    spans: z.array(spanSchema).max(MAX_SPANS),
    totals: totalsSchema,
    origin: originSchema,
  })
  .superRefine(checkSpans);
export type Trace = z.infer<typeof traceSchema>;

/** The spans nothing else holds: the top rows of the timeline. */
export function rootsOf(trace: Trace): Span[] {
  return trace.spans.filter((span) => span.parentId === null);
}

export function childrenOf(trace: Trace, parentId: string): Span[] {
  return trace.spans.filter((span) => span.parentId === parentId);
}
