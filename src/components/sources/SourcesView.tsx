"use client";

import { CircleAlert, CircleCheck, ExternalLink, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Tag } from "@/components/Chips";
import { SOURCE_ICONS } from "@/components/timeline/kinds";
import { Button } from "@/components/ui";
import { useNow } from "@/components/useNow";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { runsActions } from "@/store/runsSlice";
import { useRuns } from "@/store/useRuns";
import { waysOf } from "@/stats/ways";
import { ENVELOPE_FORMAT, ENVELOPE_VERSION, MAX_BYTES, readText } from "@/sources/receive";
import { formatAgo, plural } from "@/trace/format";
import { SOURCES, SOURCE_LABELS, type SourceName } from "@/trace/schema";

type AppInfo = {
  what: string;
  how: string;
  /** Where it can be tried, when it has an address. */
  url?: string;
  repo: string;
};

const APPS: Record<SourceName, AppInfo> = {
  sayso: {
    what: "A service desk for a made-up airline. Type what you need and the right piece of interface appears: a seat map, a price, a receipt.",
    how: "Ask for something, open “How it worked” beside the reply, and press Open in Hindsight.",
    url: "https://sayso-sigma.vercel.app",
    repo: "https://github.com/f20230125-sudo/sayso",
  },
  flowboard: {
    what: "A visual builder for workflows: blocks joined on a canvas, run in the browser.",
    how: "Run a flow, then press Open in Hindsight in the Run panel under the canvas.",
    url: "https://flowboard-flax-seven.vercel.app",
    repo: "https://github.com/f20230125-sudo/flowboard",
  },
  "agent-desk": {
    what: "Patch and Pitch, two agents that look after a GitHub and a LinkedIn presence. The desk runs on its owner's own machine, so it has no public address.",
    how: "Open a run's page on the desk and press Open in Hindsight.",
    repo: "https://github.com/f20230125-sudo/github-bot",
  },
  "github-bot": {
    what: "The same program as Agent Desk, run on a schedule on GitHub, with a recording of what it did published on the web.",
    how: "Nothing to send. Hindsight reads the file its scheduled job commits, each time you look.",
    url: "https://github-bot-wine.vercel.app",
    repo: "https://github.com/f20230125-sudo/github-bot",
  },
};

type Outcome = { name: string; ok: true; id: string; title: string } | { name: string; ok: false; reason: string };

function Dropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onFiles([...event.dataTransfer.files]);
      }}
      className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-control border border-dashed px-5 py-8 text-center transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
        over ? "border-ink bg-paper-2" : "border-edge bg-paper hover:bg-paper-2"
      }`}
    >
      <Upload size={20} className="text-ink-2" aria-hidden="true" />
      <span className="text-[15px] font-medium">Drop a run file here, or choose one</span>
      <span className="text-[13px] text-ink-2">It is read in this browser. Nothing is uploaded.</span>
      <input
        type="file"
        accept=".json,application/json"
        multiple
        className="sr-only"
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
    </label>
  );
}

/** A block of the page: its name in the label gutter, its content in the track. */
function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-x-8 gap-y-3 lg:grid-cols-[var(--gutter)_minmax(0,1fr)]">
      <h2 id={id} className="text-[18px] font-semibold">
        {title}
      </h2>
      <div className="flex min-w-0 max-w-[78ch] flex-col gap-3">{children}</div>
    </section>
  );
}

const LINK = "inline-flex min-h-7 items-center gap-1.5 text-ink underline underline-offset-2";

function SentRow({ trace, now, onRemove }: { trace: { id: string; title: string; source: SourceName; origin: { how: string; at: string } }; now: number; onRemove: () => void }) {
  const Icon = SOURCE_ICONS[trace.source];
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold">
        <Icon size={14} className="shrink-0 text-ink-2" aria-hidden="true" />
        {SOURCE_LABELS[trace.source]}
      </span>
      <Link href={`/runs/${encodeURIComponent(trace.id)}`} className="min-w-0 flex-1 truncate text-[14px] font-medium hover:underline">
        {trace.title}
      </Link>
      <Tag>{trace.origin.how}</Tag>
      <span className="text-[12.5px] text-ink-3">{formatAgo(trace.origin.at, now)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove “${trace.title}”`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-paper-2 hover:text-ink"
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </li>
  );
}

export function SourcesView() {
  const dispatch = useAppDispatch();
  const { traces } = useRuns();
  const received = useAppSelector((state) => state.runs.received);
  const now = useNow();
  const ways = useMemo(() => waysOf(traces), [traces]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);

  const takeFiles = async (files: File[]) => {
    const at = new Date().toISOString();
    const done: Outcome[] = [];
    for (const file of files.slice(0, 20)) {
      if (file.size > MAX_BYTES) {
        done.push({ name: file.name, ok: false, reason: `This file is ${(file.size / 1_000_000).toFixed(1)} MB. Hindsight takes runs up to ${MAX_BYTES / 1_000_000} MB.` });
        continue;
      }
      let text: string;
      try {
        text = await file.text();
      } catch {
        // A folder dropped by mistake, or a file that was moved or locked before it could be read.
        done.push({ name: file.name, ok: false, reason: "This could not be read as a file." });
        continue;
      }
      const read = readText(text, "file", at);
      if (read.ok) {
        dispatch(runsActions.traceReceived(read.trace));
        done.push({ name: file.name, ok: true, id: read.trace.id, title: read.trace.title });
      } else {
        done.push({ name: file.name, ok: false, reason: read.reason });
      }
    }
    setOutcomes(done);
  };

  return (
    <div className="flex flex-col gap-12">
      <header className="flex max-w-[64ch] flex-col gap-2.5">
        <h1 className="page-title">How each app is connected</h1>
        <p className="text-[15.5px] leading-relaxed text-ink-2">
          Hindsight reads four apps. One of them it reads on its own. The other three hand a run over when you press a button in them, and until then Hindsight shows runs that were recorded from the real apps.
        </p>
      </header>

      {/* Four ruled rows: the app in the gutter, how it is connected in the track. */}
      <section aria-label="The apps" className="border-t border-rule">
        {SOURCES.map((source) => {
          const info = APPS[source];
          const way = ways[source];
          const mine = way.sent + way.file;
          const Icon = SOURCE_ICONS[source];
          return (
            <article key={source} className="grid gap-x-8 gap-y-2 border-b border-rule py-6 lg:grid-cols-[var(--gutter)_minmax(0,1fr)]" aria-labelledby={`app-${source}`}>
              <div>
                <h2 id={`app-${source}`} className="flex items-center gap-2 text-[18px] font-semibold">
                  <Icon size={16} className="shrink-0 text-ink-2" aria-hidden="true" />
                  {SOURCE_LABELS[source]}
                </h2>
                <p className="mt-0.5 text-[13px] text-ink-3">
                  {way.live > 0 ? `${plural(way.live, "run")}, read live` : null}
                  {way.live === 0 ? `${plural(way.recorded + mine, "run")}` : null}
                </p>
              </div>
              <div className="flex max-w-[78ch] flex-col gap-2">
                <p className="text-[14px] leading-relaxed text-ink-2">{info.what}</p>
                <p className="text-[14px] leading-relaxed">
                  <span className="label mr-2">How</span>
                  {info.how}
                </p>
                <p className="text-[13px] text-ink-3">
                  {way.recorded > 0 ? `${plural(way.recorded, "recorded run")} until one is sent. ` : null}
                  {mine > 0 ? `${mine} sent to this browser.` : null}
                  {way.live === 0 && way.recorded === 0 && mine === 0 ? "No runs yet." : null}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
                  {info.url ? (
                    <a href={info.url} target="_blank" rel="noreferrer" className={LINK}>
                      <ExternalLink size={13} aria-hidden="true" />
                      Open {SOURCE_LABELS[source]}
                    </a>
                  ) : null}
                  <a href={info.repo} target="_blank" rel="noreferrer" className={LINK}>
                    <ExternalLink size={13} aria-hidden="true" />
                    Source code
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <Block id="drop-heading" title="Drop a run file">
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          When Hindsight is not open, or the browser blocks the new tab, an app saves the run as a file instead. Drop it here and it opens like any other.
        </p>
        <Dropzone onFiles={(files) => void takeFiles(files)} />
        <div role="status" aria-live="polite" aria-label="What became of the files" className="flex flex-col gap-2">
          {outcomes.map((outcome, index) => (
            <p key={`${outcome.name}-${index}`} className="flex items-start gap-2.5 text-[14px]">
              {outcome.ok ? (
                <>
                  <CircleCheck size={16} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" />
                  <span>
                    <span className="font-medium">{outcome.name}</span> was read.{" "}
                    <Link href={`/runs/${encodeURIComponent(outcome.id)}`} className="text-ink underline underline-offset-2">
                      Open “{outcome.title}”
                    </Link>
                  </span>
                </>
              ) : (
                <>
                  <CircleAlert size={16} className="mt-0.5 shrink-0 text-fail" aria-hidden="true" />
                  <span>
                    <span className="font-medium">{outcome.name}</span> was not taken. {outcome.reason}
                  </span>
                </>
              )}
            </p>
          ))}
        </div>
      </Block>

      <Block id="sent-heading" title="Runs sent to this browser">
        {received.length === 0 ? (
          <p className="text-[14px] text-ink-2">None yet. They stay in this browser and nowhere else.</p>
        ) : (
          <>
            <ul className="sheet divide-y divide-rule">
              {received.map((trace) => (
                <SentRow key={trace.id} trace={trace} now={now} onRemove={() => dispatch(runsActions.traceRemoved(trace.id))} />
              ))}
            </ul>
            <div>
              <Button variant="ghost" onClick={() => dispatch(runsActions.receivedCleared())}>
                <Trash2 size={13} aria-hidden="true" />
                Remove all
              </Button>
            </div>
          </>
        )}
      </Block>

      <Block id="format-heading" title="What an app sends">
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          One file, in one named and numbered format, so Hindsight can tell what it holds and refuse what it does not know. Each app writes its own <code className="font-mono text-[13px]">data</code>, and Hindsight turns it into a timeline.
        </p>
        <pre className="sheet overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed" tabIndex={0} aria-label="The shape of a run file">
{`{
  "format": "${ENVELOPE_FORMAT}",
  "version": ${ENVELOPE_VERSION},
  "app": "sayso" | "flowboard" | "agent-desk",
  "data": { ...what that app records about one run }
}`}
        </pre>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed text-ink-2">
          <li>
            <span className="font-medium text-ink">Sayso</span> writes one turn: the words, how they were read, the plan, every call with how long it took, and a log of what happened and when.
          </li>
          <li>
            <span className="font-medium text-ink">Flowboard</span> writes the last run of a flow: the blocks&apos; names and kinds, how they were joined, and for each block that ran its times and the data that passed through. Never what a block is set up to do, because that can hold keys.
          </li>
          <li>
            <span className="font-medium text-ink">Agent Desk</span> writes a run and the events logged under it, as its own run page holds them.
          </li>
        </ul>
        <p className="text-[14px] leading-relaxed text-ink-2">
          A run is taken only if it comes from the app&apos;s own page, is under {MAX_BYTES / 1_000_000} MB, and fits the shape that app writes. Anything else is refused with the reason.
        </p>
      </Block>
    </div>
  );
}
