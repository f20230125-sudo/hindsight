import { CircleAlert, CircleCheck, CircleMinus, Clock, LoaderCircle } from "lucide-react";
import { TRACE_STATUS_LABELS } from "@/timeline/look";
import { SOURCE_LABELS, type SourceName, type TraceStatus } from "@/trace/schema";
import { SOURCE_ICONS } from "./timeline/kinds";

/** Which app a run came from: a picture and the name, so neither is the only sign. */
export function SourceChip({ source }: { source: SourceName }) {
  const Icon = SOURCE_ICONS[source];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-semibold text-ink">
      <Icon size={14} className="shrink-0 text-ink-2" aria-hidden="true" />
      {SOURCE_LABELS[source]}
    </span>
  );
}

// A succeeded run is an ink check and the word: green is left to "waiting for a
// person", and red to failure.
const STATUS_LOOK: Record<TraceStatus, { icon: typeof CircleCheck; tone: string }> = {
  ok: { icon: CircleCheck, tone: "text-ink" },
  failed: { icon: CircleAlert, tone: "text-fail" },
  stopped: { icon: CircleMinus, tone: "text-stopped" },
  waiting: { icon: Clock, tone: "text-ink-2" },
  running: { icon: LoaderCircle, tone: "text-ink-2" },
};

/** How a run ended. The word is always there: colour alone never says it. */
export function StatusBadge({ status }: { status: TraceStatus }) {
  const { icon: Icon, tone } = STATUS_LOOK[status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-2">
      <Icon size={14} className={`shrink-0 ${tone}`} aria-hidden="true" />
      {TRACE_STATUS_LABELS[status]}
    </span>
  );
}

/** A small word beside a name, such as the agent's: plain text, not a chip. */
export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="text-[12.5px] font-normal text-ink-3">{children}</span>;
}
