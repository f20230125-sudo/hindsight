import { CATEGORY_FILL, CATEGORY_LABELS, type Category } from "@/timeline/look";

const ORDER: Category[] = ["model", "call", "wait", "own"];

/** What the colours and marks of a timeline mean. Always shown above one. */
export function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted" aria-label="What the colours mean">
      {ORDER.map((category) => (
        <li key={category} className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-4 rounded-[3px] ${CATEGORY_FILL[category]}`} aria-hidden="true" />
          {CATEGORY_LABELS[category]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="hatched inline-block h-2.5 w-4 rounded-[3px] bg-viz-own" aria-hidden="true" />
        Worked out from the log, not measured
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-4 rounded-[3px] bg-viz-own shadow-[inset_0_-3px_0_var(--bad)]" aria-hidden="true" />
        Failed
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rotate-45 rounded-[2px] bg-fg/70" aria-hidden="true" />
        Something that happened at a moment
      </li>
    </ul>
  );
}
