import { CircleAlert, CircleCheck, CircleMinus, Clock, LoaderCircle } from "lucide-react";
import { TRACE_STATUS_LABELS } from "@/timeline/look";
import { SOURCE_LABELS, type SourceName, type TraceStatus } from "@/trace/schema";
import { SOURCE_ICONS } from "./timeline/kinds";

/** Which app a run came from: a picture and the name, so neither is the only sign. */
export function SourceChip({ source }: { source: SourceName }) {
  const Icon = SOURCE_ICONS[source];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-fg">
      <Icon size={14} className="shrink-0 text-muted" aria-hidden="true" />
      {SOURCE_LABELS[source]}
    </span>
  );
}

const STATUS_LOOK: Record<TraceStatus, { icon: typeof CircleCheck; tone: string }> = {
  ok: { icon: CircleCheck, tone: "text-ok" },
  failed: { icon: CircleAlert, tone: "text-bad" },
  stopped: { icon: CircleMinus, tone: "text-warn" },
  waiting: { icon: Clock, tone: "text-muted" },
  running: { icon: LoaderCircle, tone: "text-muted" },
};

/** How a run ended. The word is always there: colour alone never says it. */
export function StatusBadge({ status }: { status: TraceStatus }) {
  const { icon: Icon, tone } = STATUS_LOOK[status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
      <Icon size={14} className={`shrink-0 ${tone}`} aria-hidden="true" />
      {TRACE_STATUS_LABELS[status]}
    </span>
  );
}

/** A small label such as the agent's name. */
export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">{children}</span>;
}
