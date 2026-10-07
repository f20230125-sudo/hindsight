import { describe, expect, it } from "vitest";
import { z } from "zod";
import sample from "@/samples/flowboard.json";
import { traceSchema, type Span, type Trace } from "@/trace/schema";
import { adaptFlowboard } from "./adapt";
import { flowboardRunSchema, type FlowboardRun } from "./schema";

// These run against real recordings of Flowboard: scripts/record-apps.mjs drove
// the app in a browser and pressed its "Open in Hindsight" button, and what the
// button handed over is in src/samples/flowboard.json. The numbers in the
// expectations were read off the raw run by hand, not out of the adapter.

const recorded = z.object({ runs: z.array(z.object({ label: z.string(), envelope: z.object({ data: flowboardRunSchema }) })) }).parse(sample).runs;
const origin = { how: "sample", at: "2026-10-07T00:00:00.000Z" } as const;

function runOf(label: string): FlowboardRun {
  const found = recorded.find((entry) => entry.label === label);
  if (!found) throw new Error(`No recording called "${label}".`);
  return found.envelope.data;
}
const adapt = (label: string): Trace => adaptFlowboard(runOf(label), { origin });
const span = (trace: Trace, name: string): Span => {
  const found = trace.spans.find((entry) => entry.name === name);
  if (!found) throw new Error(`No span "${name}": ${trace.spans.map((entry) => entry.name).join(" | ")}`);
  return found;
};

describe("the heat check on a hot day", () => {
  const trace = adapt("heat check, hot day");

  it("keeps the flow's name, how it ended, how long it took, and when it began", () => {
    expect(trace).toMatchObject({ source: "flowboard", agent: null, title: "Heat check", status: "ok", durationMs: 537, summary: "5 of 6 blocks ran" });
    expect(trace.id).toBe(`flowboard:${runOf("heat check, hot day").run.startedAt}`);
    expect(trace.startedAt).toBe(new Date(runOf("heat check, hot day").run.startedAt!).toISOString());
  });

  it("draws each block that ran from when it began, as long as it took", () => {
    expect(span(trace, "start · Trigger")).toMatchObject({ kind: "step", startMs: 0, durationMs: 2, status: "ok" });
    expect(span(trace, "getWeather · HTTP request")).toMatchObject({ kind: "tool", startMs: 2, durationMs: 531, status: "ok", timing: "measured" });
    expect(span(trace, "isTooHot · Condition")).toMatchObject({ kind: "step", startMs: 534, durationMs: 1, attributes: { branch: "true" } });
  });

  it("keeps the data that passed through, and the HTTP status", () => {
    const weather = span(trace, "getWeather · HTTP request");
    expect(weather.attributes.httpStatus).toBe(200);
    expect(weather.output).toMatchObject({ status: 200, ok: true, body: { current: { temperature_2m: 38.4 } } });
    expect(span(trace, "isTooHot · Condition").output).toMatchObject({ result: true });
  });

  it("marks the block on the side not taken as left out, at the moment the blocks before it were done", () => {
    // isTooHot finished 535 ms in, and that is when its false side was left out.
    expect(span(trace, "goOut · Set")).toMatchObject({ kind: "step", startMs: 535, durationMs: 0, status: "skipped", timing: "estimated", attributes: { reason: "no-data" } });
  });

  it("says what the flow ended with, as what the person sees", () => {
    expect(span(trace, "result · Output").shown).toContain("Too hot");
  });

  it("counts one call, and nothing failed", () => {
    expect(trace.totals).toEqual({ calls: 1, modelCalls: 0, tokens: null, failures: 0, avoided: null });
  });
});

describe("the heat check on a mild day", () => {
  it("leaves out the other side", () => {
    const trace = adapt("heat check, mild day");
    expect(span(trace, "isTooHot · Condition").attributes.branch).toBe("false");
    expect(span(trace, "stayIn · Set").status).toBe("skipped");
    expect(span(trace, "goOut · Set").status).toBe("ok");
  });
});

describe("the weather service being down", () => {
  const trace = adapt("heat check, the weather service down");

  it("is a failed run, with the failed call as long as it kept trying, and the rest left out at the end", () => {
    expect(trace).toMatchObject({ status: "failed", durationMs: 3151 });
    expect(span(trace, "getWeather · HTTP request")).toMatchObject({ kind: "tool", startMs: 5, durationMs: 3134, status: "failed" });
    expect(span(trace, "getWeather · HTTP request").attributes.error).toMatchObject({ code: "http_status" });
    for (const name of ["isTooHot · Condition", "stayIn · Set", "goOut · Set", "result · Output"]) {
      expect(span(trace, name)).toMatchObject({ status: "skipped", startMs: 3151, attributes: { reason: "run-ended" } });
    }
    expect(trace.summary).toMatch(/^getWeather failed: .*503/);
    expect(trace.totals.failures).toBe(1);
  });
});

describe("a flow with an AI block and no key", () => {
  const trace = adapt("support ticket triage with the sample reply");

  it("does not call a sample reply a model call", () => {
    expect(span(trace, "classify · AI, sample reply")).toMatchObject({ kind: "step", status: "ok", attributes: { note: "Sample reply. No model was called." } });
    expect(trace.totals.modelCalls).toBe(0);
    expect(trace.spans.some((entry) => entry.kind === "model")).toBe(false);
  });

  it("draws the request that was made", () => {
    expect(span(trace, "escalate · HTTP request")).toMatchObject({ kind: "tool", startMs: 5, durationMs: 399 });
    expect(trace.totals.calls).toBe(1);
  });
});

describe("a run that was stopped while waiting", () => {
  const trace = adapt("a wait that was stopped");

  it("shows the wait as stopped, with how long it had lasted", () => {
    expect(trace).toMatchObject({ title: "Untitled flow", status: "stopped", durationMs: 2482 });
    expect(span(trace, "wait1 · Delay")).toMatchObject({ kind: "step", startMs: 2, durationMs: 2476, status: "stopped" });
  });
});

describe("an AI block that did call a model", () => {
  it("is drawn as a model call", () => {
    const base = runOf("support ticket triage with the sample reply");
    const called: FlowboardRun = { ...base, run: { ...base.run, steps: base.run.steps.map((step) => (step.id === "classify" ? { ...step, note: null, ms: 1400 } : step)) } };
    const trace = adaptFlowboard(called, { origin });
    expect(span(trace, "classify · AI")).toMatchObject({ kind: "model", durationMs: 1400 });
    expect(trace.totals.modelCalls).toBe(1);
  });
});

describe("a block that has since been deleted", () => {
  it("is still shown, under a name that says so", () => {
    const base = runOf("heat check, hot day");
    const trace = adaptFlowboard({ ...base, flow: { ...base.flow, blocks: base.flow.blocks.filter((block) => block.id !== "stayIn") } }, { origin });
    expect(trace.spans.some((entry) => entry.name === "(a block that was deleted) · unknown")).toBe(true);
    expect(traceSchema.safeParse(trace).success).toBe(true);
  });
});

describe("every recording", () => {
  it.each(recorded.map((entry) => entry.label))("%s adapts to a valid trace that stays inside its run", (label) => {
    const trace = adapt(label);
    expect(traceSchema.safeParse(trace).error?.issues ?? []).toEqual([]);
    for (const entry of trace.spans) {
      expect(entry.startMs).toBeGreaterThanOrEqual(0);
      expect(entry.startMs + entry.durationMs).toBeLessThanOrEqual(trace.durationMs);
    }
  });
});
