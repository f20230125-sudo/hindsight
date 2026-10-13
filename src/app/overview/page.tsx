import type { Metadata } from "next";
import { Suspense } from "react";
import { OverviewView } from "@/components/overview/OverviewView";

const DESCRIPTION =
  "Every run of Sayso, Flowboard, Agent Desk and the GitHub bot added up: where the time went, how the days went, how long runs take, and which steps were slowest.";

export const metadata: Metadata = {
  title: "Overview",
  description: DESCRIPTION,
  openGraph: { title: "Overview · Hindsight", description: DESCRIPTION, type: "website", siteName: "Hindsight" },
};

export default function OverviewPage() {
  // The filters live in the address, which a page can only read in the browser.
  return (
    <Suspense fallback={<p className="py-6 text-[14px] text-ink-2">Reading the runs…</p>}>
      <OverviewView />
    </Suspense>
  );
}
