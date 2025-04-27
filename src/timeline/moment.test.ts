import { describe, expect, it } from "vitest";
import { z } from "zod";
import saysoSample from "@/samples/sayso.json";
import { adaptSayso } from "@/sources/sayso/adapt";
import { saysoRunSchema } from "@/sources/sayso/schema";
import { makeSpan, makeTrace } from "@/test/traces";
import { momentAt } from "./moment";

// A real run: a window seat chosen and paid for. The traveller was asked to
// choose a seat from 107 ms to 3769 ms, and to agree the price from 3937 ms to
// 5868 ms. The run ended at 5917 ms.
const recorded = z.object({ runs: z.array(z.object({ label: z.string(), envelope: z.object({ data: saysoRunSchema }) })) }).parse(saysoSample).runs;
const trace = adaptSayso(recorded.find((entry) => entry.label === "a window seat, paid for")!.envelope.data, { origin: { how: "sample", at: "2026-10-07T00:00:00.000Z" } });

describe("momentAt, in a real run", () => {
  it("at the start, the words are being read, and the person has said what they said", () => {
    const moment = momentAt(trace, 1);
    expect(moment.now.map((entry) => entry.span.name)).toEqual(["Read by the built-in rules"]);
    expect(moment.shown.map((entry) => entry.text)).toEqual(["You said: “a window seat on my London flight”"]);
  });

  it("while the traveller is choosing, that wait is what is going on, and the cabin has been shown", () => {
    const moment = momentAt(trace, 2000);
    expect(moment.now.map((entry) => entry.span.name)).toEqual(["Waiting for the traveller to choose a seat"]);
    expect(moment.now[0].elapsedMs).toBe(2000 - 107);
    expect(moment.shown.map((entry) => entry.text)).toEqual([
      "You said: “a window seat on my London flight”",
      expect.stringContaining("Here is the cabin"),
      "Shown: Seat map",
    ]);
  });

  it("while a call is made, the call is what is going on, and nothing new has been shown", () => {
    const during = momentAt(trace, 3800);
    expect(during.now.map((entry) => entry.span.name)).toEqual(["POST /api/quotes"]);
    expect(during.shown).toEqual(momentAt(trace, 3700).shown);
  });

  it("at the end, everything has been shown, in the order it came, and nothing is going on", () => {
    const moment = momentAt(trace, trace.durationMs);
    expect(moment.now).toEqual([]);
    const times = moment.shown.map((entry) => entry.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(moment.shown.at(-1)?.text).toMatch(/checks|^You asked for a window seat|Charged AED/);
    expect(moment.shown.map((entry) => entry.text)).toContain("Shown: Receipt");
  });

  it("only shows what has happened by the moment, never what is still to come", () => {
    const early = momentAt(trace, 500).shown.map((entry) => entry.id);
    const late = momentAt(trace, 5000).shown.map((entry) => entry.id);
    for (const id of early) expect(late).toContain(id);
    expect(late.length).toBeGreaterThan(early.length);
  });
});

describe("momentAt, with steps that hold others", () => {
  const nested = makeTrace({
    durationMs: 100,
    spans: [
      makeSpan("phase", { startMs: 10, durationMs: 80 }),
      makeSpan("call", { parentId: "phase", kind: "tool", startMs: 20, durationMs: 30 }),
      makeSpan("line", { parentId: "phase", startMs: 25, durationMs: 0, shown: "Looking inside." }),
    ],
  });

  it("lists the step first and what is inside it after, with how deep each is", () => {
    const moment = momentAt(nested, 30);
    expect(moment.now.map((entry) => [entry.span.id, entry.depth])).toEqual([
      ["phase", 0],
      ["call", 1],
    ]);
    expect(moment.shown.map((entry) => entry.text)).toEqual(["Looking inside."]);
  });

  it("does not count a bar as going on at the moment it ends", () => {
    expect(momentAt(nested, 50).now.map((entry) => entry.span.id)).toEqual(["phase"]);
    expect(momentAt(nested, 90).now).toEqual([]);
  });
});
