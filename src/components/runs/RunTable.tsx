import Link from "next/link";
import { SourceChip, StatusBadge, Tag } from "@/components/Chips";
import { MiniTimeline } from "@/components/run/MiniTimeline";
import { TRACE_STATUS_LABELS } from "@/timeline/look";
import { formatAgo, formatDateTime, formatMs, plural } from "@/trace/format";
import type { Trace } from "@/trace/schema";

/** A run that was not read live says how it got here, so a recording is never taken for a run that just happened. */
const HOW_TAGS = { live: "", sample: "recorded", sent: "sent", file: "file" } as const;

/** The runs, one to a row. The whole row opens the run; the title is the link that carries it. */
export function RunTable({ traces, now }: { traces: Trace[]; now: number }) {
  return (
    <div className="panel overflow-hidden">
      <table className="w-full table-fixed text-left">
        <caption className="sr-only">Runs, newest first</caption>
        <thead>
          <tr className="eyebrow">
            <th scope="col" className="px-4 py-3 font-medium">
              Run
            </th>
            <th scope="col" className="hidden w-[150px] px-3 py-3 font-medium sm:table-cell">
              App
            </th>
            <th scope="col" className="hidden w-[130px] px-3 py-3 font-medium md:table-cell">
              Result
            </th>
            <th scope="col" className="hidden w-[110px] px-3 py-3 font-medium md:table-cell">
              Started
            </th>
            <th scope="col" className="w-[90px] px-3 py-3 text-right font-medium">
              Took
            </th>
            <th scope="col" className="hidden w-[170px] px-4 py-3 font-medium lg:table-cell">
              Shape
            </th>
          </tr>
        </thead>
        <tbody>
          {traces.map((trace) => (
            <tr key={trace.id} className="relative border-t border-line transition-colors focus-within:bg-surface-2 hover:bg-surface-2/70">
              <td className="px-4 py-3 align-top">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link href={`/runs/${encodeURIComponent(trace.id)}`} className="break-words text-[14.5px] font-medium after:absolute after:inset-0 after:content-['']">
                    {trace.title}
                  </Link>
                  {trace.agent ? <Tag>{trace.agent}</Tag> : null}
                  {trace.origin.how !== "live" ? <Tag>{HOW_TAGS[trace.origin.how]}</Tag> : null}
                </div>
                {trace.summary ? <p className="mt-0.5 truncate text-[12.5px] text-muted">{trace.summary}</p> : null}
                {/* On a narrow screen the columns that are hidden are said here. */}
                <p className="mt-1 text-[12px] text-faint md:hidden">
                  {TRACE_STATUS_LABELS[trace.status]} · {formatAgo(trace.startedAt, now)}
                </p>
              </td>
              <td className="hidden px-3 py-3 align-top sm:table-cell">
                <SourceChip source={trace.source} />
              </td>
              <td className="hidden px-3 py-3 align-top md:table-cell">
                <StatusBadge status={trace.status} />
                {trace.totals.failures > 0 ? <p className="mt-0.5 text-[12px] text-faint">{plural(trace.totals.failures, "failed call")}</p> : null}
              </td>
              <td className="hidden px-3 py-3 align-top md:table-cell">
                <time dateTime={trace.startedAt ?? undefined} title={formatDateTime(trace.startedAt)} className="text-[13px] text-muted">
                  {formatAgo(trace.startedAt, now)}
                </time>
              </td>
              <td className="tabular px-3 py-3 text-right align-top text-[13px]">{formatMs(trace.durationMs)}</td>
              <td className="hidden px-4 py-3.5 align-top lg:table-cell">
                <MiniTimeline trace={trace} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
