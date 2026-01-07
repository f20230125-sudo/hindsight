import { Suspense } from "react";
import { RunsView } from "@/components/runs/RunsView";

export default function Home() {
  // The filters live in the address, which a page can only read in the browser.
  return (
    <Suspense fallback={<p className="text-[14px] text-muted">Reading the runs…</p>}>
      <RunsView />
    </Suspense>
  );
}
