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

describe("where a block that did not run is placed", () => {
  const base = runOf("heat check, hot day");
  const skipped = (id: string, reason: string) => ({ id, status: "skipped" as const, startedAt: null, ms: null, input: null, output: null, branch: null, note: null, error: null, reason });
  /** The hot day's flow with more blocks, joined as given, and left out in the order given. */
  const withBlocks = (blocks: string[], connections: [string, string][], steps: (typeof base.run.steps)[number][]): FlowboardRun => ({
    flow: {
      ...base.flow,
      blocks: [...base.flow.blocks, ...blocks.map((id) => ({ id, name: id, type: "set" }))],
      connections: [...base.flow.connections, ...connections.map(([from, to]) => ({ from, to, side: "out" }))],
    },
    run: { ...base.run, steps },
  });

  it("a block after one that was left out is left out at the same moment, not at the start", () => {
    // goOut was left out 535 ms in, when isTooHot took the other side. What follows goOut goes with it.
    const order = base.run.steps.flatMap((step) => (step.id === "goOut" ? [step, skipped("after", "no-data"), skipped("afterThat", "no-data")] : [step]));
    const trace = adaptFlowboard(withBlocks(["after", "afterThat"], [["goOut", "after"], ["after", "afterThat"]], order), { origin });
    expect(span(trace, "goOut · Set").startMs).toBe(535);
    expect(span(trace, "after · Set")).toMatchObject({ startMs: 535, status: "skipped", timing: "estimated" });
    expect(span(trace, "afterThat · Set")).toMatchObject({ startMs: 535, status: "skipped" });
  });

  it("a block nothing leads to, or one in a loop, is left out before anything starts", () => {
    // The run settles these first, whatever leads to them finished later.
    const order = [skipped("alone", "not-connected"), skipped("round", "in-loop"), ...base.run.steps];
    const trace = adaptFlowboard(withBlocks(["alone", "round"], [["stayIn", "round"], ["round", "round"]], order), { origin });
    expect(span(trace, "alone · Set")).toMatchObject({ startMs: 0, status: "skipped", attributes: { why: "nothing leads to it from the trigger" } });
    // stayIn, which leads to it, finished 536 ms in.
    expect(span(trace, "round · Set")).toMatchObject({ startMs: 0, status: "skipped", attributes: { why: "it is part of a loop" } });
  });
});

describe("a run that does not say when it began", () => {
  it("is placed by the first of its blocks, and says it has no start time", () => {
    const base = runOf("heat check, hot day");
    const trace = adaptFlowboard({ ...base, run: { ...base.run, startedAt: null } }, { origin });
    expect(trace.startedAt).toBeNull();
    expect(trace.durationMs).toBe(537);
    // The same places as when the run said when it began: the trigger was its first block.
    expect(span(trace, "getWeather · HTTP request")).toMatchObject({ startMs: 2, durationMs: 531 });
    expect(traceSchema.safeParse(trace).error?.issues ?? []).toEqual([]);
  });
});

describe("a block with a very long name", () => {
  it("has it cut, and the run is still read", () => {
    const base = runOf("heat check, hot day");
    const flow = { ...base.flow, blocks: base.flow.blocks.map((block) => (block.id === "getWeather" ? { ...block, name: "w".repeat(3000) } : block)) };
    const trace = adaptFlowboard({ ...base, flow }, { origin });
    expect(traceSchema.safeParse(trace).error?.issues ?? []).toEqual([]);
    expect(Math.max(...trace.spans.map((entry) => entry.name.length))).toBeLessThanOrEqual(500);
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
