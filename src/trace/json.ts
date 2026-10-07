import { z } from "zod";

/** Anything that comes through JSON.stringify and JSON.parse unchanged. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export const jsonSchema: z.ZodType<Json> = z.json();

/**
 * How deep data may nest. A real answer from an API nests a handful of levels;
 * everything that walks a run (the checks, the saving, the drawing) goes one
 * call deeper for each level, so data nested without limit could stop them.
 */
export const MAX_DEPTH = 64;

/**
 * Whether data nests more than `limit` levels. It is walked with a list, not by
 * a function calling itself, so data of any depth can be measured safely. Data
 * that holds itself nests without end, and counts as deeper than any limit.
 */
export function nestsDeeperThan(value: unknown, limit: number): boolean {
  const waiting: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  while (waiting.length > 0) {
    const { value: at, depth } = waiting.pop()!;
    if (at === null || typeof at !== "object") continue;
    if (depth >= limit) return true;
    for (const entry of Array.isArray(at) ? at : Object.values(at)) {
      if (entry !== null && typeof entry === "object") waiting.push({ value: entry, depth: depth + 1 });
    }
  }
  return false;
}

/** An object as JSON fields, or no fields at all for anything else. */
export function toRecord(value: unknown): Record<string, Json> {
  const json = toJson(value);
  return json !== null && typeof json === "object" && !Array.isArray(json) ? json : {};
}

/**
 * Make any value safe to keep in a trace: what JSON cannot hold is left out
 * or turned into null, very long text is cut so one huge answer cannot fill
 * the page or the browser's storage, and what is nested too deep is left out.
 */
export function toJson(value: unknown, limit = 4000, depth = 0): Json {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.length > limit ? `${value.slice(0, limit)}…` : value;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "object") return null;
  if (depth >= MAX_DEPTH) return "…";
  if (Array.isArray(value)) return value.slice(0, 200).map((entry) => toJson(entry, limit, depth + 1));
  const out: { [key: string]: Json } = {};
  for (const [key, entry] of Object.entries(value).slice(0, 200)) {
    // A field called "__proto__" would not be kept as a field: it would change what the object inherits from.
    if (key === "__proto__" || entry === undefined || typeof entry === "function") continue;
    out[key] = toJson(entry, limit, depth + 1);
  }
  return out;
}
