import { loadReceived } from "./persist";
import { runsActions } from "./runsSlice";
import type { AppThunk } from "./store";

/** Read the runs the browser remembers. */
export const start = (): AppThunk => (dispatch, _getState, extra) => {
  dispatch(runsActions.receivedLoaded(loadReceived(extra.storage)));
};
