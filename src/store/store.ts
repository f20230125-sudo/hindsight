import {
  combineReducers,
  configureStore,
  createListenerMiddleware,
  type ThunkAction,
  type TypedStartListening,
  type UnknownAction,
} from "@reduxjs/toolkit";
import { api } from "./api";
import type { Extra } from "./extra";
import { saveReceived } from "./persist";
import { runsReducer } from "./runsSlice";

const rootReducer = combineReducers({
  runs: runsReducer,
  [api.reducerPath]: api.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export type { Extra };

export const SAVE_DELAY_MS = 250;

/**
 * Build a store. Everything it reaches outside itself for comes in through
 * `extra`, so the app hands it the browser and a test hands it stand-ins.
 */
export function makeStore(extra: Extra) {
  const listeners = createListenerMiddleware({ extra });
  const startListening = listeners.startListening as AppStartListening;

  // Save shortly after the received runs stop changing. Each change cancels
  // the wait of the one before, so a burst leads to one save.
  startListening({
    predicate: (_action, state, previous) => state.runs.loaded && state.runs.received !== previous.runs.received,
    effect: async (_action, listener) => {
      listener.cancelActiveListeners();
      await listener.delay(SAVE_DELAY_MS);
      saveReceived(extra.storage, listener.getState().runs.received);
    },
  });

  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: extra },
        // Runs are large, and checking them for change on every action would be slow for no gain.
        immutableCheck: { ignoredPaths: ["api", "runs.received"] },
        serializableCheck: { ignoredPaths: ["api", "runs.received"] },
      })
        .prepend(listeners.middleware)
        .concat(api.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
export type AppThunk<Result = void> = ThunkAction<Result, RootState, Extra, UnknownAction>;
export type AppStartListening = TypedStartListening<RootState, AppDispatch, Extra>;
