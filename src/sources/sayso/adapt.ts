import { toJson, toRecord, type Json } from "@/trace/json";
import type { Origin, Span, SpanKind, SpanStatus, Trace, TraceStatus } from "@/trace/schema";
import type { SaysoCall, SaysoRun, SaysoStep } from "./schema";

// One turn of a Sayso conversation as a Trace.
//
// Sayso keeps, for each turn, the plan it made, the calls it made with how long
// each took, and a log of what happened and when. Put together:
//
//  - reading the words is a span from the start of the turn, in blue when a
//    model read them and grey when the built-in rules did
//  - each call to the airline's API is a bar, as long as the call took
//  - a component that waits for the traveller (a seat map, a price to agree)
//    is a bar from when it was shown to when it was answered. This is the
//    longest bar in nearly every run: a person thinking
//  - what was said to the traveller, and the checks, are marks
//
// The log's times are the clock of the page; a call's length is what the
// page measured around the request itself.

type Options = { origin: Origin };

const clip = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

/** The log is to the millisecond and a call is timed apart from it, so a call may seem a few ms longer than the try it was part of. */
const CALL_SLACK_MS = 5;

/** "/api/flights/JN203_2026-10-15/seats?x=1" is "/api/flights/JN203_2026-10-15/seats" for a name. */
const pathOnly = (url: string) => (url.includes("?") ? url.slice(0, url.indexOf("?")) : url);

/** What the traveller is being asked, for the name of a wait. */
const ASKS: Record<string, string> = {
  "trip-chooser": "to choose a trip",
  "flight-search": "to say where to fly",
  "date-strip": "to choose a day",
  "flight-list": "to choose a flight",
  "seat-map": "to choose a seat",
  "bag-stepper": "to choose the bags",
  "passenger-check": "to confirm the details",
  refund: "to confirm the refund",
  "price-summary": "to agree the price",
};

/** The title of each component, as the desk itself shows it. */
const TITLES: Record<string, string> = {
  trips: "Trips",
  "trip-chooser": "Which trip?",
  "flight-search": "Flight search",
  "date-strip": "Days",
  "flight-list": "Flights",
  "seat-map": "Seat map",
  "bag-stepper": "Bags",
  "passenger-check": "Passenger check",
  refund: "Refund",
  "price-summary": "Price summary",
  receipt: "Receipt",
  "boarding-pass": "Boarding pass",
  "status-timeline": "Flight status",
  "answer-card": "Answer",
};

const STATUS: Record<NonNullable<SaysoRun["status"]>, TraceStatus> = {
  done: "ok",
  failed: "failed",
  stopped: "stopped",
  waiting: "waiting",
  running: "running",
};

export function adaptSayso(run: SaysoRun, { origin }: Options): Trace {
  // The turn began when the words were said. A turn saved before that was kept
  // is placed by its first log entry and how long reading the words took.
  const began = run.startedAt ? Date.parse(run.startedAt) : Number.NaN;
  const t0 = Number.isFinite(began) ? began : (run.log[0]?.at ?? 0) - run.understoodMs;
  const rel = (at: number) => Math.max(0, Math.round(at - t0));

  const exported = run.exportedAt ? Date.parse(run.exportedAt) - t0 : Number.NaN;
  const lastLogged = run.log.reduce((latest, entry) => Math.max(latest, rel(entry.at)), 0);
  // A turn kept before Sayso noted when things happened has no log. All that is
  // known of its calls is how long each took, so they are laid end to end.
  const unlogged = run.log.length === 0;
  const laidOut = unlogged ? run.calls.reduce((total, call) => total + Math.round(call.ms), Math.round(run.understoodMs)) : 0;
  let durationMs = Math.max(Math.round(run.understoodMs), lastLogged, laidOut);
  // A journey that is still waiting has been waiting until the moment it was written out.
  // (Only a turn that says when it began, or when anything in it happened, can be measured against that moment.)
  const open = run.status === "waiting" || run.status === "running";
  const placed = Number.isFinite(began) || !unlogged;
  if (open && placed && Number.isFinite(exported)) durationMs = Math.max(durationMs, Math.round(exported));

  const spans: Span[] = [];
  const counts = new Map<string, number>();
  const idFor = (kind: string) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}-${next}`;
  };
  const add = (span: Omit<Span, "id" | "parentId" | "timing" | "attributes"> & { idKind: string; attributes?: Span["attributes"]; timing?: Span["timing"] }) => {
    const { idKind, attributes, timing, name, shown, ...rest } = span;
    // Names and lines come from the app as they are; a very long one is cut, not a reason to refuse the run.
    spans.push({ id: idFor(idKind), parentId: null, timing: timing ?? "measured", attributes: attributes ?? {}, name: clip(name, 500), ...(shown ? { shown: clip(shown, 2000) } : {}), ...rest });
  };
  const marker = (idKind: string, kind: SpanKind, name: string, at: number, shown?: string, status: SpanStatus = "ok", attributes?: Span["attributes"]) =>
    add({ idKind, kind, name: clip(name, 200), startMs: at, durationMs: 0, status, ...(shown ? { shown: clip(shown, 2000) } : {}), attributes });

  // 1. Reading the words.
  const unreadable = run.understanding === "unknown";
  const read = run.brain === "model" && run.model ? `Read by ${run.model}` : "Read by the built-in rules";
  add({
    idKind: "understand",
    kind: run.brain === "model" ? "model" : "understand",
    name: unreadable ? `${read}, not understood` : read,
    startMs: 0,
    durationMs: Math.min(Math.round(run.understoodMs), durationMs),
    status: unreadable ? "failed" : "ok",
    shown: clip(`You said: “${run.words}”`, 2000),
    attributes: { understanding: run.understanding, brain: run.brain, model: run.model, journeys: run.intents.map((intent) => intent.journey) },
    input: { words: run.words },
    output: { understanding: run.understanding, intents: toJson(run.intents) },
  });

  // 2. The plan, made as soon as the words were read.
  const stepById = new Map<string, SaysoStep>(run.steps.map((step) => [step.id, step]));
  if (run.steps.length > 0) {
    marker("plan", "plan", `Planned ${run.steps.length} steps`, Math.min(Math.round(run.understoodMs), durationMs), undefined, "ok", {
      steps: run.steps.map((step) => `${step.kind}: ${step.label ?? step.text ?? step.tool ?? ""}`.trim()),
    });
  }

  // 3. Everything that happened, in the order it was logged.
  const callsByStep = new Map<string, SaysoCall[]>();
  for (const call of run.calls) callsByStep.set(call.stepId, [...(callsByStep.get(call.stepId) ?? []), call]);
  const startedCalls = new Map<string, number[]>();
  const shownAt = new Map<string, number>();
  let failedAt: number | null = null;
  let markIndex = 0;

  // Sayso keeps the reason for the failure a run is left with, and no earlier one.
  const lastFailure = run.status === "failed" ? run.log.findLastIndex((entry) => entry.type === "failed") : -1;

  const finishCall = (stepId: string, at: number, failedHere: boolean, reason: SaysoRun["failure"] = null) => {
    const started = startedCalls.get(stepId)?.shift();
    if (started === undefined) return;
    const step = stepById.get(stepId);
    // Sayso keeps a record of every call that got an answer, good or bad. A try
    // that failed with no answer at all (no connection, or arguments the plan
    // got wrong) has none, so the next record of this step may belong to a
    // later try. It is this try's only if it ended the same way, and, for a
    // failure, took no longer than this try did.
    const queue = callsByStep.get(stepId) ?? [];
    const next = queue[0];
    const fits = next !== undefined && (next.failure !== null) === failedHere && (!failedHere || next.ms <= at - started + CALL_SLACK_MS);
    const call = fits ? queue.shift() : undefined;
    const failed = failedHere || Boolean(call?.failure) || (call !== undefined && call.status >= 400);
    const attributes = call
      ? toRecord({ tool: call.tool, method: call.method, url: call.url, status: call.status, ms: call.ms, failure: call.failure })
      : toRecord({ tool: step?.tool, ...(failedHere ? { answered: false, failure: reason ? { code: reason.code, message: reason.message } : null } : {}) });
    add({
      idKind: "call",
      kind: "tool",
      name: call ? `${call.method} ${pathOnly(call.url)}` : (step?.label ?? step?.tool ?? "call"),
      // What the page measured around the request is the length; the log says where it began.
      startMs: started,
      durationMs: Math.max(0, call ? Math.round(call.ms) : at - started),
      status: failed ? "failed" : "ok",
      attributes,
      ...(call?.body != null ? { input: call.body } : {}),
      ...(call?.result != null ? { output: call.result } : {}),
    });
  };

  const closeWait = (stepId: string, from: number, to: number, status: SpanStatus, answer?: Json | null, stillOpen = false) => {
    const step = stepById.get(stepId);
    const widget = step?.widget ?? "";
    add({
      idKind: "wait",
      kind: "wait",
      name: `Waiting for the traveller ${ASKS[widget] ?? "to answer"}`,
      startMs: from,
      durationMs: Math.max(0, to - from),
      status,
      shown: `Shown: ${TITLES[widget] ?? (step?.label ?? "a component")}`,
      attributes: { widget: step?.widget ?? null, ...(stillOpen ? { stillWaiting: true } : {}) },
      ...(answer != null ? { output: answer } : {}),
    });
  };

  for (const [index, entry] of run.log.entries()) {
    const at = rel(entry.at);
    const step = entry.stepId ? stepById.get(entry.stepId) : undefined;
    switch (entry.type) {
      case "set":
        marker("set", "step", step?.label ?? "Worked something out", at);
        break;
      case "said": {
        const text = step?.text ?? "";
        if (text) marker("said", "said", text, at, text);
        break;
      }
      case "tool-started":
        if (entry.stepId) startedCalls.set(entry.stepId, [...(startedCalls.get(entry.stepId) ?? []), at]);
        break;
      case "tool-finished":
        if (entry.stepId) finishCall(entry.stepId, at, false);
        break;
      case "failed": {
        if (entry.stepId) {
          const reason = index === lastFailure && run.failure?.stepId === entry.stepId ? run.failure : null;
          if (startedCalls.get(entry.stepId)?.length) finishCall(entry.stepId, at, true, reason);
          else marker("failure", "step", reason?.message ?? "Something went wrong", at, undefined, "failed");
        }
        failedAt = at;
        break;
      }
      case "resumed":
        // The traveller was shown the failure and pressed "Try again": the run was waiting for them.
        if (failedAt !== null) {
          add({ idKind: "wait", kind: "wait", name: "Waiting for the traveller to try again", startMs: failedAt, durationMs: Math.max(0, at - failedAt), status: "ok", attributes: {} });
          failedAt = null;
        }
        break;
      case "shown":
        if (!step || step.kind !== "show") break;
        if (step.waits) shownAt.set(step.id, at);
        else {
          const title = TITLES[step.widget ?? ""] ?? step.label ?? "A component";
          marker("shown", "said", title, at, `Shown: ${title}`, "ok", { widget: step.widget ?? null });
        }
        break;
      case "answered": {
        const from = entry.stepId ? shownAt.get(entry.stepId) : undefined;
        if (entry.stepId && from !== undefined) {
          closeWait(entry.stepId, from, at, "ok", step?.answer);
          shownAt.delete(entry.stepId);
        }
        break;
      }
      case "marked": {
        const mark = run.marks[markIndex];
        markIndex += 1;
        if (mark) {
          marker("said-partway", "understand", `You said: “${clip(mark.words, 120)}”`, at, `You said: “${mark.words}”`);
          if (mark.reply) marker("reply", "said", mark.reply, at, mark.reply, "ok", mark.by ? { by: mark.by } : undefined);
        }
        break;
      }
      case "checked":
        for (const check of run.checks) {
          marker("check", "check", check.label, at, check.label, check.pass ? "ok" : "failed", { pass: check.pass });
        }
        break;
      case "closed":
      case "stopped":
        // The journey was left. Whatever was waiting for the traveller stops here.
        for (const [stepId, from] of shownAt) closeWait(stepId, from, at, "stopped");
        shownAt.clear();
        // The closing line is said when the journey is closed. A run stopped first and closed later says it once, then.
        if (run.closing && entry.type === "closed") marker("closing", "said", run.closing, at, run.closing);
        break;
      default:
        // finished, and anything a newer Sayso adds.
        break;
    }
  }

  // Components still waiting for an answer have been waiting until the end.
  for (const [stepId, from] of shownAt) closeWait(stepId, from, durationMs, "ok", undefined, open);

  // 3b. A turn with no log: its calls one after another from the end of the reading, and its checks at the end.
  if (unlogged) {
    const note = "This turn was kept before Sayso noted when things happened. Only how long each call took is known, so the calls are placed one after another.";
    let at = Math.round(run.understoodMs);
    for (const call of run.calls) {
      const took = Math.round(call.ms);
      add({
        idKind: "call",
        kind: "tool",
        name: `${call.method} ${pathOnly(call.url)}`,
        startMs: at,
        durationMs: took,
        status: call.failure || call.status >= 400 ? "failed" : "ok",
        timing: "estimated",
        attributes: { ...toRecord({ tool: call.tool, method: call.method, url: call.url, status: call.status, ms: call.ms, failure: call.failure }), note },
        ...(call.body != null ? { input: call.body } : {}),
        ...(call.result != null ? { output: call.result } : {}),
      });
      at += took;
    }
    for (const check of run.checks) {
      add({ idKind: "check", kind: "check", name: clip(check.label, 200), startMs: durationMs, durationMs: 0, status: check.pass ? "ok" : "failed", timing: "estimated", shown: check.label, attributes: { pass: check.pass, note } });
    }
  }

  // 4. A reply with no run behind it: small talk, or words that were not understood.
  if (run.steps.length === 0 && run.reply) {
    marker("reply", "said", run.reply, Math.min(Math.round(run.understoodMs), durationMs), run.reply, "ok", run.replyBy ? { by: run.replyBy } : undefined);
  }

  spans.sort((a, b) => a.startMs - b.startMs);

  const modelCalls = (run.brain === "model" ? 1 : 0) + (run.replyBy ? 1 : 0) + run.marks.filter((mark) => mark.by).length;
  const passed = run.checks.filter((check) => check.pass).length;
  const summary = run.closing ?? run.reply ?? (run.checks.length > 0 ? `${passed} of ${run.checks.length} checks passed` : null);
  const status: TraceStatus = run.status ? STATUS[run.status] : unreadable ? "failed" : "ok";

  return {
    id: `sayso:${run.id}`,
    source: "sayso",
    agent: null,
    title: clip(run.words, 500),
    summary: summary === null ? null : clip(summary, 1000),
    // Written the one way every browser reads back, whatever way the app wrote it.
    startedAt: Number.isFinite(began) ? new Date(began).toISOString() : null,
    durationMs,
    status,
    spans,
    totals: {
      calls: spans.filter((span) => span.kind === "tool").length + modelCalls,
      modelCalls,
      tokens: null,
      failures: spans.filter((span) => span.status === "failed").length,
      avoided: null,
    },
    origin,
  };
}
