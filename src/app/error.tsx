"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { Button } from "@/components/ui";

/** Shown when a page throws. Runs that were sent here are kept in the browser, so nothing is lost. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex max-w-[60ch] flex-col items-start gap-3 py-16">
      <h1 className="page-title">Something went wrong on this page</h1>
      <p className="text-[15px] leading-relaxed text-ink-2">Runs that were sent here are kept in this browser, so none is lost. Try again to reload the page.</p>
      <Button variant="primary" onClick={() => retry()} className="mt-2">
        Try again
      </Button>
    </div>
  );
}
