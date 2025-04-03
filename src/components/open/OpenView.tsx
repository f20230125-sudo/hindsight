"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { runsActions } from "@/store/runsSlice";
import { acceptMessage } from "@/sources/receive";
import { SOURCE_LABELS, type SourceName } from "@/trace/schema";

// The page an app's "Open in Hindsight" button opens in a new tab.
//
// It tells the tab that opened it that it is ready (a message with nothing in
// it), and the app answers with the run. The run is checked, kept in this
// browser, and opened. Nothing goes through a server.

/** How long to wait before saying that nothing has come. */
export const SILENCE_MS = 5000;

type State =
  | { kind: "waiting" }
  /** This page was not opened by an app. */
  | { kind: "nobody" }
  /** The tab that opened this page has not sent anything. */
  | { kind: "silent" }
  | { kind: "received"; id: string; title: string; source: SourceName }
  | { kind: "refused"; reason: string };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[60ch] flex-col gap-4 py-10">
      <p className="eyebrow">Open in Hindsight</p>
      {children}
    </div>
  );
}

export function OpenView() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "waiting" });

  useEffect(() => {
    const opener: Window | null = window.opener;

    const onMessage = (event: MessageEvent) => {
      const accepted = acceptMessage({ origin: event.origin, source: event.source, data: event.data }, opener, new Date().toISOString());
      if (accepted.kind === "ignore") return;
      const reply = (message: unknown) => (event.source as Window | null)?.postMessage(message, event.origin);

      if (accepted.kind === "refused") {
        reply({ type: "hindsight:refused", reason: accepted.reason });
        setState({ kind: "refused", reason: accepted.reason });
        return;
      }
      dispatch(runsActions.traceReceived(accepted.trace));
      reply({ type: "hindsight:received", id: accepted.trace.id });
      setState({ kind: "received", id: accepted.trace.id, title: accepted.trace.title, source: accepted.trace.source });
      router.replace(`/runs/${encodeURIComponent(accepted.trace.id)}`);
    };

    window.addEventListener("message", onMessage);
    // Said once the listening has begun, so the answer cannot arrive before anyone is there to hear it.
    opener?.postMessage({ type: "hindsight:ready" }, "*");

    const timers = [
      // State is set from timers and events, never straight from the effect.
      setTimeout(() => {
        if (!opener) setState({ kind: "nobody" });
      }, 0),
      setTimeout(() => setState((current) => (current.kind === "waiting" ? { kind: "silent" } : current)), SILENCE_MS),
    ];
    return () => {
      window.removeEventListener("message", onMessage);
      timers.forEach(clearTimeout);
    };
  }, [dispatch, router]);

  if (state.kind === "received") {
    return (
      <Shell>
        <h1 className="flex items-center gap-2.5 text-[24px] font-semibold tracking-tight">
          <CircleCheck size={22} className="shrink-0 text-ok" aria-hidden="true" />
          Received
        </h1>
        <p role="status" className="text-[15px] leading-relaxed text-muted">
          “{state.title}” from {SOURCE_LABELS[state.source]}. Opening it.
        </p>
        <p className="text-[14px]">
          <Link href={`/runs/${encodeURIComponent(state.id)}`} className="text-accent underline underline-offset-2">
            Open it now
          </Link>
        </p>
      </Shell>
    );
  }

  if (state.kind === "refused") {
    return (
      <Shell>
        <h1 className="flex items-center gap-2.5 text-[24px] font-semibold tracking-tight">
          <CircleAlert size={22} className="shrink-0 text-bad" aria-hidden="true" />
          This run was not taken
        </h1>
        <p role="alert" className="text-[15px] leading-relaxed">
          {state.reason}
        </p>
        <p className="text-[14px] text-muted">
          Nothing was kept. You can also{" "}
          <Link href="/sources" className="text-accent underline underline-offset-2">
            drop the file an app saved
          </Link>{" "}
          on the Sources page.
        </p>
      </Shell>
    );
  }

  if (state.kind === "nobody") {
    return (
      <Shell>
        <h1 className="text-[24px] font-semibold tracking-tight">This page takes a run from an app</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          It is opened by the <span className="font-medium text-fg">Open in Hindsight</span> button in Sayso, Flowboard or Agent Desk, and nothing opened it. Run something in one of them and press the button there.
        </p>
        <p className="text-[14px]">
          <Link href="/sources" className="text-accent underline underline-offset-2">
            How each app is connected
          </Link>
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="flex items-center gap-2.5 text-[24px] font-semibold tracking-tight">
        {state.kind === "waiting" ? <LoaderCircle size={22} className="shrink-0 animate-spin text-muted" aria-hidden="true" /> : null}
        {state.kind === "waiting" ? "Waiting for the run" : "Nothing has come"}
      </h1>
      <p role="status" className="text-[15px] leading-relaxed text-muted">
        {state.kind === "waiting"
          ? "The app that opened this tab is handing the run over."
          : "The app did not send anything. If its tab is still open, press the button there again. Or drop the file it saved on the Sources page."}
      </p>
      {state.kind === "silent" ? (
        <p className="text-[14px]">
          <Link href="/sources" className="text-accent underline underline-offset-2">
            Go to Sources
          </Link>
        </p>
      ) : null}
    </Shell>
  );
}
