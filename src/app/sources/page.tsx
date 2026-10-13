import type { Metadata } from "next";
import { SourcesView } from "@/components/sources/SourcesView";

const DESCRIPTION =
  "How each of the four apps gets its runs to Hindsight: a button in the app, or a file dropped on this page. Runs sent here stay in the browser; nothing is uploaded.";

export const metadata: Metadata = {
  title: "Sources",
  description: DESCRIPTION,
  openGraph: { title: "Sources · Hindsight", description: DESCRIPTION, type: "website", siteName: "Hindsight" },
};

export default function SourcesPage() {
  return <SourcesView />;
}
