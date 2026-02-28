import { createSelector } from "@reduxjs/toolkit";
import { mergeTraces } from "@/trace/merge";
import type { Trace } from "@/trace/schema";
import { api } from "./api";
import type { RootState } from "./store";

// What the pages read. Runs come from three places: the GitHub bot's, read
// live; the recorded samples of the other apps; and the ones that were sent or
// dropped here. The pages see one list.

const selectGithubBot = api.endpoints.githubBotRuns.select();
const selectSamples = api.endpoints.sampleRuns.select();

export const selectGithubBotState = (state: RootState) => selectGithubBot(state);
export const selectSamplesState = (state: RootState) => selectSamples(state);

const selectReceived = (state: RootState) => state.runs.received;
const selectGithubBotTraces = (state: RootState): Trace[] => selectGithubBot(state).data?.traces ?? [];
const selectSampleTraces = (state: RootState): Trace[] => selectSamples(state).data?.traces ?? [];

/** Every run known, newest first. */
export const selectAllTraces = createSelector([selectGithubBotTraces, selectSampleTraces, selectReceived], (live, samples, received) =>
  mergeTraces(live, samples, received),
);

export const selectTraceById = (state: RootState, id: string): Trace | undefined => selectAllTraces(state).find((trace) => trace.id === id);
