import { describe, expect, it } from "vitest";
import { makeTrace } from "@/test/traces";
import { summarise } from "./summary";

describe("summarise", () => {
  it("says nothing about no runs", () => {
    expect(summarise([])).toEqual({ runs: 0, finished: 0, successRate: null, medianMs: null, slowMs: null, modelRuns: 0, failedCalls: 0 });
  });

  it("counts only runs with an outcome when working out how many succeeded", () => {
    const summary = summarise([
      makeTrace({ status: "ok" }),
      makeTrace({ status: "ok" }),
      makeTrace({ status: "failed" }),
      makeTrace({ status: "stopped" }),
      makeTrace({ status: "waiting" }),
      makeTrace({ status: "running" }),
    ]);
    expect(summary.runs).toBe(6);
    expect(summary.finished).toBe(4);
    expect(summary.successRate).toBe(0.5);
  });

  it("finds the middle length and the length that nine in ten stay under", () => {
    const lengths = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const summary = summarise(lengths.map((durationMs) => makeTrace({ durationMs })));
    expect(summary.medianMs).toBe(550);
    expect(summary.slowMs).toBeCloseTo(910);
  });

  it("counts the runs that called a model, and the calls that failed across all of them", () => {
    const summary = summarise([
      makeTrace({ totals: { calls: 3, modelCalls: 2, tokens: 100, failures: 1, avoided: null } }),
      makeTrace({ totals: { calls: 4, modelCalls: 0, tokens: null, failures: 2, avoided: 3 } }),
    ]);
    expect(summary.modelRuns).toBe(1);
    expect(summary.failedCalls).toBe(3);
  });
});
