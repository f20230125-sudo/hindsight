/** One headline figure: a label, the number, and a line of context. */
export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="panel px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 text-[26px] font-semibold leading-none tracking-tight">{value}</div>
      {note ? <div className="mt-2 text-[12px] leading-snug text-faint">{note}</div> : null}
    </div>
  );
}
