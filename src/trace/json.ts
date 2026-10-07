import { z } from "zod";

/** Anything that comes through JSON.stringify and JSON.parse unchanged. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export const jsonSchema: z.ZodType<Json> = z.json();

/** An object as JSON fields, or no fields at all for anything else. */
export function toRecord(value: unknown): Record<string, Json> {
  const json = toJson(value);
  return json !== null && typeof json === "object" && !Array.isArray(json) ? json : {};
}

/**
 * Make any value safe to keep in a trace: what JSON cannot hold is left out
 * or turned into null, and very long text is cut so one huge answer cannot
 * fill the page or the browser's storage.
 */
export function toJson(value: unknown, limit = 4000): Json {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.length > limit ? `${value.slice(0, limit)}…` : value;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.slice(0, 200).map((entry) => toJson(entry, limit));
  if (typeof value === "object") {
    const out: { [key: string]: Json } = {};
    for (const [key, entry] of Object.entries(value).slice(0, 200)) {
      if (entry !== undefined && typeof entry !== "function") out[key] = toJson(entry, limit);
    }
    return out;
  }
  return null;
}
