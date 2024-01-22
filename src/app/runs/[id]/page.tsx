import type { Metadata } from "next";
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
  return <RunView id={decoded} />;
}
