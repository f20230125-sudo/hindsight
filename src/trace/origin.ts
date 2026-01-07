import { formatAgo, formatDate } from "./format";
import { SOURCE_LABELS, type Trace } from "./schema";

/** How a run reached Hindsight, in a sentence: "Read live from the GitHub bot, 3 min ago". */
export function originText(trace: Trace, now: number): string {
  const app = SOURCE_LABELS[trace.source];
  const { how, at } = trace.origin;
  switch (how) {
    case "live":
      return `Read live from ${app}, ${formatAgo(at, now)}`;
    case "sent":
      return `Sent from ${app}, ${formatAgo(at, now)}`;
    case "file":
      return `Dropped as a file, ${formatAgo(at, now)}`;
    case "sample":
      return `From a copy of ${app}'s runs recorded on ${formatDate(at)}`;
  }
}
