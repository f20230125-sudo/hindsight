import { describe, expect, it } from "vitest";
import { makeTrace } from "@/test/traces";
import { waysOf } from "./ways";

describe("waysOf", () => {
  it("counts, for each app, the runs that came each way", () => {
    const ways = waysOf([
      makeTrace({ id: "a", source: "sayso", origin: { how: "sample", at: "x" } }),
      makeTrace({ id: "b", source: "sayso", origin: { how: "sent", at: "x" } }),
      makeTrace({ id: "c", source: "sayso", origin: { how: "sent", at: "x" } }),
      makeTrace({ id: "d", source: "flowboard", origin: { how: "file", at: "x" } }),
      makeTrace({ id: "e", source: "github-bot", origin: { how: "live", at: "x" } }),
    ]);
    expect(ways.sayso).toEqual({ live: 0, recorded: 1, sent: 2, file: 0 });
    expect(ways.flowboard).toEqual({ live: 0, recorded: 0, sent: 0, file: 1 });
    expect(ways["github-bot"]).toEqual({ live: 1, recorded: 0, sent: 0, file: 0 });
    expect(ways["agent-desk"]).toEqual({ live: 0, recorded: 0, sent: 0, file: 0 });
  });
});
