"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Duration } from "@/components/Duration";
import { Button } from "@/components/ui";
import { useNow } from "@/components/useNow";
import { RunExplorer } from "@/components/timeline/RunExplorer";
import { TRACE_STATUS_LABELS } from "@/timeline/look";
import { useRuns } from "@/store/useRuns";
import { formatDateTime, plural } from "@/trace/format";
import { originText } from "@/trace/origin";
import { SOURCE_LABELS, type Trace } from "@/trace/schema";

function BackLink() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-control pr-2 text-[13.5px] text-ink-2 hover:text-ink sm:min-h-8">
      <ArrowLeft size={14} aria-hidden="true" />
      All runs
    </Link>
  );
}

/** The run in one plain sentence: whose, how it ended, when it began, and how it got here. */
function sentenceOf(trace: Trace, now: number): string {
  const who = `${SOURCE_LABELS[trace.source]}${trace.agent ? `, ${trace.agent}` : ""}.`;
  // Calls, steps and checks that failed: not calls alone, so not called that.
  const ended = `${TRACE_STATUS_LABELS[trace.status]}${trace.totals.failures > 0 ? `, with ${plural(trace.totals.failures, "failure")}` : ""}.`;
  const how = originText(trace, now);
  const where = trace.startedAt ? `Started ${formatDateTime(trace.startedAt)}; ${how.charAt(0).toLowerCase()}${how.slice(1)}.` : `${how}.`;
  return `${who} ${ended} ${where}`;
}

/** What the run held, as a ledger: a name, its figure, and what the figure leaves out. */
function Figures({ trace }: { trace: Trace }) {
  const { totals } = trace;
  const rows = [
    { label: "Calls", value: String(totals.calls), note: totals.calls === 0 ? "None made" : "to APIs and models", failed: false },
    { label: "Model calls", value: String(totals.modelCalls), note: totals.tokens === null ? "Tokens not reported" : `${totals.tokens.toLocaleString("en-GB")} tokens`, failed: false },
    { label: "Failed", value: String(totals.failures), note: totals.failures === 0 ? "Nothing failed" : plural(totals.failures, "call or step") + " failed", failed: totals.failures > 0 },
    {
      label: "Calls avoided",
      value: totals.avoided === null ? "—" : String(totals.avoided),
      note: totals.avoided === null ? "Not reported by this app" : "skipped, as nothing had changed",
      failed: false,
    },
  ];
  return (
    <section aria-label="Figures for this run">
      <dl className="sheet px-4 py-1">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-x-4 border-t border-rule py-2.5 first:border-t-0">
            <dt className="text-[14px] font-medium">{row.label}</dt>
            <dd className={`row-span-2 text-[22px] font-semibold leading-none ${row.failed ? "text-fail" : ""}`}>{row.value}</dd>
            <dd className="col-start-1 text-[12.5px] text-ink-3">{row.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Detail({ trace }: { trace: Trace }) {
  const now = useNow();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <BackLink />
        {/* The length is the biggest thing on the page. On a phone it goes under the title. */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <h1 className="page-title min-w-0 break-words">{trace.title}</h1>
          <p className="shrink-0 whitespace-nowrap text-[40px] font-extralight leading-[0.95] tracking-[-0.025em] sm:text-[64px] [&_.dur-unit]:text-[0.4em] [&_.dur-unit]:font-light">
            <span className="sr-only">Took </span>
            <Duration ms={trace.durationMs} />
          </p>
        </div>
        <p className="max-w-[90ch] break-words text-[15px] leading-relaxed text-ink-2">{sentenceOf(trace, now)}</p>
        {trace.summary ? <p className="max-w-[70ch] break-words text-[14px] leading-relaxed text-ink-2">{trace.summary}</p> : null}
      </header>

      <RunExplorer trace={trace} figures={<Figures trace={trace} />} />
    </div>
  );
}

export function RunView({ id }: { id: string }) {
  const { traces, loading, errors, retry } = useRuns();
  const trace = traces.find((entry) => entry.id === id);

  if (trace) return <Detail key={trace.id} trace={trace} />;

  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      {loading ? (
        <p role="status" className="text-[15px] text-ink-2">
          Reading runs…
        </p>
      ) : errors.length > 0 ? (
        <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
          <span>
            {errors[0].what} could not be read: {errors[0].message}
          </span>
          <Button onClick={retry}>Try again</Button>
        </div>
      ) : (
        <div className="max-w-[64ch]">
          <h1 className="text-[18px] font-semibold">There is no run with this address</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            A run sent from another app lives only in the browser it was sent to, so a link to it works there and nowhere else. Runs that are read live, such as the GitHub bot&apos;s, can always be opened by link.
          </p>
        </div>
      )}
    </div>
  );
}
