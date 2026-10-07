import type { ZodError } from "zod";
import { z } from "zod";
import { adaptDeskRun } from "./agentdesk/adapt";
import { deskRunDetailSchema } from "./agentdesk/schema";
import { adaptFlowboard } from "./flowboard/adapt";
import { flowboardRunSchema } from "./flowboard/schema";
import { adaptSayso } from "./sayso/adapt";
import { saysoRunSchema } from "./sayso/schema";
import { MAX_DEPTH, nestsDeeperThan } from "@/trace/json";
import { SOURCE_LABELS, traceSchema, type Origin, type Trace } from "@/trace/schema";

// Everything that arrives from outside goes through here: a run sent by one of
// the apps from a button, or a file dropped on the Sources page. Nothing is
// trusted. A run is accepted only when it comes from a page that is allowed to
// send it, is not too big, says what format it is in, and fits the shape its
// app is known to write. What comes out is a Trace, or a reason in plain words.

export const ENVELOPE_FORMAT = "hindsight/run";
export const ENVELOPE_VERSION = 1;

/** The most one run may weigh. A long journey is a few hundred kilobytes. */
export const MAX_BYTES = 2_000_000;

/** The apps that send runs. (The GitHub bot is read from its public file, not sent.) */
export const APPS = ["sayso", "flowboard", "agent-desk"] as const;
export type App = (typeof APPS)[number];

/**
 * Pages that may send a run, and which apps each may send as. An app sends as
 * itself and nothing else, so a page cannot pass its runs off as another's.
 */
export const ALLOWED_ORIGINS: Readonly<Record<string, readonly App[]>> = {
  "https://sayso-sigma.vercel.app": ["sayso"],
  "https://flowboard-flax-seven.vercel.app": ["flowboard"],
  "http://localhost:3030": ["sayso"],
  "http://127.0.0.1:3030": ["sayso"],
  "http://localhost:3020": ["flowboard"],
  "http://127.0.0.1:3020": ["flowboard"],
  // Agent Desk runs on its owner's own machine: it has no public address.
  "http://localhost:3010": ["agent-desk"],
  "http://127.0.0.1:3010": ["agent-desk"],
};

export type Received = { ok: true; trace: Trace } | { ok: false; reason: string };

const refuse = (reason: string): Received => ({ ok: false, reason });

const envelopeSchema = z.object({
  format: z.literal(ENVELOPE_FORMAT),
  version: z.number(),
  app: z.string(),
  data: z.unknown(),
});

/** The first thing wrong with some data, said as "where: what". */
function firstProblem(error: ZodError): string {
  const issue = error.issues[0];
  const where = issue.path.length > 0 ? issue.path.join(".") : "the run";
  return `${where}: ${issue.message}`;
}

const isApp = (value: string): value is App => (APPS as readonly string[]).includes(value);

/** Words from outside, short enough to say back. */
const quoted = (text: string) => (text.length > 40 ? `${text.slice(0, 40)}…` : text);

/**
 * Reads an envelope that has already been parsed from JSON. Whatever it is
 * given, it answers with a trace or a reason: it does not throw.
 */
export function readEnvelope(input: unknown, how: Origin["how"], at: string): Received {
  // Measured first, without recursion, so nothing after this can be made to go too deep.
  if (nestsDeeperThan(input, MAX_DEPTH)) {
    return refuse(`This run holds data nested more than ${MAX_DEPTH} levels deep, which no app writes.`);
  }

  const envelope = envelopeSchema.safeParse(input);
  if (!envelope.success) {
    return refuse(`This is not a run written by one of the apps. It should say "format": "${ENVELOPE_FORMAT}", as the "Open in Hindsight" buttons write it.`);
  }
  const { version, app, data } = envelope.data;
  if (version !== ENVELOPE_VERSION) {
    return refuse(`This run is in version ${version} of the format. This Hindsight reads version ${ENVELOPE_VERSION}.`);
  }
  if (!isApp(app)) {
    return refuse(`"${quoted(app)}" is not an app Hindsight reads. It reads ${APPS.map((name) => SOURCE_LABELS[name]).join(", ")}.`);
  }

  const origin: Origin = { how, at };
  try {
    let trace: Trace;
    if (app === "sayso") {
      const run = saysoRunSchema.safeParse(data);
      if (!run.success) return refuse(`This Sayso run is not in the shape Sayso writes. ${firstProblem(run.error)}`);
      trace = adaptSayso(run.data, { origin });
    } else if (app === "flowboard") {
      const run = flowboardRunSchema.safeParse(data);
      if (!run.success) return refuse(`This Flowboard run is not in the shape Flowboard writes. ${firstProblem(run.error)}`);
      trace = adaptFlowboard(run.data, { origin });
    } else {
      const run = deskRunDetailSchema.safeParse(data);
      if (!run.success) return refuse(`This Agent Desk run is not in the shape its run page holds. ${firstProblem(run.error)}`);
      trace = adaptDeskRun(run.data, { source: "agent-desk", origin });
    }

    const checked = traceSchema.safeParse(trace);
    if (!checked.success) return refuse(`This ${SOURCE_LABELS[app]} run was read, but it does not make a timeline Hindsight can draw. ${firstProblem(checked.error)}`);
    return { ok: true, trace: checked.data };
  } catch {
    return refuse(`This ${SOURCE_LABELS[app]} run could not be read.`);
  }
}

/** Reads the text of a file. */
export function readText(text: string, how: Origin["how"], at: string): Received {
  if (text.length > MAX_BYTES) {
    return refuse(`This file is ${(text.length / 1_000_000).toFixed(1)} MB. Hindsight takes runs up to ${MAX_BYTES / 1_000_000} MB.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return refuse("This is not JSON, so it is not a run. Drop the file an app's button wrote.");
  }
  return readEnvelope(parsed, how, at);
}

/** What the page does with a message it receives. */
export type Accepted = { kind: "ignore" } | { kind: "refused"; reason: string } | { kind: "received"; trace: Trace };

type MessageLike = { origin: string; source: unknown; data: unknown };

const looksLikeARun = (data: unknown): data is { format: string; app: string } =>
  typeof data === "object" && data !== null && (data as { format?: unknown }).format === ENVELOPE_FORMAT && typeof (data as { app?: unknown }).app === "string";

/**
 * Decides what to do with a message. `opener` is the page that opened this one;
 * only it is listened to. Anything that is not a run from an allowed page is
 * ignored without a word, so nothing can learn from the answer what is allowed.
 */
export function acceptMessage(event: MessageLike, opener: unknown, at: string): Accepted {
  if (opener === null || opener === undefined || event.source !== opener) return { kind: "ignore" };
  // Only an address written in the list itself counts, not a word every object answers to, such as "constructor".
  if (typeof event.origin !== "string" || !Object.hasOwn(ALLOWED_ORIGINS, event.origin)) return { kind: "ignore" };
  const allowed = ALLOWED_ORIGINS[event.origin];
  if (!looksLikeARun(event.data)) return { kind: "ignore" };

  if (!isApp(event.data.app) || !allowed.includes(event.data.app)) {
    return { kind: "refused", reason: `${event.origin} may send ${allowed.map((name) => SOURCE_LABELS[name]).join(" and ")} runs, not "${quoted(event.data.app)}" runs.` };
  }

  // A message can hold things a file cannot: dates, maps, an object that holds
  // itself. It is written out as JSON and read back, so what is checked and
  // kept is what a file would have held, and its size is the size of that file.
  let plain: unknown;
  try {
    const text = JSON.stringify(event.data);
    if (text.length > MAX_BYTES) return { kind: "refused", reason: `This run is ${(text.length / 1_000_000).toFixed(1)} MB. Hindsight takes runs up to ${MAX_BYTES / 1_000_000} MB.` };
    plain = JSON.parse(text);
  } catch {
    return { kind: "refused", reason: "The run could not be read." };
  }

  const result = readEnvelope(plain, "sent", at);
  return result.ok ? { kind: "received", trace: result.trace } : { kind: "refused", reason: result.reason };
}
