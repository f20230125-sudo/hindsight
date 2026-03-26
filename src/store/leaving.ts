// Runs that were sent here are saved a moment after they arrive, so a burst of
// them is written once. A page that is closed or reloaded inside that moment
// would lose the last of them. So when the page is being left, or hidden (the
// last chance a phone gives), whatever is waiting is saved at once.

type Listening = Pick<EventTarget, "addEventListener" | "removeEventListener">;
type Document = Listening & { visibilityState: string };

/** Calls `save` as the page is left or hidden. Returns a function that stops. */
export function saveWhenLeaving(page: Listening, document: Document, save: () => void): () => void {
  const onVisibility = () => {
    if (document.visibilityState === "hidden") save();
  };
  page.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    page.removeEventListener("pagehide", save);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
