/** Where the received runs are kept between visits. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Everything from outside that the store uses. Tests pass stand-ins for all of it. */
export type Extra = {
  /** Null on the server, and when the browser has storage switched off. */
  storage: KeyValueStore | null;
  fetch: typeof fetch;
  now: () => Date;
};
