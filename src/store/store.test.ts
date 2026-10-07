import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeSpan, makeTrace } from "@/test/traces";
import { api } from "./api";
import type { Extra, KeyValueStore } from "./extra";
import { MAX_BYTES, RECEIVED_KEY, loadReceived, saveReceived } from "./persist";
import { MAX_RECEIVED, runsActions } from "./runsSlice";
import { selectAllTraces, selectTraceById } from "./selectors";
import { SAVE_DELAY_MS, makeStore } from "./store";
import { start } from "./thunks";

function memoryStorage(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const loaded = (ids: string[]) => ({
  traces: ids.map((id) => makeTrace({ id, source: "github-bot", startedAt: `2026-10-0${ids.indexOf(id) + 1}T10:00:00.000Z`, origin: { how: "live", at: "2026-10-07T10:00:00.000Z" } })),
  how: "live" as const,
  at: "2026-10-07T10:00:00.000Z",
  note: null,
});

function build(over: Partial<Extra> = {}) {
  const extra: Extra = {
    storage: memoryStorage(),
    fetch: async () => new Response(JSON.stringify(loaded(["github-bot:one", "github-bot:two"]))),
    now: () => new Date("2026-10-07T12:00:00.000Z"),
    ...over,
  };
  return { store: makeStore(extra), extra };
}

describe("persisting received runs", () => {
  it("reads back what was saved, and drops a run that no longer fits the schema", () => {
    const storage = memoryStorage();
    saveReceived(storage, [makeTrace({ id: "sayso:a" }), makeTrace({ id: "sayso:b" })]);
    const saved = JSON.parse(storage.data[RECEIVED_KEY]);
    saved.traces.push({ id: "broken" }, "text");
    storage.data[RECEIVED_KEY] = JSON.stringify(saved);
    expect(loadReceived(storage).map((trace) => trace.id)).toEqual(["sayso:a", "sayso:b"]);
  });

  it("starts empty when nothing is saved, when the text is not JSON, or when the version is not known", () => {
    expect(loadReceived(null)).toEqual([]);
    expect(loadReceived(memoryStorage())).toEqual([]);
    expect(loadReceived(memoryStorage({ [RECEIVED_KEY]: "{not json" }))).toEqual([]);
    expect(loadReceived(memoryStorage({ [RECEIVED_KEY]: JSON.stringify({ version: 99, traces: [makeTrace()] }) }))).toEqual([]);
  });

  it("lets the oldest runs go when everything will not fit, keeping the newest", () => {
    const storage = memoryStorage();
    const big = (id: string) => makeTrace({ id, spans: [makeSpan("s", { attributes: { blob: "x".repeat(900_000) } })] });
    saveReceived(storage, [big("newest"), big("middle"), big("old1"), big("old2"), big("old3")]);
    expect(storage.data[RECEIVED_KEY].length).toBeLessThanOrEqual(MAX_BYTES);
    const kept = loadReceived(storage).map((trace) => trace.id);
    expect(kept[0]).toBe("newest");
    expect(kept.length).toBeLessThan(5);
  });

  it("does not throw when storage is full or missing", () => {
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(() => saveReceived(full, [makeTrace()])).not.toThrow();
    expect(() => saveReceived(null, [makeTrace()])).not.toThrow();
  });
});

describe("the store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads the saved runs when it starts", () => {
    const storage = memoryStorage();
    saveReceived(storage, [makeTrace({ id: "sayso:saved" })]);
    const { store } = build({ storage });
    expect(store.getState().runs.loaded).toBe(false);
    store.dispatch(start());
    expect(store.getState().runs.loaded).toBe(true);
    expect(store.getState().runs.received.map((trace) => trace.id)).toEqual(["sayso:saved"]);
  });

  it("saves a received run shortly after, once for a burst of them", async () => {
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    const { store } = build({ storage });
    store.dispatch(start());

    store.dispatch(runsActions.traceReceived(makeTrace({ id: "sayso:1" })));
    store.dispatch(runsActions.traceReceived(makeTrace({ id: "sayso:2" })));
    store.dispatch(runsActions.traceReceived(makeTrace({ id: "sayso:3" })));
    expect(setItem).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(loadReceived(storage).map((trace) => trace.id)).toEqual(["sayso:3", "sayso:2", "sayso:1"]);
  });

  it("replaces a received run that arrives again, keeps at most the newest hundred, and can drop one", () => {
    const { store } = build();
    store.dispatch(runsActions.traceReceived(makeTrace({ id: "sayso:x", title: "first" })));
    store.dispatch(runsActions.traceReceived(makeTrace({ id: "sayso:x", title: "second" })));
    expect(store.getState().runs.received.map((trace) => trace.title)).toEqual(["second"]);

    for (let at = 0; at < MAX_RECEIVED + 20; at += 1) store.dispatch(runsActions.traceReceived(makeTrace({ id: `sayso:${at}` })));
    expect(store.getState().runs.received).toHaveLength(MAX_RECEIVED);
    store.dispatch(runsActions.traceRemoved(`sayso:${MAX_RECEIVED + 19}`));
    expect(store.getState().runs.received).toHaveLength(MAX_RECEIVED - 1);
  });

  it("reads the GitHub bot's runs from the server and shows them with the received ones, newest first", async () => {
    const { store } = build();
    store.dispatch(runsActions.traceReceived(makeTrace({ id: "sayso:mine", startedAt: "2026-10-06T10:00:00.000Z" })));
    await store.dispatch(api.endpoints.githubBotRuns.initiate());

    const state = store.getState();
    expect(selectAllTraces(state).map((trace) => trace.id)).toEqual(["sayso:mine", "github-bot:two", "github-bot:one"]);
    expect(selectTraceById(state, "github-bot:one")?.source).toBe("github-bot");
    expect(selectTraceById(state, "nope")).toBeUndefined();
  });

  it("reports an error when the server answers badly, in the wrong shape, or not at all", async () => {
    const cases: [string, typeof fetch][] = [
      ["The server answered 503.", async () => new Response("down", { status: 503 })],
      ["The server's answer was not in the shape Hindsight expects.", async () => new Response(JSON.stringify({ traces: [{ id: "broken" }] }))],
      [
        "offline",
        async () => {
          throw new TypeError("offline");
        },
      ],
    ];
    for (const [message, fetch] of cases) {
      const { store } = build({ fetch });
      const result = await store.dispatch(api.endpoints.githubBotRuns.initiate());
      expect(result.isError).toBe(true);
      expect(result.error).toEqual({ message });
    }
  });
});
