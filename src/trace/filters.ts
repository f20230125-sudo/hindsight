import { SOURCES, TRACE_STATUSES, type SourceName, type Trace, type TraceStatus } from "./schema";

// Which runs the list shows. The choice lives in the address, so any view of
// the list is a link: /?source=sayso,flowboard&status=failed&q=seat

export type Filters = {
  sources: SourceName[];
  agents: string[];
  statuses: TraceStatus[];
  /** Words to find in the title, the summary, the agent or the id. */
  q: string;
};

export const NO_FILTERS: Filters = { sources: [], agents: [], statuses: [], q: "" };

type Params = { get(name: string): string | null };

const listOf = (value: string | null): string[] => (value ? value.split(",").map((part) => part.trim()).filter(Boolean) : []);

/** Reads the filters out of an address. What is not recognised is left out, not an error. */
export function filtersFromParams(params: Params): Filters {
  return {
    sources: listOf(params.get("source")).filter((name): name is SourceName => (SOURCES as readonly string[]).includes(name)),
    agents: listOf(params.get("agent")),
    statuses: listOf(params.get("status")).filter((name): name is TraceStatus => (TRACE_STATUSES as readonly string[]).includes(name)),
    q: (params.get("q") ?? "").trim(),
  };
}

/** The address for a set of filters: no parameter at all for a filter that is not used. */
export function paramsFromFilters(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.sources.length > 0) params.set("source", filters.sources.join(","));
  if (filters.agents.length > 0) params.set("agent", filters.agents.join(","));
  if (filters.statuses.length > 0) params.set("status", filters.statuses.join(","));
  if (filters.q.trim() !== "") params.set("q", filters.q.trim());
  return params;
}

export function hasFilters(filters: Filters): boolean {
  return filters.sources.length > 0 || filters.agents.length > 0 || filters.statuses.length > 0 || filters.q !== "";
}

/** Runs that pass every filter that is on. Within one filter, any choice will do. */
export function applyFilters(traces: Trace[], filters: Filters): Trace[] {
  const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
  return traces.filter((trace) => {
    if (filters.sources.length > 0 && !filters.sources.includes(trace.source)) return false;
    if (filters.agents.length > 0 && !(trace.agent !== null && filters.agents.includes(trace.agent))) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(trace.status)) return false;
    if (words.length === 0) return true;
    const haystack = `${trace.title} ${trace.summary ?? ""} ${trace.agent ?? ""} ${trace.id}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** Switch one choice on or off in a list, keeping the others. */
export function toggled<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}
