import { describe, expect, it } from "vitest";
import { makeTrace } from "@/test/traces";
import { NO_FILTERS, applyFilters, filtersFromParams, hasFilters, paramsFromFilters, toggled } from "./filters";

const traces = [
  makeTrace({ id: "sayso:a", source: "sayso", title: "A window seat on my London flight", status: "ok" }),
  makeTrace({ id: "flowboard:b", source: "flowboard", title: "Heat check", summary: "Fetch the weather and warn", status: "failed" }),
  makeTrace({ id: "github-bot:c", source: "github-bot", agent: "patch", title: "Audit repositories", status: "ok" }),
  makeTrace({ id: "github-bot:d", source: "github-bot", agent: "pitch", title: "Read Patch's notes", status: "stopped" }),
];
const ids = (list: typeof traces) => list.map((trace) => trace.id);

describe("filtersFromParams and paramsFromFilters", () => {
  it("reads lists, trims the search, and drops what it does not know", () => {
    const params = new URLSearchParams("source=sayso,excel,flowboard&status=failed,nonsense&agent=patch&q=%20seat%20");
    expect(filtersFromParams(params)).toEqual({ sources: ["sayso", "flowboard"], agents: ["patch"], statuses: ["failed"], q: "seat" });
  });

  it("reads an empty address as no filters", () => {
    expect(filtersFromParams(new URLSearchParams(""))).toEqual(NO_FILTERS);
    expect(hasFilters(NO_FILTERS)).toBe(false);
  });

  it("writes only the filters that are on, and reads back what it wrote", () => {
    const filters = { sources: ["sayso" as const, "github-bot" as const], agents: [], statuses: ["failed" as const], q: "heat check" };
    const text = paramsFromFilters(filters).toString();
    expect(text).toBe("source=sayso%2Cgithub-bot&status=failed&q=heat+check");
    expect(filtersFromParams(new URLSearchParams(text))).toEqual(filters);
    expect(paramsFromFilters(NO_FILTERS).toString()).toBe("");
    expect(hasFilters(filters)).toBe(true);
  });
});

describe("applyFilters", () => {
  it("passes everything when nothing is on", () => {
    expect(applyFilters(traces, NO_FILTERS)).toHaveLength(4);
  });

  it("takes any of the choices within one filter, and all of the filters together", () => {
    expect(ids(applyFilters(traces, { ...NO_FILTERS, sources: ["sayso", "flowboard"] }))).toEqual(["sayso:a", "flowboard:b"]);
    expect(ids(applyFilters(traces, { ...NO_FILTERS, sources: ["github-bot"], statuses: ["stopped"] }))).toEqual(["github-bot:d"]);
    expect(ids(applyFilters(traces, { ...NO_FILTERS, agents: ["patch"] }))).toEqual(["github-bot:c"]);
  });

  it("finds every word of a search in the title, summary, agent or id, whatever the case", () => {
    expect(ids(applyFilters(traces, { ...NO_FILTERS, q: "WINDOW seat" }))).toEqual(["sayso:a"]);
    expect(ids(applyFilters(traces, { ...NO_FILTERS, q: "weather" }))).toEqual(["flowboard:b"]);
    expect(ids(applyFilters(traces, { ...NO_FILTERS, q: "pitch notes" }))).toEqual(["github-bot:d"]);
    expect(ids(applyFilters(traces, { ...NO_FILTERS, q: "github-bot:c" }))).toEqual(["github-bot:c"]);
    expect(applyFilters(traces, { ...NO_FILTERS, q: "window weather" })).toEqual([]);
  });
});

describe("toggled", () => {
  it("adds a choice that is not there and removes one that is", () => {
    expect(toggled(["a"], "b")).toEqual(["a", "b"]);
    expect(toggled(["a", "b"], "a")).toEqual(["b"]);
  });
});
