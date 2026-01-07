import { CATEGORY_OF } from "@/timeline/look";
import type { Category } from "@/timeline/look";
import type { Trace } from "@/trace/schema";

// The whole run at a glance, small enough for a table row: every bar drawn at
// its place along a strip as long as the run, the calls and waits in their
// colours on top of the grey of the app's own steps.

const FILL: Record<Category, string> = {
  model: "var(--viz-model)",
  call: "var(--viz-call)",
  wait: "var(--viz-wait)",
  own: "var(--viz-own)",
};

export function MiniTimeline({ trace }: { trace: Trace }) {
  const { durationMs } = trace;
  const bars = trace.spans.filter((span) => span.durationMs > 0);
  // Grey first, so the colours are drawn over it.
  const own = bars.filter((span) => CATEGORY_OF[span.kind] === "own");
  const coloured = bars.filter((span) => CATEGORY_OF[span.kind] !== "own");
  const x = (ms: number) => (durationMs > 0 ? (ms / durationMs) * 100 : 0);

  return (
    <svg viewBox="0 0 100 14" preserveAspectRatio="none" className="h-3.5 w-full" aria-hidden="true" focusable="false">
      <rect x="0" y="6" width="100" height="2" rx="1" fill="var(--line)" />
      {own.map((span) => (
        <rect key={span.id} x={x(span.startMs)} y="5" width={Math.max(x(span.durationMs), 1.2)} height="4" rx="1" fill={FILL.own} opacity="0.55" />
      ))}
      {coloured.map((span) => (
        <rect key={span.id} x={x(span.startMs)} y="1" width={Math.max(x(span.durationMs), 1.5)} height="12" rx="1.5" fill={FILL[CATEGORY_OF[span.kind]]} />
      ))}
    </svg>
  );
}
