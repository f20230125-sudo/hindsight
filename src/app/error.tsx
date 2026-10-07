"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";

/** Shown when a page throws. Runs that were sent here are kept in the browser, so nothing is lost. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">Something went wrong on this page</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted">Runs that were sent here are kept in this browser, so none is lost. Try again to reload the page.</p>
      <button type="button" onClick={() => retry()} className="mt-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg">
        Try again
      </button>
    </div>
  );
}
