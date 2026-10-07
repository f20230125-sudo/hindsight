import { describe, expect, it } from "vitest";
import { formatAgo, formatMs, formatOffset, percentile, plural } from "./format";
import { MAX_DEPTH, nestsDeeperThan, toJson, toRecord } from "./json";
import { traceSchema, type Span, type Trace } from "./schema";

const span = (id: string, parentId: string | null = null): Span => ({
  id,
  parentId,
  kind: "step",
  name: id,
  startMs: 0,
  durationMs: 10,
  status: "ok",
  timing: "measured",
  attributes: {},
});

const trace = (spans: Span[]): Trace => ({
  id: "sayso:a",
  source: "sayso",
  agent: null,
  title: "Seat 14A",
  summary: null,
  startedAt: "2026-10-07T10:00:00.000Z",
  durationMs: 100,
  status: "ok",
  spans,
  totals: { calls: 0, modelCalls: 0, tokens: null, failures: 0, avoided: null },
  origin: { how: "sent", at: "2026-10-07T10:00:01.000Z" },
});

describe("the trace schema", () => {
  it("accepts a run with spans that nest", () => {
    expect(traceSchema.safeParse(trace([span("a"), span("b", "a"), span("c", "b")])).success).toBe(true);
  });

  it("refuses two spans with one id", () => {
    const checked = traceSchema.safeParse(trace([span("a"), span("a")]));
    expect(checked.success).toBe(false);
    expect(checked.error?.issues[0].message).toContain('share the id "a"');
  });

  it("refuses a span whose parent is not in the run", () => {
    const checked = traceSchema.safeParse(trace([span("a", "ghost")]));
    expect(checked.error?.issues[0].message).toContain('"ghost", which is not in the run');
  });

  it("refuses spans that are each other's ancestors", () => {
    const checked = traceSchema.safeParse(trace([span("a", "b"), span("b", "a")]));
    expect(checked.error?.issues.some((issue) => issue.message.includes("its own ancestor"))).toBe(true);
  });

  it("refuses negative or endless times, an unknown source, and data that is not JSON", () => {
    expect(traceSchema.safeParse({ ...trace([]), durationMs: -1 }).success).toBe(false);
    expect(traceSchema.safeParse({ ...trace([]), durationMs: Infinity }).success).toBe(false);
    expect(traceSchema.safeParse({ ...trace([]), source: "excel" }).success).toBe(false);
    expect(traceSchema.safeParse(trace([{ ...span("a"), attributes: { when: new Date() as never } }])).success).toBe(false);
  });

  it("refuses a time that is not a date, so nothing later has to wonder", () => {
    for (const startedAt of ["yesterday", "", "2026-13-45T99:00:00Z"]) {
      const checked = traceSchema.safeParse({ ...trace([]), startedAt });
      expect(checked.success).toBe(false);
      expect(checked.error?.issues[0]).toMatchObject({ path: ["startedAt"], message: "Not a date and time." });
    }
    expect(traceSchema.safeParse({ ...trace([]), origin: { how: "sent", at: "not a time" } }).success).toBe(false);
    // A run may not say when it began at all.
    expect(traceSchema.safeParse({ ...trace([]), startedAt: null }).success).toBe(true);
  });
});

describe("toJson", () => {
  it("keeps JSON, drops what JSON cannot hold, and cuts long text", () => {
    expect(toJson({ a: 1, b: [true, null, "x"], c: undefined, d: () => 1, e: NaN })).toEqual({ a: 1, b: [true, null, "x"], e: null });
    expect(String(toJson("x".repeat(5000)))).toHaveLength(4001);
    expect(toRecord("text")).toEqual({});
    expect(toRecord(null)).toEqual({});
    expect(toRecord({ ok: true })).toEqual({ ok: true });
  });

  it("leaves out what is nested too deep, and can be given data of any depth", () => {
    let deep: unknown = "the bottom";
    for (let level = 0; level < 100_000; level += 1) deep = { inside: deep };

    let at = toJson(deep);
    let levels = 0;
    while (at !== null && typeof at === "object" && !Array.isArray(at)) {
      at = at.inside;
      levels += 1;
    }
    expect(levels).toBe(MAX_DEPTH);
    expect(at).toBe("…");
  });

  it("does not let a field called __proto__ change what an object is", () => {
    const hostile = JSON.parse('{"name": "x", "__proto__": {"isAdmin": true}}');
    const kept = toJson(hostile) as { [key: string]: unknown };
    expect(kept).toEqual({ name: "x" });
    expect(kept.isAdmin).toBeUndefined();
    expect(Object.getPrototypeOf(kept)).toBe(Object.prototype);
    expect(({} as { isAdmin?: boolean }).isAdmin).toBeUndefined();
  });
});

describe("nestsDeeperThan", () => {
  const nested = (levels: number) => {
    let value: unknown = 1;
    for (let level = 0; level < levels; level += 1) value = level % 2 === 0 ? [value] : { inside: value };
    return value;
  };

  it("counts the levels of lists and objects", () => {
    expect(nestsDeeperThan("text", 0)).toBe(false);
    expect(nestsDeeperThan({ a: [1, 2, { b: 3 }] }, 3)).toBe(false);
    expect(nestsDeeperThan({ a: [1, 2, { b: 3 }] }, 2)).toBe(true);
    expect(nestsDeeperThan(nested(64), 64)).toBe(false);
    expect(nestsDeeperThan(nested(65), 64)).toBe(true);
  });

  it("measures data far deeper than a function could follow, and data that holds itself", () => {
    expect(nestsDeeperThan(nested(500_000), 64)).toBe(true);
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(nestsDeeperThan(circular, 64)).toBe(true);
  });
});

describe("formatMs", () => {
  it.each([
    [0.4, "under 1 ms"],
    [218, "218 ms"],
    [999.6, "1000 ms"],
    [2025, "2.03 s"],
    [14_250, "14.3 s"],
    [72_000, "1 min 12 s"],
    [3_900_000, "1 h 5 min"],
  ])("writes %d ms as %s", (ms, text) => {
    expect(formatMs(ms)).toBe(text);
  });

  it("writes an offset with a plus", () => {
    expect(formatOffset(280)).toBe("+280 ms");
    expect(formatOffset(0)).toBe("+0 ms");
    expect(formatOffset(0.3)).toBe("+0 ms");
  });
});

describe("formatAgo", () => {
  const now = Date.parse("2026-10-07T12:00:00.000Z");
  it.each([
    ["2026-10-07T11:59:40.000Z", "just now"],
    ["2026-10-07T11:55:00.000Z", "5 min ago"],
    ["2026-10-07T09:00:00.000Z", "3 h ago"],
    ["2026-10-06T09:00:00.000Z", "1 day ago"],
    ["2026-10-02T09:00:00.000Z", "5 days ago"],
    ["2026-08-02T09:00:00.000Z", "2 Aug 2026"],
  ])("says %s as %s", (iso, text) => {
    expect(formatAgo(iso, now)).toBe(text);
  });

  it("says unknown for no time or a bad one", () => {
    expect(formatAgo(null, now)).toBe("unknown");
    expect(formatAgo("not a date", now)).toBe("unknown");
  });
});

describe("percentile and plural", () => {
  it("finds the middle and the slow end", () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([5], 0.9)).toBe(5);
    expect(percentile([1, 3], 0.5)).toBe(2);
    expect(percentile([4, 1, 3, 2, 10], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1);
  });

  it("writes counts", () => {
    expect(plural(1, "call")).toBe("1 call");
    expect(plural(3, "call")).toBe("3 calls");
    expect(plural(0, "entry", "entries")).toBe("0 entries");
  });
});
