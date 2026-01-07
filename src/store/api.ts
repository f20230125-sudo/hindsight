import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { z } from "zod";
import type { Loaded } from "@/sources/loaded";
import { traceSchema } from "@/trace/schema";
import type { Extra } from "./extra";

// The runs that come from a server route. Each app Hindsight reads without
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

export const api = createApi({
  reducerPath: "api",
  baseQuery: fakeBaseQuery<QueryError>(),
  endpoints: (builder) => ({
    // GET /api/runs/github-bot
    githubBotRuns: builder.query<Loaded, void>({
      queryFn: async (_arg, queryApi) => {
        const { fetch } = queryApi.extra as Extra;
        try {
          const response = await fetch("/api/runs/github-bot", { signal: queryApi.signal });
          if (!response.ok) return { error: { message: `The server answered ${response.status}.` } };
          const loaded = loadedSchema.safeParse(await response.json());
          if (!loaded.success) return { error: { message: "The server's answer was not in the shape Hindsight expects." } };
          return { data: loaded.data };
        } catch (problem) {
          return { error: { message: problem instanceof Error ? problem.message : "The request failed." } };
        }
      },
    }),
  }),
});

export const { useGithubBotRunsQuery } = api;
