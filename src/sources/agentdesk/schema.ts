import { z } from "zod";

// What Agent Desk keeps of a run, as its own run page and its public snapshot
// hold it: a summary and the events logged under the run's id. The GitHub bot
// is the same program running on a schedule, so it is the same shape.
//
// Everything is read loosely. These shapes belong to another project, so only
// what Hindsight uses is required.

export const deskEventSchema = z.object({
  id: z.number(),
  ts: z.string(),
  agent: z.string().optional(),
  type: z.string(),
  run_id: z.string().nullable().optional(),
  repo: z.string().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type DeskEvent = z.infer<typeof deskEventSchema>;

export const deskRunSchema = z.object({
  run_id: z.string(),
  agent: z.string(),
  job: z.string().nullable().optional(),
  title: z.string(),
  demo: z.boolean().optional(),
  started_at: z.string(),
  finished_at: z.string().nullable().optional(),
  /** Null while the run is going, or when it was cut off. */
  ok: z.boolean().nullable().optional(),
  text: z.string().nullable().optional(),
  usage: z.record(z.string(), z.number()).default({}),
});
export type DeskRun = z.infer<typeof deskRunSchema>;

export const deskRunDetailSchema = z.object({
  run: deskRunSchema,
  events: z.array(deskEventSchema).max(5000),
});
export type DeskRunDetail = z.infer<typeof deskRunDetailSchema>;
