"use client";

import type { SourceName } from "@/trace/schema";
import { useGithubBotRunsQuery } from "./api";
import { useAppSelector } from "./hooks";
import { selectAllTraces } from "./selectors";

export type Origin = {
  source: SourceName;
  /** Null until the first answer. */
  how: "live" | "sample" | null;
  at: string | null;
  note: string | null;
};

/**
 * Every run the pages can show, and how they were picked up. The pages do not
 * know which runs come from a server and which were sent: they ask here.
 */
export function useRuns() {
  const githubBot = useGithubBotRunsQuery();
  const traces = useAppSelector(selectAllTraces);

  const origins: Origin[] = [
    { source: "github-bot", how: githubBot.data?.how ?? null, at: githubBot.data?.at ?? null, note: githubBot.data?.note ?? null },
  ];
  const errors = githubBot.error ? [{ source: "github-bot" as const, message: githubBot.error.message ?? "The request failed." }] : [];

  return {
    traces,
    origins,
    errors,
    /** Nothing has answered yet. */
    loading: githubBot.isLoading,
    retry: () => void githubBot.refetch(),
  };
}
