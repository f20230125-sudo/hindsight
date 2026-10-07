import { describe, expect, it } from "vitest";
import { makeTrace } from "@/test/traces";
import { mergeTraces } from "./merge";

describe("mergeTraces", () => {
  it("puts the newest run first, and runs with no start time last", () => {
    const merged = mergeTraces([
      makeTrace({ id: "a", startedAt: "2026-10-05T10:00:00.000Z" }),
      makeTrace({ id: "none", startedAt: null }),
      makeTrace({ id: "c", startedAt: "2026-10-07T10:00:00.000Z" }),
    ]);
    expect(merged.map((trace) => trace.id)).toEqual(["c", "a", "none"]);
  });

  it("keeps a run once when two lists hold it, as the copy picked up last", () => {
    const live = makeTrace({ id: "x", title: "from the server", origin: { how: "live", at: "2026-10-07T10:00:00.000Z" } });
    const sent = makeTrace({ id: "x", title: "sent later", origin: { how: "sent", at: "2026-10-07T11:00:00.000Z" } });
    expect(mergeTraces([live], [sent]).map((trace) => trace.title)).toEqual(["sent later"]);
    expect(mergeTraces([sent], [live]).map((trace) => trace.title)).toEqual(["sent later"]);
  });

  it("orders runs that started together by id, so the order never shifts", () => {
    const merged = mergeTraces([makeTrace({ id: "b" }), makeTrace({ id: "a" })]);
    expect(merged.map((trace) => trace.id)).toEqual(["a", "b"]);
  });
});
