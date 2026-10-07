import { z } from "zod";
import { traceSchema, type Trace } from "@/trace/schema";
import type { KeyValueStore } from "./extra";

// Keeping the runs that were sent or dropped here. What comes back out of
// storage is checked before it is used: it may be from an older version of
// the app, or edited by hand. A run that does not fit is dropped, the rest stay.

export const RECEIVED_KEY = "hindsight:received";
const VERSION = 1;

/** What the browser is asked to hold. Browsers allow about 5 MB per site; this leaves room. */
export const MAX_BYTES = 3_000_000;

const savedSchema = z.object({ version: z.literal(VERSION), traces: z.array(z.unknown()) });

export function loadReceived(storage: KeyValueStore | null): Trace[] {
  if (!storage) return [];
  try {
    const saved = savedSchema.safeParse(JSON.parse(storage.getItem(RECEIVED_KEY) ?? "null"));
    if (!saved.success) return [];
    const traces: Trace[] = [];
    for (const entry of saved.data.traces) {
      const trace = traceSchema.safeParse(entry);
      if (trace.success) traces.push(trace.data);
    }
    return traces;
  } catch {
    return [];
  }
}

/** Saves the newest runs that fit. The list is newest first, so the oldest are the ones left out. */
export function saveReceived(storage: KeyValueStore | null, traces: Trace[]): void {
  if (!storage) return;
  try {
    let kept = traces;
    let text = JSON.stringify({ version: VERSION, traces: kept });
    while (text.length > MAX_BYTES && kept.length > 0) {
      kept = kept.slice(0, Math.floor(kept.length * 0.8));
      text = JSON.stringify({ version: VERSION, traces: kept });
    }
    storage.setItem(RECEIVED_KEY, text);
  } catch {
    // Storage may be full or switched off. The page carries on without it.
  }
}

export function forgetReceived(storage: KeyValueStore | null): void {
  try {
    storage?.removeItem(RECEIVED_KEY);
  } catch {
    // Nothing to do: there was nothing we could reach to remove.
  }
}
