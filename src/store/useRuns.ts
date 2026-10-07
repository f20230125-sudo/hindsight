"use client";

import type { SourceName } from "@/trace/schema";
import { useGithubBotRunsQuery, useSampleRunsQuery } from "./api";
import { useAppSelector } from "./hooks";
import { selectAllTraces } from "./selectors";

export type Origin = {
  source: SourceName;
  /** Null until the first answer. */
  how: "live" | "sample" | null;
  at: string | null;
  note: string | null;
};

const RECORDED: SourceName[] = ["sayso", "flowboard", "agent-desk"];

/**
 * Every run the pages can show, and how they were picked up. The pages do not
 * know which runs come from a server and which were sent: they ask here.
 */
export function useRuns() {
  const githubBot = useGithubBotRunsQuery();
  const samples = useSampleRunsQuery();
  const traces = useAppSelector(selectAllTraces);

  const origins: Origin[] = [
    { source: "github-bot", how: githubBot.data?.how ?? null, at: githubBot.data?.at ?? null, note: githubBot.data?.note ?? null },
    ...RECORDED.map((source) => ({ source, how: samples.data?.how ?? null, at: samples.data?.at ?? null, note: samples.data?.note ?? null })),
  ];

  const errors = [
    ...(githubBot.error ? [{ what: "The GitHub bot's runs", message: githubBot.error.message ?? "The request failed." }] : []),
    ...(samples.error ? [{ what: "The recorded runs", message: samples.error.message ?? "The request failed." }] : []),
  ];

  return {
    traces,
    origins,
    errors,
    /** Nothing has answered yet. */
    loading: githubBot.isLoading || samples.isLoading,
    retry: () => {
      if (githubBot.error) void githubBot.refetch();
      if (samples.error) void samples.refetch();
    },
  };
}
