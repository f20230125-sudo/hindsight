import { describe, expect, it } from "vitest";
import { z } from "zod";
import saysoSample from "@/samples/sayso.json";
import { adaptDeskRun } from "@/sources/agentdesk/adapt";
import { deskRunDetailSchema } from "@/sources/agentdesk/schema";
import githubBotSample from "@/samples/github-bot.json";
import { adaptSayso } from "@/sources/sayso/adapt";
import { saysoRunSchema } from "@/sources/sayso/schema";
import { makeSpan, makeTrace } from "@/test/traces";
import { byDay, dayOf } from "./days";
import { slowestSteps } from "./slowest";
import { timeBy, timeBySource } from "./time";

const origin = { how: "sample", at: "2026-10-07T00:00:00.000Z" } as const;
const sayso = z.object({ runs: z.array(z.object({ label: z.string(), envelope: z.object({ data: saysoRunSchema }) })) }).parse(saysoSample).runs;
const bot = z.object({ runs: z.array(deskRunDetailSchema) }).parse(githubBotSample).runs;

const seat = adaptSayso(sayso.find((entry) => entry.label === "a window seat, paid for")!.envelope.data, { origin });
const audit = adaptDeskRun(bot.find((entry) => entry.run.run_id === "audit-0721cc42cb")!, { source: "github-bot", origin });

describe("timeBy", () => {
  it("counts a real Sayso run's time once: waiting for the traveller, calls, reading, and the gaps between", () => {
    // Waits 3662 + 1931; calls 100 + 158 + 39; reading 2; and 25 ms in which nothing was going on.
    expect(timeBy(seat)).toEqual({ model: 0, call: 297, wait: 5593, own: 2, none: 25 });
  });

  it("counts a call inside a step as the call, not twice", () => {
    // sync 28 to 7956 holds four calls of 7917 ms in all; 28 ms went before the first step began.
    const share = timeBy(audit);
    expect(share).toEqual({ model: 0, call: 7917, wait: 0, own: 53, none: 28 });
    expect(Object.values(share).reduce((sum, ms) => sum + ms, 0)).toBe(audit.durationMs);
  });

  it("adds up to the length of the run, whatever the spans do", () => {
    for (const run of sayso) {
      const trace = adaptSayso(run.envelope.data, { origin });
      expect(Object.values(timeBy(trace)).reduce((sum, ms) => sum + ms, 0)).toBe(trace.durationMs);
    }
  });

  it("lets a model call win over an API call going on at the same time, and a call over a wait", () => {
    const trace = makeTrace({
      durationMs: 100,
      spans: [
        makeSpan("w", { kind: "wait", startMs: 0, durationMs: 100 }),
        makeSpan("c", { kind: "tool", startMs: 20, durationMs: 60 }),
        makeSpan("m", { kind: "model", startMs: 40, durationMs: 20 }),
      ],
    });
    expect(timeBy(trace)).toEqual({ model: 20, call: 40, wait: 40, own: 0, none: 0 });
  });

  it("has all of an empty run in no time at all", () => {
    expect(timeBy(makeTrace({ durationMs: 50, spans: [] }))).toEqual({ model: 0, call: 0, wait: 0, own: 0, none: 50 });
  });
});

describe("timeBySource", () => {
  it("adds the runs of each app up, and only lists apps that have runs", () => {
    const grouped = timeBySource([seat, seat, audit]);
    expect(grouped.map((entry) => entry.source).sort()).toEqual(["github-bot", "sayso"]);
    const sayso2 = grouped.find((entry) => entry.source === "sayso")!;
    expect(sayso2.runs).toBe(2);
    expect(sayso2.totalMs).toBe(seat.durationMs * 2);
    expect(sayso2.share.wait).toBe(5593 * 2);
    expect(timeBySource([])).toEqual([]);
  });
});

describe("dayOf and byDay", () => {
  it("puts a run on the day it began where the viewer is (these tests run on Dubai time)", () => {
    // 21:30 UTC on 6 October is 01:30 on the 7th in Dubai.
    expect(dayOf("2026-10-06T21:30:00.000Z")).toBe("2026-10-07");
    expect(dayOf(null)).toBeNull();
    expect(dayOf("not a time")).toBeNull();
  });

  it("counts the runs of each day by how they ended, with a day between them that had none", () => {
    const days = byDay([
      makeTrace({ id: "a", startedAt: "2026-10-04T08:00:00.000Z", status: "ok" }),
      makeTrace({ id: "b", startedAt: "2026-10-04T09:00:00.000Z", status: "failed" }),
      makeTrace({ id: "c", startedAt: "2026-10-06T09:00:00.000Z", status: "ok" }),
      makeTrace({ id: "d", startedAt: null, status: "ok" }),
    ]);
    expect(days.map((day) => [day.day, day.total])).toEqual([
      ["2026-10-04", 2],
      ["2026-10-05", 0],
      ["2026-10-06", 1],
    ]);
    expect(days[0].counts).toMatchObject({ ok: 1, failed: 1 });
  });

  it("keeps the latest days when there are more than the limit, and nothing when there are no runs", () => {
    const traces = Array.from({ length: 30 }, (_, index) => makeTrace({ id: `t${index}`, startedAt: new Date(Date.UTC(2026, 8, index + 1, 8)).toISOString() }));
    const days = byDay(traces, 7);
    expect(days).toHaveLength(7);
    expect(days.at(-1)?.day).toBe("2026-09-30");
    expect(byDay([])).toEqual([]);
  });

  it("turns the month over without losing a day", () => {
    const days = byDay([makeTrace({ id: "a", startedAt: "2026-09-29T08:00:00.000Z" }), makeTrace({ id: "b", startedAt: "2026-10-02T08:00:00.000Z" })]);
    expect(days.map((day) => day.day)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  it("does not count every day between, when one run is dated far from the rest", () => {
    const traces = [
      makeTrace({ id: "old", startedAt: "1001-01-01T08:00:00.000Z" }),
      makeTrace({ id: "now", startedAt: "2026-10-07T08:00:00.000Z" }),
      makeTrace({ id: "far", startedAt: "9999-06-01T08:00:00.000Z" }),
      // A year that is not four digits is no day at all.
      makeTrace({ id: "endless", startedAt: "+275000-01-01T00:00:00.000Z" }),
      makeTrace({ id: "ancient", startedAt: "0050-01-01T00:00:00.000Z" }),
    ];
    const began = performance.now();
    const days = byDay(traces);
    // Three million days lie between the first and the last. Only the latest are walked.
    expect(performance.now() - began).toBeLessThan(200);
    expect(days).toHaveLength(21);
    expect(days.at(-1)).toMatchObject({ day: "9999-06-01", total: 1 });
    expect(days[0].day).toBe("9999-05-12");
    expect(dayOf("+275000-01-01T00:00:00.000Z")).toBeNull();
    expect(dayOf("0050-01-01T00:00:00.000Z")).toBeNull();
  });
});

describe("slowestSteps", () => {
  it("lists the longest steps across the runs, grouped by what they were, leaving out waits and steps that hold others", () => {
    const steps = slowestSteps([seat, audit], 10);
    // The audit's calls are the longest; the traveller's waits are not listed at all.
    expect(steps[0]).toMatchObject({ source: "github-bot", name: "POST /graphql", count: 2 });
    expect(steps[0].slowest.span.durationMs).toBe(5674);
    expect(steps.some((step) => step.name.startsWith("Waiting"))).toBe(false);
    // "sync" holds the calls, so it is not a step of its own here.
    expect(steps.some((step) => step.name === "sync")).toBe(false);
    const lengths = steps.map((step) => step.slowest.span.durationMs);
    expect(lengths).toEqual([...lengths].sort((a, b) => b - a));
  });

  it("gives the middle length of each kind of step, and how many there were", () => {
    const [graphql] = slowestSteps([audit], 1);
    expect(graphql.medianMs).toBe((5674 + 1643) / 2);
    expect(graphql.count).toBe(2);
  });

  it("stops at the limit", () => {
    expect(slowestSteps([seat, audit], 3)).toHaveLength(3);
  });
});
