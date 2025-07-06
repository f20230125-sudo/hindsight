import { describe, expect, it } from "vitest";
import { z } from "zod";
import sample from "@/samples/github-bot.json";
import { traceSchema, type Span, type Trace } from "@/trace/schema";
import { adaptDeskRun } from "./adapt";
import { deskRunDetailSchema, type DeskRunDetail } from "./schema";

// These run against real runs: the GitHub bot's own log, recorded from its
// public snapshot (scripts/record-github-bot.mjs). The numbers in the
// expectations were read off the raw log by hand, not out of the adapter.

const recorded = z.object({ runs: z.array(deskRunDetailSchema) }).parse(sample).runs;
const origin = { how: "sample", at: "2026-10-07T00:00:00.000Z" } as const;

function detailOf(id: string): DeskRunDetail {
  const found = recorded.find((entry) => entry.run.run_id === id);
  if (!found) throw new Error(`The recorded runs do not hold ${id}.`);
  return found;
}

const adapt = (id: string): Trace => adaptDeskRun(detailOf(id), { source: "github-bot", origin });
const spansOf = (trace: Trace, kind: Span["kind"]) => trace.spans.filter((span) => span.kind === kind);

describe("an audit that ran on its own (audit-0721cc42cb)", () => {
  const trace = adapt("audit-0721cc42cb");

  it("keeps the run's length, status and the line it ended with", () => {
    expect(trace.id).toBe("github-bot:audit-0721cc42cb");
    expect(trace.source).toBe("github-bot");
    expect(trace.agent).toBe("patch");
    expect(trace.title).toBe("Audit repositories");
    expect(trace.durationMs).toBe(7998);
    expect(trace.status).toBe("ok");
    expect(trace.summary).toBe("Audit done. 4 GitHub requests, 0 model calls.");
    expect(trace.startedAt).toBe("2026-10-04T08:25:26.116Z");
  });

  it("makes one phase of each stretch of steps with the same name", () => {
    const phases = trace.spans.filter((span) => span.id.startsWith("phase-"));
    expect(phases.map((phase) => [phase.name, phase.startMs])).toEqual([
      ["sync", 28],
      ["details", 7956],
      ["checks", 7958],
      ["repo", 7959],
      ["summary", 7997],
    ]);
    // Each phase runs until the next begins; the last runs to the end of the run.
    expect(phases.map((phase) => phase.startMs + phase.durationMs)).toEqual([7956, 7958, 7959, 7997, 7998]);
    // The thirteen repositories are one phase, not thirteen.
    expect(phases[3].attributes.lines).toBe(13);
    // "sync" has two lines, with calls between them.
    expect(phases[0].attributes.lines).toBe(2);
  });

  it("places each call so that it ends when it was logged and lasted as long as it says", () => {
    const calls = spansOf(trace, "tool");
    expect(calls.map((call) => [call.startMs, call.durationMs, call.startMs + call.durationMs])).toEqual([
      [29, 309, 338],
      [340, 291, 631],
      [635, 5674, 6309],
      [6312, 1643, 7955],
    ]);
    expect(calls.every((call) => call.timing === "measured")).toBe(true);
    expect(calls.every((call) => call.parentId === "phase-0")).toBe(true);
  });

  it("names a call by its method and path, and keeps the whole address in the data", () => {
    const first = spansOf(trace, "tool")[0];
    expect(first.name).toBe("GET /user/repos");
    expect(first.attributes.path).toBe("/user/repos?affiliation=owner&per_page=100&sort=full_name");
    expect(first.attributes.status).toBe(403);
    expect(spansOf(trace, "tool")[2].name).toBe("POST /graphql");
  });

  it("shows a refused call as failed, though the run went on to succeed", () => {
    const calls = spansOf(trace, "tool");
    expect(calls.map((call) => call.status)).toEqual(["failed", "ok", "ok", "ok"]);
    expect(trace.totals).toEqual({ calls: 4, modelCalls: 0, tokens: null, failures: 1, avoided: 13 });
  });

  it("turns each finding into a marker on the phase that was running", () => {
    const findings = spansOf(trace, "check");
    expect(findings).toHaveLength(36);
    expect(findings.every((finding) => finding.durationMs === 0 && finding.parentId === "phase-3")).toBe(true);
    expect(findings[0].name).toBe("No topics");
    expect(findings[0].shown).toBe("No topics. Nobody can find it.");
    expect(findings[0].attributes.severity).toBe("medium");
  });

  it("is a valid trace, with spans in time order", () => {
    expect(traceSchema.safeParse(trace).success).toBe(true);
    const starts = trace.spans.map((span) => span.startMs);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});

describe("an audit whose calls were logged after the fact (audit-de93568290)", () => {
  const trace = adapt("audit-de93568290");

  it("cuts a call at the start of the run when it began before it", () => {
    // Two calls took 218 ms each but were logged 18 and 19 ms into a run
    // that began after they had started.
    const [first, second, third] = spansOf(trace, "tool");
    expect([first.startMs, first.durationMs, first.timing]).toEqual([0, 18, "estimated"]);
    expect([second.startMs, second.durationMs, second.timing]).toEqual([0, 19, "estimated"]);
    expect(String(first.attributes.note)).toContain("218 ms");
    expect(String(first.attributes.note)).toContain("200 ms before the run was recorded");
    // The third was logged 2012 ms in and took 1990 ms: inside the run, so measured.
    expect([third.startMs, third.durationMs, third.timing]).toEqual([22, 1990, "measured"]);
  });

  it("keeps the real time a call took in its data", () => {
    expect(spansOf(trace, "tool")[0].attributes.ms).toBe(218);
  });

  it("keeps every span inside the run", () => {
    expect(trace.durationMs).toBe(2025);
    for (const span of trace.spans) expect(span.startMs + span.durationMs).toBeLessThanOrEqual(trace.durationMs);
  });
});

describe("a run with no steps (read-3ae4b125d2)", () => {
  const trace = adapt("read-3ae4b125d2");

  it("has no phases, and its message sits on the run itself", () => {
    expect(trace.agent).toBe("pitch");
    expect(trace.durationMs).toBe(2);
    expect(trace.spans).toHaveLength(1);
    const [message] = trace.spans;
    expect(message.kind).toBe("said");
    expect(message.parentId).toBeNull();
    expect(message.shown).toBe("Enough for a post.");
    expect(message.name).toBe("pitch to patch: ready");
  });
});

describe("every recorded run", () => {
  it.each(recorded.map((entry) => entry.run.run_id))("%s adapts to a valid trace that stays inside its run", (id) => {
    const trace = adapt(id);
    const checked = traceSchema.safeParse(trace);
    expect(checked.error?.issues ?? []).toEqual([]);
    for (const span of trace.spans) {
      expect(span.startMs).toBeGreaterThanOrEqual(0);
      expect(span.startMs + span.durationMs).toBeLessThanOrEqual(trace.durationMs);
    }
  });
});

describe("runs that are not complete", () => {
  const base = detailOf("read-3ae4b125d2");

  it("calls a run with no end and no verdict running", () => {
    const trace = adaptDeskRun({ ...base, run: { ...base.run, finished_at: null, ok: null } }, { source: "agent-desk", origin });
    expect(trace.status).toBe("running");
    expect(trace.id).toBe("agent-desk:read-3ae4b125d2");
    // Without an end, the run lasts until the last thing logged.
    expect(trace.durationMs).toBe(2);
  });

  it("calls a run that ended with no verdict stopped, and one that failed failed", () => {
    expect(adaptDeskRun({ ...base, run: { ...base.run, ok: null } }, { source: "agent-desk", origin }).status).toBe("stopped");
    expect(adaptDeskRun({ ...base, run: { ...base.run, ok: false } }, { source: "agent-desk", origin }).status).toBe("failed");
  });

  it("reads a Claude call as a model call, with its tokens", () => {
    const withClaude: DeskRunDetail = {
      run: { ...base.run, finished_at: "2026-10-07T10:00:05.000Z", started_at: "2026-10-07T10:00:00.000Z", usage: { claude_calls: 1, input_tokens: 1200, output_tokens: 300 } },
      events: [
        { id: 1, ts: "2026-10-07T10:00:00.000Z", type: "run.started", payload: {} },
        { id: 2, ts: "2026-10-07T10:00:00.100Z", type: "run.step", payload: { step: "claude", text: "Asking Claude." } },
        {
          id: 3,
          ts: "2026-10-07T10:00:04.100Z",
          type: "tool.result",
          payload: { kind: "claude", job: "draft", model: "claude-haiku-4-5", ok: true, ms: 4000, input_tokens: 1200, output_tokens: 300 },
        },
        { id: 4, ts: "2026-10-07T10:00:05.000Z", type: "run.finished", payload: { ok: true, text: "Done." } },
      ],
    };
    const trace = adaptDeskRun(withClaude, { source: "agent-desk", origin });
    const [call] = spansOf(trace, "model");
    expect(call.name).toBe("Claude · draft");
    expect([call.startMs, call.durationMs, call.status]).toEqual([100, 4000, "ok"]);
    expect(call.parentId).toBe("phase-0");
    expect(trace.totals).toEqual({ calls: 1, modelCalls: 1, tokens: 1500, failures: 0, avoided: null });
  });
});

describe("text longer than a timeline has room for", () => {
  const base = detailOf("audit-0721cc42cb");

  it("is cut, so a run with a whole drafted post in a message is still read", () => {
    const post = "A long post about a week of work. ".repeat(200);
    const lastId = Math.max(...base.events.map((event) => event.id));
    const detail: DeskRunDetail = {
      run: { ...base.run, title: "t".repeat(900), text: "s".repeat(4000) },
      events: [
        ...base.events,
        { id: lastId + 1, ts: base.events.at(-1)!.ts, type: "message", payload: { from: "pitch", to: "you", topic: "draft", text: post } },
        { id: lastId + 2, ts: base.events.at(-1)!.ts, type: "tool.result", payload: { kind: "github", method: "GET", path: `/search/${"q".repeat(900)}`, status: 200, ms: 1 } },
      ],
    };
    const trace = adaptDeskRun(detail, { source: "agent-desk", origin });

    expect(traceSchema.safeParse(trace).error?.issues ?? []).toEqual([]);
    expect(trace.title).toHaveLength(500);
    expect(trace.summary).toHaveLength(1000);
    const message = trace.spans.find((span) => span.id === `event-${lastId + 1}`)!;
    expect(message.shown).toHaveLength(2000);
    // The whole text is still in the data recorded with it, up to the length any one piece of data is kept at.
    expect(String(message.attributes.text).length).toBeGreaterThan(2000);
    expect(trace.spans.find((span) => span.id === `event-${lastId + 2}`)!.name).toHaveLength(300);
  });

  it("a start that is not a date is no start, and the run is placed by its first event", () => {
    const trace = adaptDeskRun({ ...base, run: { ...base.run, started_at: "some time on Sunday", finished_at: null } }, { source: "github-bot", origin });
    expect(trace.startedAt).toBeNull();
    expect(traceSchema.safeParse(trace).error?.issues ?? []).toEqual([]);
    // From the first event to the last: the same 7998 ms, as the first event is the run starting.
    expect(trace.durationMs).toBe(7998);
  });
});
