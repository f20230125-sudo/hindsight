import { z } from "zod";
import { jsonSchema } from "@/trace/json";

// What Sayso hands over for one turn of its conversation (src/agent/export.ts
// in that project). Everything not used here is ignored, so a newer Sayso that
// adds a field does not break an older Hindsight.

const stepSchema = z.object({
  id: z.string(),
  kind: z.enum(["say", "set", "tool", "show"]),
  text: z.string().nullable().optional(),
  label: z.string().optional(),
  tool: z.string().optional(),
  widget: z.string().optional(),
  waits: z.boolean().optional(),
  answer: jsonSchema.nullable().optional(),
});

const callSchema = z.object({
  stepId: z.string(),
  tool: z.string(),
  method: z.string(),
  url: z.string(),
  status: z.number(),
  ms: z.number().min(0),
  body: jsonSchema.nullable().default(null),
  result: jsonSchema.nullable().default(null),
  failure: z.object({ code: z.string(), message: z.string() }).nullable().default(null),
});

export const saysoRunSchema = z.object({
  id: z.string().max(200),
  exportedAt: z.string().nullable().default(null),
  words: z.string().max(2000),
  startedAt: z.string().nullable(),
  understanding: z.string(),
  brain: z.enum(["rules", "model"]),
  model: z.string().nullable(),
  understoodMs: z.number().min(0),
  intents: z.array(z.object({ journey: z.string(), details: z.array(z.object({ name: z.string(), value: z.string() })) })).max(20),
  status: z.enum(["running", "waiting", "done", "failed", "stopped"]).nullable(),
  failure: z.object({ stepId: z.string(), code: z.string(), message: z.string() }).nullable().default(null),
  steps: z.array(stepSchema).max(200),
  calls: z.array(callSchema).max(200),
  log: z.array(z.object({ at: z.number(), type: z.string(), stepId: z.string().nullable() })).max(2000),
  marks: z.array(z.object({ words: z.string(), beforeStep: z.string().nullable(), reply: z.string().nullable().default(null), by: z.string().nullable().default(null) })).max(200),
  checks: z.array(z.object({ label: z.string(), pass: z.boolean() })).max(100),
  reply: z.string().nullable(),
  replyBy: z.string().nullable().default(null),
  closing: z.string().nullable(),
});
export type SaysoRun = z.infer<typeof saysoRunSchema>;
export type SaysoStep = z.infer<typeof stepSchema>;
export type SaysoCall = z.infer<typeof callSchema>;
