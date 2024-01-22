import { createSelector } from "@reduxjs/toolkit";
import { mergeTraces } from "@/trace/merge";
import type { Trace } from "@/trace/schema";
import { api } from "./api";
import type { RootState } from "./store";

// What the pages read. Runs come from two places: the ones read from a server
// (the query cache) and the ones that were sent or dropped here. The pages see
// one list.

const selectGithubBot = api.endpoints.githubBotRuns.select();

export const selectGithubBotState = (state: RootState) => selectGithubBot(state);

const selectReceived = (state: RootState) => state.runs.received;
const selectGithubBotTraces = (state: RootState): Trace[] => selectGithubBot(state).data?.traces ?? [];

/** Every run known, newest first. */
export const selectAllTraces = createSelector([selectGithubBotTraces, selectReceived], (live, received) => mergeTraces(live, received));

export const selectTraceById = (state: RootState, id: string): Trace | undefined => selectAllTraces(state).find((trace) => trace.id === id);
