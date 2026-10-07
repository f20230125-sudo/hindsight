import { describe, expect, it } from "vitest";
import agentDeskSample from "@/samples/agent-desk.json";
import flowboardSample from "@/samples/flowboard.json";
import saysoSample from "@/samples/sayso.json";
import { ALLOWED_ORIGINS, ENVELOPE_FORMAT, MAX_BYTES, acceptMessage, readEnvelope, readText } from "./receive";
import { loadSamples } from "./samples";

// The envelopes are real: what each app's button handed over when scripts/record-apps.mjs pressed it.
const sayso = saysoSample.runs[0].envelope as { app: string; data: unknown };
const flowboard = flowboardSample.runs[0].envelope as { app: string; data: unknown };
const agentDesk = agentDeskSample.runs[0].envelope as { app: string; data: unknown };

const AT = "2026-10-07T12:00:00.000Z";
const opener = { name: "the tab that opened this one" };
const message = (origin: string, data: unknown, source: unknown = opener) => ({ origin, source, data });

describe("reading a run an app wrote", () => {
  it.each([
    ["sayso", sayso],
    ["flowboard", flowboard],
    ["agent-desk", agentDesk],
  ])("reads a real %s run into a trace, marked with how it arrived", (source, envelope) => {
    const read = readEnvelope(envelope, "sent", AT);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.trace.source).toBe(source);
    expect(read.trace.origin).toEqual({ how: "sent", at: AT });
    expect(read.trace.spans.length).toBeGreaterThan(0);
  });

  it("reads the text of a file the same way, and says it came as a file", () => {
    const read = readText(JSON.stringify(sayso), "file", AT);
    expect(read.ok && read.trace.origin).toEqual({ how: "file", at: AT });
  });

  describe("refuses, and says why in plain words", () => {
    const refusal = (input: unknown) => {
      const read = readEnvelope(input, "sent", AT);
      if (read.ok) throw new Error("It was accepted.");
      return read.reason;
    };

    it("what is not a run at all", () => {
      expect(refusal("hello")).toContain('"format": "hindsight/run"');
      expect(refusal(null)).toContain("not a run written by one of the apps");
      expect(refusal({ format: "something/else", version: 1, app: "sayso", data: {} })).toContain("not a run");
    });

    it("a format version it does not know", () => {
      expect(refusal({ ...sayso, format: ENVELOPE_FORMAT, version: 2 })).toBe("This run is in version 2 of the format. This Hindsight reads version 1.");
    });

    it("an app it does not read", () => {
      expect(refusal({ format: ENVELOPE_FORMAT, version: 1, app: "excel", data: {} })).toBe('"excel" is not an app Hindsight reads. It reads Sayso, Flowboard, Agent Desk.');
      // A name from outside is said back only in part.
      expect(refusal({ format: ENVELOPE_FORMAT, version: 1, app: "x".repeat(5000), data: {} })).toHaveLength(`"${"x".repeat(40)}…" is not an app Hindsight reads. It reads Sayso, Flowboard, Agent Desk.`.length);
    });

    it("data nested deeper than any app writes, however deep, without falling over", () => {
      const nested = (levels: number) => {
        let value: unknown = "the bottom";
        for (let level = 0; level < levels; level += 1) value = [value];
        return value;
      };
      const flowboardRun = flowboard.data as { flow: unknown; run: { steps: object[] } };
      const holding = (output: unknown) => ({
        format: ENVELOPE_FORMAT,
        version: 1,
        app: "flowboard",
        data: { ...flowboardRun, run: { ...flowboardRun.run, steps: flowboardRun.run.steps.map((step, index) => (index === 0 ? { ...step, output } : step)) } },
      });

      // Twenty levels is ordinary data and is kept.
      expect(readEnvelope(holding(nested(20)), "file", AT).ok).toBe(true);
      // A hundred levels, which the checks could walk, and a hundred thousand, which they could not.
      for (const levels of [100, 100_000]) {
        expect(refusal(holding(nested(levels)))).toBe("This run holds data nested more than 64 levels deep, which no app writes.");
      }
      // As the text of a file, too.
      const text = JSON.stringify(holding("HERE")).replace('"HERE"', `${"[".repeat(100_000)}1${"]".repeat(100_000)}`);
      expect(readText(text, "file", AT).ok).toBe(false);
    });

    it("an app's run that is not in the shape that app writes, naming where it goes wrong", () => {
      expect(refusal({ ...sayso, format: ENVELOPE_FORMAT, version: 1, data: {} })).toMatch(/^This Sayso run is not in the shape Sayso writes\. id: /);
      expect(refusal({ format: ENVELOPE_FORMAT, version: 1, app: "flowboard", data: { flow: { name: "x" } } })).toMatch(/^This Flowboard run is not in the shape Flowboard writes\. flow\.blocks: /);
      expect(refusal({ format: ENVELOPE_FORMAT, version: 1, app: "agent-desk", data: { run: agentDesk.data && (agentDesk.data as { run: unknown }).run } })).toMatch(/^This Agent Desk run is not in the shape its run page holds\. events: /);
    });
  });
});

describe("reading a file", () => {
  it("refuses what is too big, before reading any of it", () => {
    const read = readText("x".repeat(MAX_BYTES + 1), "file", AT);
    expect(read).toEqual({ ok: false, reason: "This file is 2.0 MB. Hindsight takes runs up to 2 MB." });
  });

  it("refuses what is not JSON", () => {
    expect(readText("<html>not a run</html>", "file", AT)).toEqual({ ok: false, reason: "This is not JSON, so it is not a run. Drop the file an app's button wrote." });
    expect(readText("", "file", AT).ok).toBe(false);
  });
});

describe("a message from another page", () => {
  const SAYSO_SITE = "https://sayso-sigma.vercel.app";

  it("is taken when an allowed page sends a run it is allowed to send, from the tab that opened this one", () => {
    const accepted = acceptMessage(message(SAYSO_SITE, sayso), opener, AT);
    expect(accepted.kind).toBe("received");
    if (accepted.kind === "received") expect(accepted.trace).toMatchObject({ source: "sayso", origin: { how: "sent", at: AT } });
    expect(acceptMessage(message("http://127.0.0.1:3020", flowboard), opener, AT).kind).toBe("received");
    expect(acceptMessage(message("http://localhost:3010", agentDesk), opener, AT).kind).toBe("received");
  });

  it("is ignored, without a word, from any other page, or any other window, or when nothing opened this page", () => {
    expect(acceptMessage(message("https://evil.example", sayso), opener, AT)).toEqual({ kind: "ignore" });
    expect(acceptMessage(message(SAYSO_SITE, sayso, { name: "some other window" }), opener, AT)).toEqual({ kind: "ignore" });
    expect(acceptMessage(message(SAYSO_SITE, sayso, null), null, AT)).toEqual({ kind: "ignore" });
    // Hindsight's own address is not on the list, so a page cannot send itself a run.
    expect(acceptMessage(message("http://localhost:3040", sayso), opener, AT)).toEqual({ kind: "ignore" });
    // Nor is a word that every object answers to, or a page with no address of its own.
    for (const origin of ["constructor", "__proto__", "toString", "hasOwnProperty", "null", ""]) {
      expect(acceptMessage(message(origin, sayso), opener, AT)).toEqual({ kind: "ignore" });
    }
    // A site that only begins like an allowed one is another site.
    expect(acceptMessage(message(`${SAYSO_SITE}.evil.example`, sayso), opener, AT)).toEqual({ kind: "ignore" });
    expect(acceptMessage(message("http://sayso-sigma.vercel.app", sayso), opener, AT)).toEqual({ kind: "ignore" });
  });

  it("is read as the JSON a file would hold, so what a message alone can carry does no harm", () => {
    // An object that holds itself cannot be written out, and is refused.
    const circular: Record<string, unknown> = { format: ENVELOPE_FORMAT, version: 1, app: "sayso", data: {} };
    circular.data = { self: circular };
    expect(acceptMessage(message(SAYSO_SITE, circular), opener, AT)).toEqual({ kind: "refused", reason: "The run could not be read." });

    // A date inside a run arrives as the text JSON makes of it, and the run is read as usual.
    const run = sayso.data as { calls: object[] };
    const withDate = { ...sayso, data: { ...run, calls: run.calls.map((call) => ({ ...call, result: { at: new Date("2026-10-07T12:00:00.000Z") } })) } };
    const accepted = acceptMessage(message(SAYSO_SITE, withDate), opener, AT);
    expect(accepted.kind).toBe("received");
    if (accepted.kind === "received") {
      const outputs = accepted.trace.spans.filter((span) => span.kind === "tool").map((span) => span.output);
      expect(outputs.length).toBeGreaterThan(0);
      for (const output of outputs) expect(output).toEqual({ at: "2026-10-07T12:00:00.000Z" });
    }
  });

  it("is ignored when it is not a run, whoever sent it", () => {
    for (const data of ["hello", null, 7, { type: "something" }, { format: ENVELOPE_FORMAT }]) {
      expect(acceptMessage(message(SAYSO_SITE, data), opener, AT)).toEqual({ kind: "ignore" });
    }
  });

  it("is refused when a page sends a run as another app", () => {
    const refused = acceptMessage(message(SAYSO_SITE, flowboard), opener, AT);
    expect(refused).toEqual({ kind: "refused", reason: 'https://sayso-sigma.vercel.app may send Sayso runs, not "flowboard" runs.' });
    expect(acceptMessage(message(SAYSO_SITE, { format: ENVELOPE_FORMAT, version: 1, app: "excel", data: {} }), opener, AT).kind).toBe("refused");
  });

  it("is refused when it is too big, or is not the shape its app writes", () => {
    const big = { format: ENVELOPE_FORMAT, version: 1, app: "sayso", data: { pad: "x".repeat(MAX_BYTES + 10) } };
    const tooBig = acceptMessage(message(SAYSO_SITE, big), opener, AT);
    expect(tooBig.kind === "refused" && tooBig.reason).toMatch(/^This run is 2\.0 MB\. Hindsight takes runs up to 2 MB\.$/);

    const wrong = acceptMessage(message(SAYSO_SITE, { format: ENVELOPE_FORMAT, version: 1, app: "sayso", data: { id: 7 } }), opener, AT);
    expect(wrong.kind === "refused" && wrong.reason).toContain("This Sayso run is not in the shape Sayso writes");
  });

  it("can only come from the apps' own pages, on the web or on this machine", () => {
    expect(Object.keys(ALLOWED_ORIGINS).sort()).toEqual([
      "http://127.0.0.1:3010",
      "http://127.0.0.1:3020",
      "http://127.0.0.1:3030",
      "http://localhost:3010",
      "http://localhost:3020",
      "http://localhost:3030",
      "https://flowboard-flax-seven.vercel.app",
      "https://sayso-sigma.vercel.app",
    ]);
    // Each page sends as one app.
    for (const apps of Object.values(ALLOWED_ORIGINS)) expect(apps).toHaveLength(1);
  });
});

describe("the recorded samples", () => {
  const samples = loadSamples();

  it("are all the real runs that were recorded, each read into a trace", () => {
    const bySource = (name: string) => samples.traces.filter((trace) => trace.source === name).length;
    expect([bySource("sayso"), bySource("flowboard"), bySource("agent-desk")]).toEqual([11, 5, 1]);
    expect(samples.traces).toHaveLength(17);
  });

  it("say that they are recordings, and when they were made", () => {
    expect(samples.how).toBe("sample");
    expect(samples.note).toMatch(/^Recorded from the real apps on \d{1,2} \w{3} 2026\./);
    expect(samples.traces.every((trace) => trace.origin.how === "sample")).toBe(true);
    expect(new Set(samples.traces.map((trace) => trace.id)).size).toBe(samples.traces.length);
  });

  it("include a run read by a model, a failed call, a stopped run and a real audit with its calls", () => {
    expect(samples.traces.some((trace) => trace.source === "sayso" && trace.totals.modelCalls > 0)).toBe(true);
    expect(samples.traces.some((trace) => trace.status === "failed")).toBe(true);
    expect(samples.traces.some((trace) => trace.status === "stopped")).toBe(true);
    expect(samples.traces.find((trace) => trace.source === "agent-desk")?.totals.calls).toBe(46);
  });
});
