import type { Metadata } from "next";
import { Suspense } from "react";
import { OverviewView } from "@/components/overview/OverviewView";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  // The filters live in the address, which a page can only read in the browser.
  return (
    <Suspense fallback={<p className="text-[14px] text-muted">Reading the runs…</p>}>
      <OverviewView />
    </Suspense>
  );
}
