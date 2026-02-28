import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { z } from "zod";
import type { Loaded } from "@/sources/loaded";
import { traceSchema } from "@/trace/schema";
import type { Extra } from "./extra";

// The runs that come from a server route. Each route Hindsight reads without
// being sent anything gets one query here. The answer is checked against the
// trace schema, so a route that answers wrongly shows as an error, not as a
// broken page.

export type QueryError = { message: string };

const loadedSchema = z.object({
  traces: z.array(traceSchema),
  how: z.enum(["live", "sample"]),
  at: z.string(),
  note: z.string().nullable(),
});

type Answer = { data: Loaded } | { error: QueryError };

async function read(path: string, extra: Extra, signal: AbortSignal): Promise<Answer> {
  try {
    const response = await extra.fetch(path, { signal });
    if (!response.ok) return { error: { message: `The server answered ${response.status}.` } };
    const loaded = loadedSchema.safeParse(await response.json());
    if (!loaded.success) return { error: { message: "The server's answer was not in the shape Hindsight expects." } };
    return { data: loaded.data };
  } catch (problem) {
    return { error: { message: problem instanceof Error ? problem.message : "The request failed." } };
  }
}

export const api = createApi({
  reducerPath: "api",
  baseQuery: fakeBaseQuery<QueryError>(),
  endpoints: (builder) => ({
    // GET /api/runs/github-bot
    githubBotRuns: builder.query<Loaded, void>({
      queryFn: (_arg, queryApi) => read("/api/runs/github-bot", queryApi.extra as Extra, queryApi.signal),
    }),
    // GET /api/runs/samples
    sampleRuns: builder.query<Loaded, void>({
      queryFn: (_arg, queryApi) => read("/api/runs/samples", queryApi.extra as Extra, queryApi.signal),
    }),
  }),
});

export const { useGithubBotRunsQuery, useSampleRunsQuery } = api;
