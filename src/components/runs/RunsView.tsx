"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { StatTile } from "@/components/StatTile";
import { useNow } from "@/components/useNow";
import { countsOf } from "@/stats/counts";
import { summarise } from "@/stats/summary";
import { waysOf } from "@/stats/ways";
import { useRuns } from "@/store/useRuns";
import { applyFilters, filtersFromParams, hasFilters, paramsFromFilters, type Filters } from "@/trace/filters";
import { formatAgo, formatDate, formatMs, plural } from "@/trace/format";
import { SOURCE_LABELS } from "@/trace/schema";
import { FilterBar } from "./FilterBar";
import { RunTable } from "./RunTable";

const PAGE = 25;

export function RunsView() {
  const { traces, origins, errors, loading, retry } = useRuns();
  const params = useSearchParams();
  const pathname = usePathname();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const [shownCount, setShownCount] = useState(PAGE);
  const now = useNow();

  // The address is rewritten in place: no new history entry for each chip, and no round trip to the server.
  const change = useCallback(
    (next: Filters) => {
      const query = paramsFromFilters(next).toString();
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
      setShownCount(PAGE);
    },
    [pathname],
  );

  const counts = useMemo(() => countsOf(traces), [traces]);
  const ways = useMemo(() => waysOf(traces), [traces]);
  const matching = useMemo(() => applyFilters(traces, filters), [traces, filters]);
  const summary = useMemo(() => summarise(matching), [matching]);
  const visible = matching.slice(0, shownCount);

  return (
    <div className="flex flex-col gap-7">
      <header className="flex max-w-[70ch] flex-col gap-3">
        <p className="eyebrow">Runs</p>
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight sm:text-[36px]">What your agents did, after the fact</h1>
        <p className="text-[15.5px] leading-relaxed text-muted">
          Every run of the apps Hindsight reads, in one list. Open one to see it on a timeline: what was understood, each call, each wait, each check, with the time each took.
        </p>
      </header>

      <section aria-label="Where the runs come from" className="flex flex-col gap-3">
        <ul className="grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
          {origins.map((origin) => {
            const way = ways[origin.source];
            const mine = way.sent + way.file;
            return (
              <li key={origin.source} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-muted">
                <span
                  className={`inline-block h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${way.live > 0 ? "bg-ok" : way.recorded + mine > 0 ? "bg-warn" : "bg-line-strong"}`}
                  aria-hidden="true"
                />
                <span className="font-medium text-fg">{SOURCE_LABELS[origin.source]}</span>
                <span>
                  {way.live > 0 && origin.at ? `${plural(way.live, "run")}, read live ${formatAgo(origin.at, now)}` : null}
                  {way.live === 0 && origin.source === "github-bot" && origin.how === "sample" ? `${plural(way.recorded, "run")} from a recording` : null}
                  {origin.source !== "github-bot" && way.recorded > 0 && origin.at ? `${plural(way.recorded, "recorded run")} (${formatDate(origin.at)})` : null}
                  {mine > 0 ? `${origin.source !== "github-bot" && way.recorded > 0 ? ", " : ""}${mine} sent to you` : null}
                  {way.live + way.recorded + mine === 0 ? (loading ? "reading…" : "no runs yet") : null}
                </span>
              </li>
            );
          })}
        </ul>
        {origins.find((origin) => origin.source === "github-bot")?.note ? (
          <p className="max-w-[80ch] text-[13px] text-muted">{origins.find((origin) => origin.source === "github-bot")?.note}</p>
        ) : null}
        <p className="text-[13px] text-faint">
          Runs of Sayso, Flowboard and Agent Desk are recordings until you send one: press <span className="font-medium text-muted">Open in Hindsight</span> in the app, or see{" "}
          <Link href="/sources" className="text-accent underline underline-offset-2">
            how each app is connected
          </Link>
          .
        </p>
        {errors.map((error) => (
          <div key={error.what} role="alert" className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[14px]">
            <span className="flex items-center gap-2">
              <CircleAlert size={16} className="shrink-0 text-bad" aria-hidden="true" />
              {error.what} could not be read: {error.message}
            </span>
            <button type="button" onClick={retry} className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium hover:bg-surface-2">
              Try again
            </button>
          </div>
        ))}
      </section>

      <section aria-label="Figures for the runs shown" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Runs" value={String(summary.runs)} note={hasFilters(filters) ? `of ${traces.length} in all` : "from every app"} />
        <StatTile
          label="Succeeded"
          value={summary.successRate === null ? "—" : `${Math.round(summary.successRate * 100)}%`}
          note={summary.finished === 0 ? "No run has finished" : `of ${plural(summary.finished, "finished run")}`}
        />
        <StatTile label="Typical length" value={summary.medianMs === null ? "—" : formatMs(summary.medianMs)} note="the middle run" />
        <StatTile label="Slowest tenth" value={summary.slowMs === null ? "—" : formatMs(summary.slowMs)} note="nine in ten are faster" />
        <StatTile label="Used a model" value={String(summary.modelRuns)} note={summary.runs === 0 ? "" : `of ${plural(summary.runs, "run")}`} />
      </section>

      <section aria-label="Runs" className="flex flex-col gap-4">
        <FilterBar filters={filters} counts={counts} onChange={change} />

        {loading && traces.length === 0 ? (
          <p role="status" className="panel px-5 py-8 text-[14px] text-muted">
            Reading the runs…
          </p>
        ) : matching.length === 0 ? (
          <div className="panel px-5 py-8">
            <h2 className="text-[16px] font-semibold">{traces.length === 0 ? "No runs yet" : "No run matches these filters"}</h2>
            <p className="mt-1.5 text-[14px] text-muted">
              {traces.length === 0
                ? "Nothing could be read from the apps, and none has been sent here."
                : "Try fewer filters, or clear them to see every run."}
            </p>
          </div>
        ) : (
          <>
            <RunTable traces={visible} now={now} />
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
              <span>
                Showing {visible.length} of {matching.length}
              </span>
              {visible.length < matching.length ? (
                <button type="button" onClick={() => setShownCount((count) => count + PAGE)} className="rounded-lg border border-line bg-surface px-3 py-1.5 font-medium text-fg hover:bg-surface-2">
                  Show {Math.min(PAGE, matching.length - visible.length)} more
                </button>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
