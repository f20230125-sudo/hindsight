"use client";

import { ChevronDown, CircleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Duration } from "@/components/Duration";
import { KindKey } from "@/components/timeline/Legend";
import { Button } from "@/components/ui";
import { useNow } from "@/components/useNow";
import { countsOf } from "@/stats/counts";
import { summarise, type Summary } from "@/stats/summary";
import { waysOf } from "@/stats/ways";
import { useRuns } from "@/store/useRuns";
import { applyFilters, filtersFromParams, hasFilters, paramsFromFilters, type Filters } from "@/trace/filters";
import { formatAgo, formatDate, plural } from "@/trace/format";
import { SOURCE_LABELS, type SourceName } from "@/trace/schema";
import { FilterBar } from "./FilterBar";
import { RunTable } from "./RunTable";

const PAGE = 25;

/** A figure in a sentence: heavier than the words around it. */
function Num({ children }: { children: React.ReactNode }) {
  return <b className="whitespace-nowrap font-semibold">{children}</b>;
}

/**
 * What the runs shown add up to, as a sentence. Every number is worked out from the runs
 * that are loaded and in view; none is written here.
 */
function Figures({ summary, all, filtered }: { summary: Summary; all: number; filtered: boolean }) {
  return (
    <section aria-label="Figures for the runs shown">
      <p className="max-w-[78ch] text-[15.5px] leading-relaxed">
        <Num>{summary.runs}</Num> {summary.runs === 1 ? "run" : "runs"}
        {filtered ? (
          <>
            {" "}
            of <Num>{all}</Num> in all
          </>
        ) : null}
        .{" "}
        {summary.runs === 0 ? null : summary.successRate === null ? (
          <>No run has finished. </>
        ) : (
          <>
            <Num>{Math.round(summary.successRate * 100)}%</Num> of the <Num>{summary.finished}</Num> that finished succeeded.{" "}
          </>
        )}
        {summary.medianMs === null ? null : (
          <>
            The middle run took{" "}
            <Num>
              <Duration ms={summary.medianMs} />
            </Num>
            {/* A tenth of fewer than ten runs is not something to say. */}
            {summary.slowMs !== null && summary.runs >= 10 ? (
              <>
                ; nine in ten were faster than{" "}
                <Num>
                  <Duration ms={summary.slowMs} />
                </Num>
              </>
            ) : null}
            .{" "}
          </>
        )}
        {summary.runs === 0 ? null : summary.modelRuns === 0 ? (
          <>No run used a model.</>
        ) : (
          <>
            <Num>{summary.modelRuns}</Num> {summary.modelRuns === 1 ? "run" : "runs"} used a model.
          </>
        )}
      </p>
    </section>
  );
}

type Origins = ReturnType<typeof useRuns>["origins"];
type Ways = ReturnType<typeof waysOf>;

/** Where each app's runs come from, one line each, and what is said about recordings. */
function OriginLines({ origins, ways, loading, now, note }: { origins: Origins; ways: Ways; loading: boolean; now: number; note: string | null | undefined }) {
  return (
    <>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
        {origins.map((origin) => {
          const way = ways[origin.source as SourceName];
          const mine = way.sent + way.file;
          return (
            <li key={origin.source}>
              <span className="block text-[14px] font-semibold">{SOURCE_LABELS[origin.source]}</span>
              <span className="block text-[13px] text-ink-2">
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
      {note ? <p className="max-w-[80ch] text-[13px] text-ink-2">{note}</p> : null}
      <p className="max-w-[80ch] text-[13px] text-ink-3">
        Runs of Sayso, Flowboard and Agent Desk are recordings until you send one: press <span className="font-medium text-ink-2">Open in Hindsight</span> in the app, or see{" "}
        <Link href="/sources" className="text-ink underline underline-offset-2">
          how each app is connected
        </Link>
        .
      </p>
    </>
  );
}

export function RunsView() {
  const { traces, origins, errors, loading, retry } = useRuns();
  const params = useSearchParams();
  const pathname = usePathname();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const [shownCount, setShownCount] = useState(PAGE);
  const now = useNow();

  // The address is rewritten in place: no new history entry for each option, and no round trip to the server.
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
  const botNote = origins.find((origin) => origin.source === "github-bot")?.note;
  const lines = <OriginLines origins={origins} ways={ways} loading={loading} now={now} note={botNote} />;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <header className="flex max-w-[64ch] flex-col gap-2.5">
        <h1 className="page-title">What your agents did, after the fact</h1>
        <p className="text-[15.5px] leading-relaxed text-ink-2">
          Every run of the apps Hindsight reads, in one list. Open one to see it on a timeline: what was understood, each call, each wait, each check, with the time each took.
        </p>
      </header>

      <Figures summary={summary} all={traces.length} filtered={hasFilters(filters)} />

      {errors.map((error) => (
        <div key={error.what} role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
          <span className="flex items-center gap-2">
            <CircleAlert size={16} className="shrink-0 text-fail" aria-hidden="true" />
            {error.what} could not be read: {error.message}
          </span>
          <Button onClick={retry}>Try again</Button>
        </div>
      ))}

      {/* Wide, where each run comes from is said in the open. On a phone it is one line to open, so the
          first run is on the first screen; every run still says "recorded" beside its name. */}
      <section aria-label="Where the runs come from" className="hidden flex-col gap-3 lg:flex">
        {lines}
      </section>
      <details className="group lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-ink-2 [&::-webkit-details-marker]:hidden">
          Which runs are recordings, and which are read live
          <ChevronDown size={14} className="shrink-0 transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="flex flex-col gap-3 pb-2 pt-1">{lines}</div>
      </details>

      <section aria-label="Runs" className="flex flex-col gap-4">
        <FilterBar filters={filters} counts={counts} onChange={change} />

        {loading && traces.length === 0 ? (
          <p role="status" className="py-6 text-[14px] text-ink-2">
            Reading the runs…
          </p>
        ) : matching.length === 0 ? (
          <div className="max-w-[64ch] py-6">
            <h2 className="text-[18px] font-semibold">{traces.length === 0 ? "No runs yet" : "No run matches these filters"}</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
              {traces.length === 0
                ? "Nothing could be read from the apps, and none has been sent here."
                : "Try fewer filters, or clear them to see every run."}
            </p>
          </div>
        ) : (
          <>
            {/* What the strips are, above them. The colours are the timeline's, and mean the same. */}
            <div className="-mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
              <span>Each strip is one run, drawn to its own length.</span>
              <KindKey label="What the colours in the strips mean" />
            </div>
            <RunTable traces={visible} now={now} />
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-2">
              <span>
                Showing {visible.length} of {matching.length}
              </span>
              {visible.length < matching.length ? (
                <Button onClick={() => setShownCount((count) => count + PAGE)}>
                  Show {Math.min(PAGE, matching.length - visible.length)} more
                </Button>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
