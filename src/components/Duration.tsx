import { formatMs } from "@/trace/format";

/**
 * A length of time in the page's grammar: the number, then a lighter unit, and
 * never a line break between them. The text is exactly what formatMs gives
 * ("1.17 s", "under 1 ms", "1 min 12 s"), so what a screen reader says is the same.
 */
export function Duration({ ms, className = "" }: { ms: number; className?: string }) {
  // The numbers are the odd pieces: "1 min 12 s" splits into "", "1", " min ", "12", " s".
  const pieces = formatMs(ms).split(/(\d+(?:\.\d+)?)/);
  return (
    <span className={`dur ${className}`}>
      {pieces.map((piece, index) =>
        index % 2 === 1 ? (
          <span key={index}>{piece}</span>
        ) : piece === "" ? null : (
          <span key={index} className="dur-unit">
            {piece}
          </span>
        ),
      )}
    </span>
  );
}
