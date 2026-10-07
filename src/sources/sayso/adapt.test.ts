import { describe, expect, it } from "vitest";
import { z } from "zod";
import sample from "@/samples/sayso.json";
import { traceSchema, type Span, type Trace } from "@/trace/schema";
import { adaptSayso } from "./adapt";
import { saysoRunSchema, type SaysoRun } from "./schema";

// These run against real recordings of Sayso: scripts/record-apps.mjs drove
// the app in a browser and pressed its "Open in Hindsight" button, and what the
// button handed over is in src/samples/sayso.json. The numbers in the
// expectations were read off the raw log by hand, not out of the adapter.

const recorded = z.object({ runs: z.array(z.object({ label: z.string(), envelope: z.object({ data: saysoRunSchema }) })) }).parse(sample).runs;
const origin = { how: "sample", at: "2026-10-07T00:00:00.000Z" } as const;

function runOf(label: string): SaysoRun {
  const found = recorded.find((entry) => entry.label === label);
  if (!found) throw new Error(`No recording called "${label}".`);
  return found.envelope.data;
}
const adapt = (label: string): Trace => adaptSayso(runOf(label), { origin });
const span = (trace: Trace, name: string | RegExp): Span => {
  const found = trace.spans.find((entry) => (typeof name === "string" ? entry.name === name : name.test(entry.name)));
  if (!found) throw new Error(`No span "${name}" in ${trace.title}: ${trace.spans.map((entry) => entry.name).join(" | ")}`);
  return found;
};
const spansOf = (trace: Trace, kind: Span["kind"]) => trace.spans.filter((entry) => entry.kind === kind);

describe("a window seat, chosen and paid for", () => {
  const trace = adapt("a window seat, paid for");

  it("keeps who said what, how it ended, and how long it all took", () => {
    expect(trace.id).toBe("sayso:turn-muxs1zkw-1");
    expect(trace).toMatchObject({ source: "sayso", agent: null, title: "a window seat on my London flight", status: "ok", summary: "3 of 3 checks passed" });
    // The last thing logged was 5917 ms after the words were said.
    expect(trace.durationMs).toBe(5917);
  });

  it("shows the words being read, then the plan", () => {
    expect(span(trace, "Read by the built-in rules")).toMatchObject({ kind: "understand", startMs: 0, durationMs: 2, status: "ok", shown: "You said: “a window seat on my London flight”" });
    expect(span(trace, "Planned 10 steps")).toMatchObject({ kind: "plan", startMs: 2, durationMs: 0 });
  });

  it("puts each call where the log says it began, as long as the page measured it", () => {
    const calls = spansOf(trace, "tool");
    expect(calls.map((call) => [call.name, call.startMs, call.durationMs])).toEqual([
      ["GET /api/flights/JN203_2026-10-15/seats", 3, 100],
      ["POST /api/quotes", 3769, 158],
      ["POST /api/orders", 5869, 39],
    ]);
    expect(calls.every((call) => call.status === "ok" && call.timing === "measured")).toBe(true);
    expect(calls[0].attributes).toMatchObject({ method: "GET", status: 200, ms: 100 });
    expect(calls[0].output).not.toBeNull();
  });

  it("makes a bar of each time the traveller was asked and had to answer, the longest of the run", () => {
    const waits = spansOf(trace, "wait");
    expect(waits.map((wait) => [wait.name, wait.startMs, wait.durationMs])).toEqual([
      ["Waiting for the traveller to choose a seat", 107, 3662],
      ["Waiting for the traveller to agree the price", 3937, 1931],
    ]);
    expect(waits[0]).toMatchObject({ kind: "wait", status: "ok", shown: "Shown: Seat map" });
    // What they answered is kept on the bar.
    expect(waits[0].output).toMatchObject({ seat: expect.any(String), kinds: ["window"] });
    // More of the run is the traveller thinking than the app working.
    const waiting = waits.reduce((sum, wait) => sum + wait.durationMs, 0);
    const working = spansOf(trace, "tool").reduce((sum, call) => sum + call.durationMs, 0);
    expect(waiting).toBeGreaterThan(working * 10);
  });

  it("marks what was said to the traveller and the checks that ran at the end", () => {
    const said = spansOf(trace, "said");
    expect(said.map((entry) => entry.startMs)).toEqual([106, 3935, 5913, 5915]);
    expect(said[0].shown).toContain("Here is the cabin");
    expect(said.at(-1)).toMatchObject({ name: "Receipt", shown: "Shown: Receipt" });
    const checks = spansOf(trace, "check");
    expect(checks).toHaveLength(3);
    expect(checks.every((check) => check.startMs === 5916 && check.status === "ok")).toBe(true);
    expect(checks[0].name).toMatch(/^You asked for a window seat\. \w+ is one\.$/);
  });

  it("counts what the run cost", () => {
    expect(trace.totals).toEqual({ calls: 3, modelCalls: 0, tokens: null, failures: 0, avoided: null });
  });
});

describe("a call that failed and was tried again", () => {
  const trace = adapt("a call that failed, tried again");

  it("shows the failed call, the wait for the traveller to press Try again, and the call that worked", () => {
    const calls = spansOf(trace, "tool");
    expect(calls.map((call) => [call.startMs, call.durationMs, call.status])).toEqual([
      [4, 437, "failed"],
      [2706, 37, "ok"],
      [6421, 42, "ok"],
      [8363, 27, "ok"],
    ]);
    expect(spansOf(trace, "wait")[0]).toMatchObject({ name: "Waiting for the traveller to try again", startMs: 443, durationMs: 2262 });
    expect(trace.status).toBe("ok");
    expect(trace.totals.failures).toBe(1);
  });
});

describe("a call that failed and was not tried again", () => {
  it("is a failed run, with the failed call", () => {
    const trace = adapt("a call that failed");
    expect(trace.status).toBe("failed");
    expect(spansOf(trace, "tool")).toHaveLength(1);
    expect(spansOf(trace, "tool")[0]).toMatchObject({ startMs: 3, durationMs: 450, status: "failed" });
    expect(trace.durationMs).toBe(455);
  });
});

describe("a try that failed with no answer at all", () => {
  // Sayso keeps a record of a call only when an answer came back. With no
  // connection there is none, so the only record of the step is the next try's.
  const at = (run: SaysoRun, ms: number) => Date.parse(run.startedAt!) + ms;

  it("is drawn from the log, as long as the try lasted, and leaves the next try its own record", () => {
    const base = runOf("a call that failed, tried again");
    // The same journey, had the first try got no answer: its record (a 500 after 437 ms) was never made.
    const trace = adaptSayso({ ...base, calls: base.calls.filter((call) => call.failure === null) }, { origin });

    const calls = spansOf(trace, "tool");
    expect(calls.map((call) => [call.startMs, call.durationMs, call.status])).toEqual([
      // Started 4 ms in, failed at 443.
      [4, 439, "failed"],
      [2706, 37, "ok"],
      [6421, 42, "ok"],
      [8363, 27, "ok"],
    ]);
    expect(calls[0]).toMatchObject({ name: "Get the seat map", attributes: { tool: "seatMap", answered: false, failure: null } });
    expect(calls[0].attributes.status).toBeUndefined();
    // The try that worked keeps what it asked for and what came back.
    expect(calls[1]).toMatchObject({ name: "GET /api/flights/JN203_2026-10-15/seats", attributes: { status: 200, ms: 37 } });
    expect(calls[1].output).toBeDefined();
    expect(trace.totals).toMatchObject({ calls: 4, failures: 1 });
    expect(traceSchema.safeParse(trace).success).toBe(true);
  });

  it("is told from a later try that failed with an answer, by how long each took", () => {
    const base = runOf("a call that failed");
    // No answer after 8 ms; tried again 100 ms in; a 500 after 450 ms, which is the one record there is.
    const run: SaysoRun = {
      ...base,
      log: [
        { at: at(base, 3), type: "set", stepId: "trip" },
        { at: at(base, 3), type: "tool-started", stepId: "seats" },
        { at: at(base, 11), type: "failed", stepId: "seats" },
        { at: at(base, 93), type: "resumed", stepId: null },
        { at: at(base, 103), type: "tool-started", stepId: "seats" },
        { at: at(base, 555), type: "failed", stepId: "seats" },
      ],
    };
    const trace = adaptSayso(run, { origin });

    const calls = spansOf(trace, "tool");
    expect(calls.map((call) => [call.startMs, call.durationMs, call.status])).toEqual([
      [3, 8, "failed"],
      [103, 450, "failed"],
    ]);
    expect(calls[0].attributes).toMatchObject({ answered: false, failure: null });
    // The reason the run was left with belongs to the last try, which also has the answer that came.
    expect(calls[1].attributes).toMatchObject({ status: 500, failure: { code: "server_error" } });
    expect(spansOf(trace, "wait")[0]).toMatchObject({ name: "Waiting for the traveller to try again", startMs: 11, durationMs: 82 });
  });

  it("says why, when it is the failure the run was left with", () => {
    const base = runOf("a call that failed");
    const trace = adaptSayso({ ...base, calls: [], failure: { stepId: "seats", code: "network", message: "Could not reach the airline." } }, { origin });
    expect(spansOf(trace, "tool")[0]).toMatchObject({
      name: "Get the seat map",
      startMs: 3,
      durationMs: 452,
      status: "failed",
      attributes: { answered: false, failure: { code: "network", message: "Could not reach the airline." } },
    });
  });
});

describe("a journey left unfinished", () => {
  const trace = adapt("left unfinished");

  it("stops the wait where the traveller left, and keeps what they said and what was said back", () => {
    expect(trace.status).toBe("stopped");
    expect(span(trace, /^Waiting for the traveller to choose a seat/)).toMatchObject({ startMs: 25, durationMs: 2667, status: "stopped" });
    expect(span(trace, "You said: “never mind”")).toMatchObject({ kind: "understand", startMs: 2691 });
    expect(span(trace, "Left unfinished. Nothing was changed.")).toMatchObject({ kind: "said", startMs: 2692 });
    expect(trace.summary).toBe("Left unfinished. Nothing was changed.");
    expect(trace.durationMs).toBe(2692);
  });

  it("says the closing line once, when the journey was closed, even if it had been stopped before", () => {
    const base = runOf("left unfinished");
    const stoppedAt = Date.parse(base.startedAt!) + 2000;
    const log = [...base.log.slice(0, -2), { at: stoppedAt, type: "stopped", stepId: null }, ...base.log.slice(-2)];
    const stoppedFirst = adaptSayso({ ...base, log }, { origin });

    const closing = stoppedFirst.spans.filter((entry) => entry.name === "Left unfinished. Nothing was changed.");
    expect(closing.map((entry) => entry.startMs)).toEqual([2692]);
    // The wait ended when the run was stopped.
    expect(span(stoppedFirst, /^Waiting for the traveller to choose a seat/)).toMatchObject({ startMs: 25, durationMs: 1975, status: "stopped" });
  });
});

describe("a journey still waiting when it was written out", () => {
  const trace = adapt("waiting at the seat map");

  it("has been waiting until that moment", () => {
    expect(trace.status).toBe("waiting");
    // Written out 3454 ms after the words were said; the last thing logged was at 31.
    expect(trace.durationMs).toBe(3454);
    const wait = span(trace, /^Waiting for the traveller to choose a seat/);
    expect(wait).toMatchObject({ startMs: 31, durationMs: 3423, status: "ok", attributes: { stillWaiting: true } });
  });
});

describe("words read by a model", () => {
  const trace = adapt("read by a model");

  it("draws the reading as a model call, as long as the model took", () => {
    expect(span(trace, "Read by gemini-3.5-flash-lite")).toMatchObject({ kind: "model", startMs: 0, durationMs: 1172 });
    expect(trace.totals).toMatchObject({ modelCalls: 1, calls: 4 });
    // Everything else begins after it.
    expect(spansOf(trace, "tool")[0].startMs).toBe(1174);
  });
});

describe("words that were not understood", () => {
  const trace = adapt("words it could not read");

  it("is a failed run with no plan, and the reply it was given", () => {
    expect(trace).toMatchObject({ status: "failed", durationMs: 2 });
    expect(span(trace, "Read by the built-in rules, not understood")).toMatchObject({ kind: "understand", status: "failed" });
    expect(spansOf(trace, "plan")).toHaveLength(0);
    expect(spansOf(trace, "said")[0].shown).toContain("I did not understand that");
    expect(trace.totals.failures).toBe(1);
  });

  it("small talk is not a failure", () => {
    const hello = adapt("small talk");
    expect(hello.status).toBe("ok");
    expect(hello.totals.failures).toBe(0);
  });
});

describe("the other journeys", () => {
  it("a cancelled flight has the refund to confirm as a wait, and the account question has no wait", () => {
    expect(spansOf(adapt("a flight cancelled and refunded"), "wait").map((wait) => wait.name)).toEqual(["Waiting for the traveller to confirm the refund"]);
    expect(spansOf(adapt("a question about the account"), "wait")).toEqual([]);
  });

  it("three requests in one sentence ask the traveller four things", () => {
    expect(spansOf(adapt("three requests in one sentence"), "wait").map((wait) => wait.name)).toEqual([
      "Waiting for the traveller to choose a day",
      "Waiting for the traveller to choose a flight",
      "Waiting for the traveller to choose a seat",
      "Waiting for the traveller to agree the price",
    ]);
  });
});

describe("a turn saved before the log was kept", () => {
  it("is placed by its first log entry, and says it has no start time", () => {
    const base = runOf("a window seat, paid for");
    const trace = adaptSayso({ ...base, startedAt: null }, { origin });
    expect(trace.startedAt).toBeNull();
    expect(traceSchema.safeParse(trace).success).toBe(true);
    expect(spansOf(trace, "tool")).toHaveLength(3);
  });

  it("with no log at all, lays its calls end to end after the reading, and says the times were worked out", () => {
    const base = runOf("a window seat, paid for");
    const trace = adaptSayso({ ...base, startedAt: null, log: [] }, { origin });

    // Reading took 2 ms; the calls took 100, 158 and 39.
    const calls = spansOf(trace, "tool");
    expect(calls.map((call) => [call.name, call.startMs, call.durationMs, call.timing])).toEqual([
      ["GET /api/flights/JN203_2026-10-15/seats", 2, 100, "estimated"],
      ["POST /api/quotes", 102, 158, "estimated"],
      ["POST /api/orders", 260, 39, "estimated"],
    ]);
    expect(String(calls[0].attributes.note)).toContain("before Sayso noted when things happened");
    expect(trace.durationMs).toBe(299);
    expect(trace.totals).toMatchObject({ calls: 3, failures: 0 });
    expect(spansOf(trace, "check").map((check) => [check.startMs, check.status, check.timing])).toEqual([
      [299, "ok", "estimated"],
      [299, "ok", "estimated"],
      [299, "ok", "estimated"],
    ]);
    // Nobody can be said to have waited: the turn does not say when anything was shown.
    expect(spansOf(trace, "wait")).toEqual([]);
    expect(traceSchema.safeParse(trace).error?.issues ?? []).toEqual([]);
  });

  it("is not measured against the day it was written out, when it was still waiting", () => {
    const base = runOf("waiting at the seat map");
    const trace = adaptSayso({ ...base, startedAt: null, log: [] }, { origin });
    expect(trace.status).toBe("waiting");
    expect(trace.durationMs).toBeLessThan(1000);
    expect(traceSchema.safeParse(trace).error?.issues ?? []).toEqual([]);
  });
});

describe("text longer than a timeline has room for", () => {
  it("is cut, and the run is still read", () => {
    const base = runOf("small talk");
    const trace = adaptSayso({ ...base, reply: "word ".repeat(1000) }, { origin });
    expect(traceSchema.safeParse(trace).error?.issues ?? []).toEqual([]);
    expect(trace.summary).toHaveLength(1000);
    expect(spansOf(trace, "said")[0].shown).toHaveLength(2000);
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
