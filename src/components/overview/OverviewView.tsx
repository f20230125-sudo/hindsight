"use client";

import { CircleAlert } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { FilterBar } from "@/components/runs/FilterBar";
import { Button } from "@/components/ui";
import { countsOf } from "@/stats/counts";
import { useRuns } from "@/store/useRuns";
import { applyFilters, filtersFromParams, hasFilters, paramsFromFilters, type Filters } from "@/trace/filters";
import { plural } from "@/trace/format";
import { DurationSpread } from "./DurationSpread";
import { RunsPerDay } from "./RunsPerDay";
import { SlowestList } from "./SlowestList";
import { TimeShare } from "./TimeShare";

// The runs of every app added up. The same filters as the list scope all four
// charts, and the choice lives in the address, so a view of the overview is a link.

export function OverviewView() {
  const { traces, errors, loading, retry } = useRuns();
  const params = useSearchParams();
  const pathname = usePathname();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const counts = useMemo(() => countsOf(traces), [traces]);
  const scoped = useMemo(() => applyFilters(traces, filters), [traces, filters]);

  const change = useCallback(
    (next: Filters) => {
      const query = paramsFromFilters(next).toString();
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [pathname],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex max-w-[64ch] flex-col gap-2.5">
        <h1 className="page-title">Where the time went, across every run</h1>
        <p className="text-[15.5px] leading-relaxed text-ink-2">
          What one run does is on its timeline. Here are all of them added up: how the time was spent, how the days went, how long runs take, and which steps were slowest.
        </p>
      </header>

      {errors.map((error) => (
        <div key={error.what} role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
          <span className="flex items-center gap-2">
            <CircleAlert size={16} className="shrink-0 text-fail" aria-hidden="true" />
            {error.what} could not be read: {error.message}
          </span>
          <Button onClick={retry}>Try again</Button>
        </div>
      ))}

      <section aria-label="Which runs to add up" className="flex flex-col gap-2">
        <FilterBar filters={filters} counts={counts} onChange={change} />
        <p role="status" className="text-[13px] text-ink-2">
          {loading && traces.length === 0
            ? "Reading the runs…"
            : hasFilters(filters)
              ? `Adding up ${plural(scoped.length, "run")} of ${traces.length}.`
              : `Adding up all ${plural(traces.length, "run")}.`}
        </p>
      </section>

      {/* Four plates, each a drawing with its table one switch away. */}
      <div className="mt-4 flex flex-col gap-10">
        <TimeShare traces={scoped} />
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <RunsPerDay traces={scoped} />
          <DurationSpread traces={scoped} />
        </div>
        <SlowestList traces={scoped} />
      </div>
    </div>
  );
}
