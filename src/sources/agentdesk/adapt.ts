import { formatMs } from "@/trace/format";
import { toRecord } from "@/trace/json";
import type { Origin, Span, SpanKind, SpanStatus, Trace, TraceStatus } from "@/trace/schema";
import type { DeskEvent, DeskRunDetail } from "./schema";

// Agent Desk and the GitHub bot are one program: two agents, Patch and Pitch,
// that run jobs and log an event for everything they do. This turns one run's
// events into a Trace.
//
//  - Consecutive "run.step" events with the same step name are one phase: a
//    span from the first of them to the next phase.
//  - Each "tool.result" is a call, drawn inside the phase that was running
//    when it was logged.
//  - Findings, proposals, messages and errors are markers on that phase.
//
// One thing about the log shapes how times are worked out. A call is logged
// when it ends, with how long it took, so it began `ms` before its stamp. In a
// run that the scheduled job logs after the fact, some calls then begin before
// the run does. The part before the run is cut off, and the call is marked as
// estimated.

type Options = { source: "agent-desk" | "github-bot"; origin: Origin };

/** Stamps are to the millisecond and calls are timed apart, so a few ms of difference is not a cut. */
const CUT_TOLERANCE_MS = 5;

const asText = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);
const asNumber = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** "/user/repos?affiliation=owner&per_page=100" is "/user/repos" for a name; the whole address stays in the data. */
function pathOnly(path: string): string {
  const cut = path.indexOf("?");
  return cut === -1 ? path : path.slice(0, cut);
}

export function adaptDeskRun(detail: DeskRunDetail, { source, origin }: Options): Trace {
  const { run } = detail;
  const events = [...detail.events].sort((a, b) => a.id - b.id);

  const begun = Date.parse(run.started_at);
  const t0 = Number.isFinite(begun) ? begun : Date.parse(events[0]?.ts ?? "") || 0;
  const stamp = (event: DeskEvent): number => {
    const at = Date.parse(event.ts);
    return Number.isFinite(at) ? at - t0 : 0;
  };

  const latest = events.reduce((most, event) => Math.max(most, stamp(event)), 0);
  const ended = run.finished_at ? Date.parse(run.finished_at) : Number.NaN;
  const durationMs = Math.max(0, Math.round(Number.isFinite(ended) ? ended - t0 : latest));
  const within = (ms: number) => Math.min(durationMs, Math.max(0, Math.round(ms)));

  // Phases, and the phase each event was logged in.
  type Phase = { id: string; name: string; startMs: number; endMs: number; lines: number };
  const phases: Phase[] = [];
  const phaseOf = new Map<number, number>();
  let current = -1;
  let lastStep: string | null = null;
  for (const event of events) {
    if (event.type === "run.step") {
      const name = asText(event.payload.step) ?? "step";
      if (name !== lastStep) {
        phases.push({ id: `phase-${phases.length}`, name, startMs: within(stamp(event)), endMs: durationMs, lines: 0 });
        lastStep = name;
        current = phases.length - 1;
      }
      phases[current].lines += 1;
    }
    phaseOf.set(event.id, current);
  }
  phases.forEach((phase, index) => {
    phase.endMs = Math.max(phase.startMs, phases[index + 1]?.startMs ?? durationMs);
  });

  const spans: Span[] = phases.map((phase) => ({
    id: phase.id,
    parentId: null,
    kind: "step",
    name: phase.name,
    startMs: phase.startMs,
    durationMs: phase.endMs - phase.startMs,
    status: "ok",
    timing: "measured",
    attributes: { lines: phase.lines },
  }));

  const parentOf = (event: DeskEvent): string | null => {
    const index = phaseOf.get(event.id) ?? -1;
    return index >= 0 ? phases[index].id : null;
  };

  const marker = (event: DeskEvent, kind: SpanKind, name: string, shown: string | null, status: SpanStatus = "ok"): Span => {
    const attributes = toRecord(event.payload);
    if (event.repo) attributes.repo = event.repo;
    return {
      id: `event-${event.id}`,
      parentId: parentOf(event),
      kind,
      name: name.slice(0, 200),
      startMs: within(stamp(event)),
      durationMs: 0,
      status,
      timing: "measured",
      ...(shown ? { shown } : {}),
      attributes,
    };
  };

  for (const event of events) {
    const p = event.payload;
    switch (event.type) {
      case "run.step": {
        const text = asText(p.text) ?? asText(p.step) ?? "step";
        spans.push(marker(event, "step", text, text));
        break;
      }
      case "tool.result": {
        const isModel = p.kind === "claude";
        const took = Math.max(0, asNumber(p.ms) ?? 0);
        const end = within(stamp(event));
        const raw = stamp(event) - took;
        const cut = raw < -CUT_TOLERANCE_MS;
        const startMs = cut ? 0 : within(raw);
        const attributes = toRecord(p);
        if (cut) {
          attributes.note = `This call took ${formatMs(took)} and began ${formatMs(-raw)} before the run was recorded. The bar shows only the part inside the run.`;
        }
        const code = asNumber(p.status);
        const failed = isModel ? p.ok === false : code !== null && code >= 400;
        const name = isModel
          ? `Claude · ${asText(p.job) ?? "call"}`
          : `${asText(p.method) ?? "GET"} ${pathOnly(asText(p.path) ?? asText(p.url) ?? asText(p.kind) ?? "request")}`;
        spans.push({
          id: `event-${event.id}`,
          parentId: parentOf(event),
          kind: isModel ? "model" : "tool",
          name,
          startMs,
          durationMs: cut ? end : Math.min(Math.round(took), durationMs - startMs),
          status: failed ? "failed" : "ok",
          timing: cut ? "estimated" : "measured",
          attributes,
        });
        break;
      }
      case "finding": {
        spans.push(marker(event, "check", asText(p.title) ?? asText(p.check) ?? "finding", asText(p.text) ?? asText(p.detail)));
        break;
      }
      case "proposal.created":
        spans.push(marker(event, "step", `Proposal: ${asText(p.title) ?? "drafted"}`, asText(p.summary) ?? asText(p.title)));
        break;
      case "proposal.resolved":
        spans.push(marker(event, "step", `Proposal ${asText(p.decision) ?? "decided"}`, asText(p.text) ?? asText(p.title)));
        break;
      case "action.applied":
        spans.push(marker(event, "step", "Action applied", asText(p.text) ?? asText(p.summary)));
        break;
      case "message": {
        const route = [asText(p.from), asText(p.to)].filter(Boolean).join(" to ");
        spans.push(marker(event, "said", [route, asText(p.topic)].filter(Boolean).join(": ") || "message", asText(p.text)));
        break;
      }
      case "error":
        spans.push(marker(event, "step", "Error", asText(p.message), "failed"));
        break;
      default:
        // run.started, run.finished, usage (read below), agent.status and the
        // request half of a call (tool.call, whose result carries the data).
        break;
    }
  }

  spans.sort((a, b) => a.startMs - b.startMs);

  // What the run cost, as the program counted it.
  const usageEvent = events.findLast((event) => event.type === "usage");
  const counted: Record<string, number> = Object.keys(run.usage).length > 0 ? run.usage : numbersOf(usageEvent?.payload);
  const calls = spans.filter((span) => span.kind === "tool" || span.kind === "model").length;
  const modelCalls = Math.max(spans.filter((span) => span.kind === "model").length, counted.claude_calls ?? 0);
  const said = counted.input_tokens !== undefined || counted.output_tokens !== undefined;

  const status: TraceStatus = run.ok === true ? "ok" : run.ok === false ? "failed" : run.finished_at ? "stopped" : "running";

  return {
    id: `${source}:${run.run_id}`,
    source,
    agent: run.agent,
    title: run.title,
    summary: run.text ?? null,
    startedAt: run.started_at,
    durationMs,
    status,
    spans,
    totals: {
      calls,
      modelCalls,
      tokens: said ? (counted.input_tokens ?? 0) + (counted.output_tokens ?? 0) : null,
      failures: spans.filter((span) => span.status === "failed").length,
      avoided: counted.calls_avoided ?? null,
    },
    origin,
  };
}

function numbersOf(payload: Record<string, unknown> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(payload ?? {})) if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  return out;
}

