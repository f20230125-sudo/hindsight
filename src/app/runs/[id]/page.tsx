import type { Metadata } from "next";
import { Suspense } from "react";
import { RunView } from "@/components/run/RunView";

const DESCRIPTION =
  "One run of an app on a timeline: what was understood, each call, each wait for a person, each check, with the time each took, in real time or in agent time.";

export const metadata: Metadata = {
  title: "One run, on a timeline",
  description: DESCRIPTION,
  openGraph: { title: "One run, on a timeline · Hindsight", description: DESCRIPTION, type: "website", siteName: "Hindsight" },
};

export default async function RunPage(props: PageProps<"/runs/[id]">) {
  const { id } = await props.params;
  // The id holds a colon ("github-bot:audit-..."), which arrives percent-encoded.
  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    // Not valid percent-encoding: use it as it came.
  }
  // The view of the run (its clock, its zoom, what is chosen) lives in the address, which is only known in the browser.
  return (
    <Suspense fallback={<p className="py-6 text-[14px] text-ink-2">Reading the run…</p>}>
      <RunView id={decoded} />
    </Suspense>
  );
}
