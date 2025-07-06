"use client";

import { CircleAlert, CircleCheck, ExternalLink, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SourceChip, Tag } from "@/components/Chips";
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
      className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-dashed px-5 py-8 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
        over ? "border-accent bg-accent-soft" : "border-line-strong bg-surface hover:bg-surface-2"
      }`}
    >
      <Upload size={20} className="text-muted" aria-hidden="true" />
      <span className="text-[15px] font-medium">Drop a run file here, or choose one</span>
      <span className="text-[13px] text-muted">It is read in this browser. Nothing is uploaded.</span>
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
    <div className="flex flex-col gap-10">
      <header className="flex max-w-[70ch] flex-col gap-3">
        <p className="eyebrow">Sources</p>
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight sm:text-[36px]">How each app is connected</h1>
        <p className="text-[15.5px] leading-relaxed text-muted">
          Hindsight reads four apps. One of them it reads on its own. The other three hand a run over when you press a button in them, and until then Hindsight shows runs that were recorded from the real apps.
        </p>
      </header>

      <section aria-label="The apps" className="grid gap-4 md:grid-cols-2">
        {SOURCES.map((source) => {
          const info = APPS[source];
          const way = ways[source];
          const mine = way.sent + way.file;
          return (
            <article key={source} className="panel flex flex-col gap-3 p-5" aria-labelledby={`app-${source}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 id={`app-${source}`} className="sr-only">
                  {SOURCE_LABELS[source]}
                </h2>
                <SourceChip source={source} />
                <span className="text-[12px] text-faint">
                  {way.live > 0 ? `${plural(way.live, "run")}, read live` : null}
                  {way.live === 0 ? `${plural(way.recorded + mine, "run")}` : null}
                </span>
              </div>
              <p className="text-[14px] leading-relaxed text-muted">{info.what}</p>
              <p className="text-[14px] leading-relaxed">
                <span className="eyebrow mr-2">How</span>
                {info.how}
              </p>
              <p className="text-[13px] text-faint">
                {way.recorded > 0 ? `${plural(way.recorded, "recorded run")} until one is sent. ` : null}
                {mine > 0 ? `${mine} sent to this browser.` : null}
                {way.live === 0 && way.recorded === 0 && mine === 0 ? "No runs yet." : null}
              </p>
              <div className="mt-auto flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
                {info.url ? (
                  <a href={info.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-accent underline underline-offset-2">
                    <ExternalLink size={13} aria-hidden="true" />
                    Open {SOURCE_LABELS[source]}
                  </a>
                ) : null}
                <a href={info.repo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-accent underline underline-offset-2">
                  <ExternalLink size={13} aria-hidden="true" />
                  Source code
                </a>
              </div>
            </article>
          );
        })}
      </section>

      <section aria-labelledby="drop-heading" className="flex flex-col gap-4">
        <div className="max-w-[70ch]">
          <h2 id="drop-heading" className="text-[20px] font-semibold tracking-tight">
            Drop a run file
          </h2>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
            When Hindsight is not open, or the browser blocks the new tab, an app saves the run as a file instead. Drop it here and it opens like any other.
          </p>
        </div>
        <Dropzone onFiles={(files) => void takeFiles(files)} />
        <div role="status" aria-live="polite" aria-label="What became of the files" className="flex flex-col gap-2">
          {outcomes.map((outcome, index) => (
            <p key={`${outcome.name}-${index}`} className="panel flex items-start gap-2.5 px-4 py-3 text-[14px]">
              {outcome.ok ? (
                <>
                  <CircleCheck size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
                  <span>
                    <span className="font-medium">{outcome.name}</span> was read.{" "}
                    <Link href={`/runs/${encodeURIComponent(outcome.id)}`} className="text-accent underline underline-offset-2">
                      Open “{outcome.title}”
                    </Link>
                  </span>
                </>
              ) : (
                <>
                  <CircleAlert size={16} className="mt-0.5 shrink-0 text-bad" aria-hidden="true" />
                  <span>
                    <span className="font-medium">{outcome.name}</span> was not taken. {outcome.reason}
                  </span>
                </>
              )}
            </p>
          ))}
        </div>
      </section>

      <section aria-labelledby="sent-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="sent-heading" className="text-[20px] font-semibold tracking-tight">
            Runs sent to this browser
          </h2>
          {received.length > 0 ? (
            <button
              type="button"
              onClick={() => dispatch(runsActions.receivedCleared())}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted hover:bg-surface-2 hover:text-fg"
            >
              <Trash2 size={13} aria-hidden="true" />
              Remove all
            </button>
          ) : null}
        </div>
        {received.length === 0 ? (
          <p className="text-[14px] text-muted">None yet. They stay in this browser and nowhere else.</p>
        ) : (
          <ul className="panel divide-y divide-line">
            {received.map((trace) => (
              <li key={trace.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <SourceChip source={trace.source} />
                <Link href={`/runs/${encodeURIComponent(trace.id)}`} className="min-w-0 flex-1 truncate text-[14px] font-medium hover:underline">
                  {trace.title}
                </Link>
                <Tag>{trace.origin.how}</Tag>
                <span className="text-[12px] text-faint">{formatAgo(trace.origin.at, now)}</span>
                <button
                  type="button"
                  onClick={() => dispatch(runsActions.traceRemoved(trace.id))}
                  aria-label={`Remove “${trace.title}”`}
                  className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="format-heading" className="flex max-w-[78ch] flex-col gap-3">
        <h2 id="format-heading" className="text-[20px] font-semibold tracking-tight">
          What an app sends
        </h2>
        <p className="text-[14.5px] leading-relaxed text-muted">
          One file, in one named and numbered format, so Hindsight can tell what it holds and refuse what it does not know. Each app writes its own <code className="font-mono text-[13px]">data</code>, and Hindsight turns it into a timeline.
        </p>
        <pre className="panel overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed" tabIndex={0} aria-label="The shape of a run file">
{`{
  "format": "${ENVELOPE_FORMAT}",
  "version": ${ENVELOPE_VERSION},
  "app": "sayso" | "flowboard" | "agent-desk",
  "data": { ...what that app records about one run }
}`}
        </pre>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed text-muted">
          <li>
            <span className="font-medium text-fg">Sayso</span> writes one turn: the words, how they were read, the plan, every call with how long it took, and a log of what happened and when.
          </li>
          <li>
            <span className="font-medium text-fg">Flowboard</span> writes the last run of a flow: the blocks&apos; names and kinds, how they were joined, and for each block that ran its times and the data that passed through. Never what a block is set up to do, because that can hold keys.
          </li>
          <li>
            <span className="font-medium text-fg">Agent Desk</span> writes a run and the events logged under it, as its own run page holds them.
          </li>
        </ul>
        <p className="text-[14px] leading-relaxed text-muted">
          A run is taken only if it comes from the app&apos;s own page, is under {MAX_BYTES / 1_000_000} MB, and fits the shape that app writes. Anything else is refused with the reason.
        </p>
      </section>
    </div>
  );
}
