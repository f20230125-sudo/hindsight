import type { Trace } from "@/trace/schema";

/** What a route that reads one app's runs answers with. */
export type Loaded = {
  traces: Trace[];
  /** Whether the runs were read just now, or come from a copy recorded earlier. */
  how: "live" | "sample";
  /** When they were read, or recorded. */
  at: string;
  /** Why the recorded copy is being shown, when it is. */
  note: string | null;
};
