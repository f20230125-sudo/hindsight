import { describe, expect, it } from "vitest";
import { z } from "zod";
import sample from "@/samples/github-bot.json";
import { deskRunDetailSchema } from "../agentdesk/schema";
import { MAX_RUNS, loadGithubBot } from "./load";
import { runsFromSnapshot } from "./snapshot";

// The recorded runs, put back in the shape of the bot's public snapshot, so
// the loader can be tried with no network.
const recorded = z.object({ runs: z.array(deskRunDetailSchema) }).parse(sample).runs;
const snapshot = {
  exported_at: "2026-10-07T00:00:00.000Z",
  routes: {
    "/api/runs?limit=100": { runs: recorded.map((entry) => entry.run) },
    ...Object.fromEntries(recorded.map((entry) => [`/api/runs/${entry.run.run_id}`, entry])),
  },
};

const NOW = new Date("2026-10-07T12:00:00.000Z");
const answering = (body: unknown, status = 200): typeof fetch => async () => new Response(JSON.stringify(body), { status });

describe("runsFromSnapshot", () => {
  it("finds every run with its events", () => {
    const runs = runsFromSnapshot(snapshot);
    expect(runs).toHaveLength(recorded.length);
    expect(runs?.[0].events.length).toBeGreaterThan(0);
  });

  it("skips a run whose details are missing and refuses what is not a snapshot", () => {
    const [first, ...others] = recorded;
    const missing = { ...snapshot, routes: { ...snapshot.routes, [`/api/runs/${first.run.run_id}`]: undefined } };
    expect(runsFromSnapshot(missing)).toHaveLength(others.length);
    expect(runsFromSnapshot({ nothing: true })).toBeNull();
    expect(runsFromSnapshot({ routes: {} })).toBeNull();
    expect(runsFromSnapshot("text")).toBeNull();
  });
});

describe("loadGithubBot", () => {
  it("reads the runs live, newest first, as traces from the GitHub bot", async () => {
    const loaded = await loadGithubBot({ fetch: answering(snapshot), now: () => NOW });
    expect(loaded.how).toBe("live");
    expect(loaded.note).toBeNull();
    expect(loaded.at).toBe("2026-10-07T12:00:00.000Z");
    expect(loaded.traces).toHaveLength(Math.min(MAX_RUNS, recorded.length));
    expect(loaded.traces.every((trace) => trace.source === "github-bot" && trace.origin.how === "live")).toBe(true);
    const starts = loaded.traces.map((trace) => trace.startedAt ?? "");
    expect(starts).toEqual([...starts].sort().reverse());
  });

  it("falls back to the recorded copy, and says why, when GitHub cannot be reached", async () => {
    const down: typeof fetch = async () => {
      throw new TypeError("network down");
    };
    const loaded = await loadGithubBot({ fetch: down, now: () => NOW });
    expect(loaded.how).toBe("sample");
    expect(loaded.note).toContain("GitHub could not be reached");
    expect(loaded.note).toContain("recorded on");
    expect(loaded.traces.length).toBeGreaterThan(0);
    expect(loaded.traces.every((trace) => trace.origin.how === "sample")).toBe(true);
  });

  it("falls back when GitHub answers with an error, with text, or with something that is not a snapshot", async () => {
    expect((await loadGithubBot({ fetch: answering({}, 404), now: () => NOW })).note).toContain("answered 404");
    const text: typeof fetch = async () => new Response("<html>not json</html>");
    expect((await loadGithubBot({ fetch: text, now: () => NOW })).note).toContain("could not be read");
    const other = await loadGithubBot({ fetch: answering({ routes: {} }), now: () => NOW });
    expect(other.how).toBe("sample");
    expect(other.note).toContain("no runs");
  });
});
