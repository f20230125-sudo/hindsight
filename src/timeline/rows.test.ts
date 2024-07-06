import { describe, expect, it } from "vitest";
import { z } from "zod";
import sample from "@/samples/github-bot.json";
import { adaptDeskRun } from "@/sources/agentdesk/adapt";
import { deskRunDetailSchema } from "@/sources/agentdesk/schema";
import type { Span, Trace } from "@/trace/schema";
import { clusterMarkers, layoutOf, percentOf, placeOn, ticksFor } from "./rows";

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
  /** One pixel to the millisecond. */
  const px = (ms: number) => ms;

  it("joins markers that are closer together than the gap, and keeps the rest apart", () => {
    const clusters = clusterMarkers([marker("a", 0), marker("b", 4), marker("c", 9), marker("d", 100), marker("e", 101)], px, 10);
    expect(clusters.map((cluster) => [cluster.at, cluster.items.map((item) => item.id)])).toEqual([
      [0, ["a", "b", "c"]],
      [100, ["d", "e"]],
    ]);
  });

  it("measures from the first marker of a group, so a long chain does not grow without end", () => {
    const clusters = clusterMarkers([marker("a", 0), marker("b", 8), marker("c", 16), marker("d", 24)], px, 10);
    expect(clusters.map((cluster) => cluster.items.length)).toEqual([2, 2]);
  });

  it("sorts markers by time first", () => {
    const [cluster] = clusterMarkers([marker("late", 50), marker("early", 5)], px, 100);
    expect(cluster.items.map((item) => item.id)).toEqual(["early", "late"]);
  });

  it("goes by where markers fall on the track, not by time, so a squeezed wait does not hide a gap", () => {
    // A wait is squeezed: two markers far apart in time but close on the track are drawn as one.
    const squeezed = (ms: number) => (ms < 1000 ? ms : ms < 5000 ? 1000 + (ms - 1000) / 400 : ms - 3990);
    const clusters = clusterMarkers([marker("a", 1100), marker("b", 4900)], squeezed, 16);
    expect(clusters).toHaveLength(1);
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

describe("placeOn: where the arrow keys can stand", () => {
  // How many bars and marks each row has on show. Zoomed in on the middle of
  // the recorded audit, only the first row and the fourth have anything.
  const zoomedIn = [1, 0, 0, 1, 0, 0, 0, 0, 0];

  it("stays where it is put when that row has something on show, keeping to the bars and marks it has", () => {
    expect(placeOn([3, 2, 1], 1, 1)).toEqual({ row: 1, col: 1 });
    expect(placeOn([3, 2, 1], 1, 7)).toEqual({ row: 1, col: 1 });
    expect(placeOn([3, 2, 1], 1, -2)).toEqual({ row: 1, col: 0 });
    expect(placeOn([3, 2, 1], 9, 0)).toEqual({ row: 2, col: 0 });
    expect(placeOn([3, 2, 1], -4, 0)).toEqual({ row: 0, col: 0 });
  });

  it("passes over rows with nothing on show, the way the key was going", () => {
    // Down from the first row lands on the fourth, not on an empty row where nothing could take the focus.
    expect(placeOn(zoomedIn, 1, 0, 1)).toEqual({ row: 3, col: 0 });
    // And up from the fourth, on the first.
    expect(placeOn(zoomedIn, 2, 0, -1)).toEqual({ row: 0, col: 0 });
  });

  it("stays put when there is nothing further that way", () => {
    expect(placeOn(zoomedIn, 4, 0, 1)).toEqual({ row: 3, col: 0 });
    expect(placeOn([0, 0, 1, 1], 1, 0, -1)).toEqual({ row: 2, col: 0 });
  });

  it("finds somewhere to stand when the row it was on has gone from view", () => {
    // The first row has nothing on show: the tab order still has a place, on the nearest row that has.
    expect(placeOn([0, 0, 2, 0], 0, 0)).toEqual({ row: 2, col: 0 });
    expect(placeOn([0, 0, 2, 0], 3, 5)).toEqual({ row: 2, col: 1 });
  });

  it("has nowhere to stand when nothing is on show, and says the first row", () => {
    expect(placeOn([0, 0, 0], 2, 3)).toEqual({ row: 2, col: 0 });
    expect(placeOn([], 0, 0)).toEqual({ row: 0, col: 0 });
  });
});
