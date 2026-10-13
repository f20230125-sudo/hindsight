import { CATEGORY_FILL, CATEGORY_OF } from "@/timeline/look";
import type { Span, Trace } from "@/trace/schema";

// The whole run at a glance, one line in a row of the list: every bar drawn at
// its place along a strip as long as the run, the calls and waits in their
// colours on top of the grey of the app's own steps. The same drawing as the
// timeline: stripes where the times were worked out from the log, a red
// underline where something failed.

function Bar({ span, durationMs, own }: { span: Span; durationMs: number; own: boolean }) {
  const left = durationMs > 0 ? (span.startMs / durationMs) * 100 : 0;
  const width = durationMs > 0 ? (span.durationMs / durationMs) * 100 : 0;
  return (
    <span
      className={`absolute rounded-bar ${CATEGORY_FILL[CATEGORY_OF[span.kind]]} ${own ? "top-2 h-1.5 opacity-60" : "top-[3px] h-4"} ${span.timing === "estimated" && !own ? "hatched" : ""} ${
        span.status === "failed" ? (own ? "shadow-[inset_0_-2px_0_var(--fail)]" : "shadow-[inset_0_-3px_0_var(--fail)]") : ""
      }`}
      style={{ left: `${left}%`, width: `max(${width}%, 3px)` }}
    />
  );
}

export function MiniTimeline({ trace }: { trace: Trace }) {
  const { durationMs } = trace;
  const bars = trace.spans.filter((span) => span.durationMs > 0);
  // Grey first, so the colours are drawn over it.
  const own = bars.filter((span) => CATEGORY_OF[span.kind] === "own");
  const coloured = bars.filter((span) => CATEGORY_OF[span.kind] !== "own");

  return (
    <div data-testid="strip" className="relative h-[22px] w-full" aria-hidden="true">
      <span className="absolute inset-x-0 top-2.5 h-0.5 bg-rule" />
      {own.map((span) => (
        <Bar key={span.id} span={span} durationMs={durationMs} own />
      ))}
      {coloured.map((span) => (
        <Bar key={span.id} span={span} durationMs={durationMs} own={false} />
      ))}
    </div>
  );
}
