import { describe, expect, it, vi } from "vitest";
import { saveWhenLeaving } from "./leaving";

function pages() {
  const page = new EventTarget();
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  return { page, document };
}

describe("saveWhenLeaving", () => {
  it("saves when the page is left", () => {
    const { page, document } = pages();
    const save = vi.fn();
    saveWhenLeaving(page, document, save);
    page.dispatchEvent(new Event("pagehide"));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("saves when the page is hidden, but not when it is shown again", () => {
    const { page, document } = pages();
    const save = vi.fn();
    saveWhenLeaving(page, document, save);

    document.visibilityState = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(save).toHaveBeenCalledTimes(1);

    document.visibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("stops when told to", () => {
    const { page, document } = pages();
    const save = vi.fn();
    const stop = saveWhenLeaving(page, document, save);
    stop();
    page.dispatchEvent(new Event("pagehide"));
    document.visibilityState = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(save).not.toHaveBeenCalled();
  });
});
