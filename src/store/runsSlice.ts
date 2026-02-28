import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Trace } from "@/trace/schema";

// The runs that reached Hindsight from outside: sent by one of the apps, or
// dropped as a file. They are kept in the browser. The runs it reads from a
// server live in the query cache (see api.ts) and are not stored here.

/** The most runs kept. Older ones are let go first. */
export const MAX_RECEIVED = 100;

export type RunsState = {
  /** Newest first. */
  received: Trace[];
  /** Whether the saved runs have been read yet. */
  loaded: boolean;
};

const initialState: RunsState = { received: [], loaded: false };

const runsSlice = createSlice({
  name: "runs",
  initialState,
  reducers: {
    /** The saved runs were read. Any that arrived while they were being read are kept, as the newer. */
    receivedLoaded(state, action: PayloadAction<Trace[]>) {
      const newer = new Set(state.received.map((trace) => trace.id));
      state.received = [...state.received, ...action.payload.filter((trace) => !newer.has(trace.id))].slice(0, MAX_RECEIVED);
      state.loaded = true;
    },
    /** A run arrived. One with the same id is replaced. */
    traceReceived(state, action: PayloadAction<Trace>) {
      state.received = [action.payload, ...state.received.filter((trace) => trace.id !== action.payload.id)].slice(0, MAX_RECEIVED);
    },
    traceRemoved(state, action: PayloadAction<string>) {
      state.received = state.received.filter((trace) => trace.id !== action.payload);
    },
    receivedCleared(state) {
      state.received = [];
    },
  },
});

export const runsActions = runsSlice.actions;
export const runsReducer = runsSlice.reducer;
