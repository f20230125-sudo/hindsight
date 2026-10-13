import Link from "next/link";
import { Duration } from "@/components/Duration";
import { StatusBadge, Tag } from "@/components/Chips";
import { MiniTimeline } from "@/components/run/MiniTimeline";
import { formatAgo, formatDateTime, plural } from "@/trace/format";
import { SOURCE_LABELS, type Trace } from "@/trace/schema";

/** A run that was not read live says how it got here, so a recording is never taken for a run that just happened. */
const HOW_TAGS = { live: "", sample: "recorded", sent: "sent", file: "file" } as const;

const HEAD = "px-3 py-3 text-left text-[12.5px] font-medium text-ink-3";

/**
 * The runs, one to a row, each with its whole shape drawn as a strip. The strip is the widest
 * thing in the row. The whole row opens the run; the title is the link that carries it.
 *
 * Wide, the row is five columns. Narrower than 1024 px, the result, the time since, the
 * length and the strip go under the title, so the strip has the full width.
 */
export function RunTable({ traces, now }: { traces: Trace[]; now: number }) {
  return (
    <div className="sheet overflow-hidden">
      <table className="w-full table-fixed text-left">
        <caption className="sr-only">Runs, newest first</caption>
        <thead>
          <tr>
            {/* With one column, a heading that says "Run" is a row of the screen spent on nothing: it is for screen readers only below 1024 px. */}
            <th scope="col" className={`${HEAD} px-4 max-lg:p-0`}>
              <span className="max-lg:sr-only">Run</span>
            </th>
            <th scope="col" className={`${HEAD} hidden w-[8.5rem] lg:table-cell`}>
              Result
            </th>
            <th scope="col" className={`${HEAD} hidden w-[6.5rem] lg:table-cell`}>
              Started
            </th>
            <th scope="col" className={`${HEAD} hidden w-[41%] lg:table-cell`}>
              Shape, each run to its own length
            </th>
            <th scope="col" className={`${HEAD} hidden w-[5rem] pr-4 text-right lg:table-cell`}>
              Took
            </th>
          </tr>
        </thead>
        <tbody>
          {traces.map((trace) => (
            <tr key={trace.id} className="relative border-t border-rule transition-colors duration-150 focus-within:bg-paper-2 hover:bg-paper-2">
              <td className="px-4 py-3 align-top lg:align-middle">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <Link href={`/runs/${encodeURIComponent(trace.id)}`} className="break-words py-0.5 text-[14.5px] font-semibold after:absolute after:inset-0 after:content-['']">
                    {trace.title}
                  </Link>
                  <Tag>{SOURCE_LABELS[trace.source]}</Tag>
                  {trace.agent ? <Tag>{trace.agent}</Tag> : null}
                  {trace.origin.how !== "live" ? <Tag>{HOW_TAGS[trace.origin.how]}</Tag> : null}
                </div>
                {trace.summary ? <p className="mt-0.5 truncate text-[12.5px] text-ink-2">{trace.summary}</p> : null}
                {/* Narrower than the columns, what they would say is said here, and the strip has the full width. */}
                <div className="mt-2 lg:hidden">
                  <div className="flex items-center justify-between gap-3 text-[12.5px] text-ink-2">
                    <span className="flex items-center">
                      <StatusBadge status={trace.status} />
                      <span>, {formatAgo(trace.startedAt, now)}</span>
                    </span>
                    {trace.totals.failures === 0 ? <span className="text-[14px] font-medium text-ink"><Duration ms={trace.durationMs} /></span> : null}
                  </div>
                  {trace.totals.failures > 0 ? (
                    <div className="mt-0.5 flex items-baseline justify-between gap-3">
                      <span className="text-[12.5px] text-fail">{plural(trace.totals.failures, "failure")}</span>
                      <span className="text-[14px] font-medium">
                        <Duration ms={trace.durationMs} />
                      </span>
                    </div>
                  ) : null}
                  <div className="mt-2">
                    <MiniTimeline trace={trace} />
                  </div>
                </div>
              </td>
              <td className="hidden px-3 py-3 align-middle lg:table-cell">
                <StatusBadge status={trace.status} />
                {/* Calls, steps and checks that failed: not calls alone, so not called that. */}
                {trace.totals.failures > 0 ? <p className="mt-0.5 text-[12.5px] text-fail">{plural(trace.totals.failures, "failure")}</p> : null}
              </td>
              <td className="hidden px-3 py-3 align-middle lg:table-cell">
                <time dateTime={trace.startedAt ?? undefined} title={formatDateTime(trace.startedAt)} className="text-[13px] text-ink-2">
                  {formatAgo(trace.startedAt, now)}
                </time>
              </td>
              <td className="hidden px-3 py-3 align-middle lg:table-cell">
                <MiniTimeline trace={trace} />
              </td>
              <td className="hidden py-3 pl-3 pr-4 text-right align-middle text-[14px] font-medium lg:table-cell">
                <Duration ms={trace.durationMs} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
