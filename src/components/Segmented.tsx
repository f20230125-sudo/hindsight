// A choice between a few things that are all in view: the clock, how a run is
// drawn, what the side panel shows, a chart or its table. The one that is
// chosen is filled with ink. On a phone every option is 44 px high.

type Option<T extends string> = { value: T; label: string; title?: string; className?: string };

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Option<T>[]; onChange: (value: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-control border border-edge bg-paper p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={`h-11 rounded-inner px-3 text-[13px] font-medium transition-colors duration-150 sm:h-7 sm:px-2.5 sm:text-[12.5px] ${
            value === option.value ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
          } ${option.className ?? ""}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
