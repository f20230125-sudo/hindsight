import type { Metadata } from "next";
import { Suspense } from "react";
import { RunView } from "@/components/run/RunView";

export const metadata: Metadata = { title: "One run" };

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
    <Suspense fallback={<p className="text-[14px] text-muted">Reading the run…</p>}>
      <RunView id={decoded} />
    </Suspense>
  );
}
