import { Suspense } from "react";
import { RunsView } from "@/components/runs/RunsView";

export default function Home() {
  // The filters live in the address, which a page can only read in the browser.
  return (
    <Suspense fallback={<p className="py-6 text-[14px] text-ink-2">Reading the runs…</p>}>
      <RunsView />
    </Suspense>
  );
}
