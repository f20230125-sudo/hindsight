import { useState } from "react";

/**
 * The time the page was opened, as milliseconds. "5 min ago" is worked out
 * from it, so every line on the page counts from the same moment and the
 * page does not change under the reader while they look at it.
 */
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}
