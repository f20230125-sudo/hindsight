import { z } from "zod";
import { jsonSchema } from "@/trace/json";

// What Flowboard hands over for the last run of a flow (src/hindsight/export.ts
// in that project): the blocks' names and kinds, how they were joined, and for
// each block that ran, when it began, how long it took, and the data that
// passed through. Never what a block is set up to do.

const stepSchema = z.object({
  id: z.string(),
  status: z.enum(["running", "succeeded", "failed", "skipped", "cancelled"]),
  startedAt: z.number().nullable(),
  ms: z.number().min(0).nullable(),
  input: jsonSchema.nullable().default(null),
  output: jsonSchema.nullable().default(null),
  branch: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
  error: z.object({ code: z.string(), message: z.string() }).nullable().default(null),
  reason: z.string().nullable().default(null),
});

export const flowboardRunSchema = z.object({
  flow: z.object({
    name: z.string().max(200),
    blocks: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() })).max(500),
    connections: z.array(z.object({ from: z.string(), to: z.string(), side: z.string() })).max(2000),
  }),
  run: z.object({
    status: z.enum(["idle", "running", "succeeded", "failed", "stopped"]),
    startedAt: z.number().nullable(),
    ms: z.number().min(0).nullable(),
    steps: z.array(stepSchema).max(500),
  }),
});
export type FlowboardRun = z.infer<typeof flowboardRunSchema>;
export type FlowboardStep = z.infer<typeof stepSchema>;
