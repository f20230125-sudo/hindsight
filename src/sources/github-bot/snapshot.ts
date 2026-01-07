import { z } from "zod";
import { deskRunDetailSchema, type DeskRunDetail } from "../agentdesk/schema";

// The GitHub bot's public site is a recording: a scheduled job commits one
// JSON file that holds every page's data, keyed by the address the page
// would have asked for. The runs are in it twice: a list at "/api/runs?...",
// and each run with its events at "/api/runs/<id>".

const snapshotSchema = z.object({ routes: z.record(z.string(), z.unknown()) });
const listSchema = z.object({ runs: z.array(z.object({ run_id: z.string() })) });

/** The runs in a snapshot, with their events. Null when the data is not a snapshot at all. */
export function runsFromSnapshot(data: unknown): DeskRunDetail[] | null {
  const snapshot = snapshotSchema.safeParse(data);
  if (!snapshot.success) return null;
  const { routes } = snapshot.data;

  const listKey = Object.keys(routes).find((key) => key.startsWith("/api/runs?"));
  const list = listSchema.safeParse(listKey ? routes[listKey] : undefined);
  if (!list.success) return null;

  const runs: DeskRunDetail[] = [];
  for (const { run_id } of list.data.runs) {
    const detail = deskRunDetailSchema.safeParse(routes[`/api/runs/${run_id}`]);
    if (detail.success) runs.push(detail.data);
  }
  return runs;
}
