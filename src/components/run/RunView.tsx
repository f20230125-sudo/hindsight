"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useNow } from "@/components/useNow";
import { SourceChip, StatusBadge, Tag } from "@/components/Chips";
import { StatTile } from "@/components/StatTile";
import { Legend } from "@/components/timeline/Legend";
import { SpanDetail } from "@/components/timeline/SpanDetail";
import { Timeline } from "@/components/timeline/Timeline";
import { useRuns } from "@/store/useRuns";
import { formatDateTime, formatMs, plural } from "@/trace/format";
import { originText } from "@/trace/origin";
import type { Trace } from "@/trace/schema";

function BackLink() {
  return (
    <Link href="/" className="inline-flex items-center gap-1.5 rounded-md text-[13px] text-muted hover:text-fg">
      <ArrowLeft size={14} aria-hidden="true" />
      All runs
    </Link>
  );
}

function Detail({ trace }: { trace: Trace }) {
  const [selected, setSelected] = useState<string[]>([]);
  const now = useNow();
  const { totals } = trace;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <BackLink />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SourceChip source={trace.source} />
          {trace.agent ? <Tag>{trace.agent}</Tag> : null}
          <StatusBadge status={trace.status} />
        </div>
        <h1 className="break-words text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">{trace.title}</h1>
        {trace.summary ? <p className="max-w-[70ch] break-words text-[15px] leading-relaxed text-muted">{trace.summary}</p> : null}
        <p className="text-[13px] text-faint">
          {trace.startedAt ? `Started ${formatDateTime(trace.startedAt)} · ` : ""}
          Took {formatMs(trace.durationMs)} · {originText(trace, now)}
        </p>
      </header>

      <section aria-label="Figures for this run" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Calls" value={String(totals.calls)} note={totals.calls === 0 ? "None made" : "to APIs and models"} />
        <StatTile label="Model calls" value={String(totals.modelCalls)} note={totals.tokens === null ? "Tokens not reported" : `${totals.tokens.toLocaleString("en-GB")} tokens`} />
        <StatTile label="Failed" value={String(totals.failures)} note={totals.failures === 0 ? "Nothing failed" : plural(totals.failures, "call or step") + " failed"} />
        <StatTile label="Calls avoided" value={totals.avoided === null ? "—" : String(totals.avoided)} note={totals.avoided === null ? "Not reported by this app" : "skipped, as nothing had changed"} />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="panel p-4 sm:p-5" aria-labelledby="timeline-heading">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="timeline-heading" className="text-[15px] font-semibold">
              Timeline
            </h2>
            <span className="text-[12px] text-faint">{plural(trace.spans.length, "span")} recorded</span>
          </div>
          <Legend />
          <div className="mt-4">
            <Timeline trace={trace} selected={selected} onSelect={setSelected} />
          </div>
        </section>

        <aside aria-label="Selected span" className="lg:sticky lg:top-20">
          <SpanDetail trace={trace} selected={selected} onSelect={setSelected} />
        </aside>
      </div>
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
        <p role="status" className="text-[15px] text-muted">
          Reading runs…
        </p>
      ) : errors.length > 0 ? (
        <div role="alert" className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[14px]">
          <span>
            {errors[0].what} could not be read: {errors[0].message}
          </span>
          <button type="button" onClick={retry} className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium hover:bg-surface-2">
            Try again
          </button>
        </div>
      ) : (
        <div className="panel px-5 py-6">
          <h1 className="text-[18px] font-semibold">There is no run with this address</h1>
          <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-muted">
            A run sent from another app lives only in the browser it was sent to, so a link to it works there and nowhere else. Runs that are read live, such as the GitHub bot&apos;s, can always be opened by link.
          </p>
        </div>
      )}
    </div>
  );
}
