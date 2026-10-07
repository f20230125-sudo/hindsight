import { describe, expect, it } from "vitest";
import { z } from "zod";
import sample from "@/samples/github-bot.json";
import { adaptDeskRun } from "@/sources/agentdesk/adapt";
import { deskRunDetailSchema } from "@/sources/agentdesk/schema";
import type { Span, Trace } from "@/trace/schema";
import { clusterMarkers, layoutOf, percentOf, ticksFor } from "./rows";

const recorded = z.object({ runs: z.array(deskRunDetailSchema) }).parse(sample).runs;
const real = (id: string): Trace => {
  const detail = recorded.find((entry) => entry.run.run_id === id);
  if (!detail) throw new Error(`No recorded run ${id}.`);
  return adaptDeskRun(detail, { source: "github-bot", origin: { how: "sample", at: "2026-10-07T00:00:00.000Z" } });
};

const span = (id: string, parentId: string | null, startMs: number, durationMs: number): Span => ({
  id,
  parentId,
  kind: "step",
  name: id,
  startMs,
  durationMs,
  status: "ok",
  timing: "measured",
  attributes: {},
});

const trace = (spans: Span[]): Trace => ({
  id: "sayso:a",
  source: "sayso",
  agent: null,
  title: "t",
  summary: null,
  startedAt: null,
  durationMs: 1000,
  status: "ok",
  spans,
  totals: { calls: 0, modelCalls: 0, tokens: null, failures: 0, avoided: null },
  origin: { how: "sent", at: "2026-10-07T00:00:00.000Z" },
});

describe("layoutOf", () => {
  it("gives each bar a row, with the spans it holds just below it, one step in", () => {
    const { rows } = layoutOf(trace([span("b", null, 500, 100), span("a", null, 0, 400), span("a2", "a", 50, 100), span("a1", "a", 10, 20)]));
    expect(rows.map((row) => [row.span.id, row.depth])).toEqual([
      ["a", 0],
      ["a1", 1],
      ["a2", 1],
      ["b", 0],
    ]);
  });

  it("draws spans with no length as markers on the span that holds them, or on the top row", () => {
    const { rows, top } = layoutOf(trace([span("a", null, 0, 400), span("m2", "a", 200, 0), span("m1", "a", 100, 0), span("lonely", null, 700, 0)]));
    expect(rows).toHaveLength(1);
    expect(rows[0].markers.map((marker) => marker.id)).toEqual(["m1", "m2"]);
    expect(top.map((marker) => marker.id)).toEqual(["lonely"]);
  });

  it("keeps a span that holds others as a bar, even with no length of its own", () => {
    const { rows } = layoutOf(trace([span("a", null, 100, 0), span("a1", "a", 100, 20)]));
    expect(rows.map((row) => [row.span.id, row.depth])).toEqual([
      ["a", 0],
      ["a1", 1],
    ]);
  });

  it("lays out a real audit as five phases, with its four calls under the first", () => {
    const { rows, top } = layoutOf(real("audit-0721cc42cb"));
    expect(top).toEqual([]);
    expect(rows.map((row) => [row.span.name, row.depth])).toEqual([
      ["sync", 0],
      ["GET /user/repos", 1],
      ["GET /users/f20230125-sudo/repos", 1],
      ["POST /graphql", 1],
      ["POST /graphql", 1],
      ["details", 0],
      ["checks", 0],
      ["repo", 0],
      ["summary", 0],
    ]);
    // The thirteen repositories' lines and thirty-six findings are all markers on the one "repo" row.
    expect(rows[7].markers).toHaveLength(13 + 36);
  });

  it("puts a run with only a message on the top row", () => {
    const { rows, top } = layoutOf(real("read-3ae4b125d2"));
    expect(rows).toEqual([]);
    expect(top.map((marker) => marker.kind)).toEqual(["said"]);
  });
});

describe("clusterMarkers", () => {
  const marker = (id: string, startMs: number) => span(id, null, startMs, 0);

  it("joins markers that are closer together than the gap, and keeps the rest apart", () => {
    const clusters = clusterMarkers([marker("a", 0), marker("b", 4), marker("c", 9), marker("d", 100), marker("e", 101)], 10);
    expect(clusters.map((cluster) => [cluster.at, cluster.items.map((item) => item.id)])).toEqual([
      [0, ["a", "b", "c"]],
      [100, ["d", "e"]],
    ]);
  });

  it("measures from the first marker of a group, so a long chain does not grow without end", () => {
    const clusters = clusterMarkers([marker("a", 0), marker("b", 8), marker("c", 16), marker("d", 24)], 10);
    expect(clusters.map((cluster) => cluster.items.length)).toEqual([2, 2]);
  });

  it("sorts markers by time first", () => {
    const [cluster] = clusterMarkers([marker("late", 50), marker("early", 5)], 100);
    expect(cluster.items.map((item) => item.id)).toEqual(["early", "late"]);
  });
});

describe("the axis", () => {
  it("picks round ticks from zero", () => {
    expect(ticksFor(7998, 6)).toEqual([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000]);
    expect(ticksFor(2025, 4)).toEqual([0, 500, 1000, 1500, 2000]);
    expect(ticksFor(0)).toEqual([0]);
  });

  it("places a time along the track and keeps it on the track", () => {
    expect(percentOf(250, 1000)).toBe(25);
    expect(percentOf(-5, 1000)).toBe(0);
    expect(percentOf(5000, 1000)).toBe(100);
    expect(percentOf(10, 0)).toBe(0);
  });
});
