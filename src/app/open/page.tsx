import type { Metadata } from "next";
import { OpenView } from "@/components/open/OpenView";

const DESCRIPTION = "The page an app's Open in Hindsight button opens. It takes the one run the app sends and keeps it in this browser; nothing is uploaded.";

export const metadata: Metadata = {
  title: "Open in Hindsight",
  description: DESCRIPTION,
  openGraph: { title: "Open in Hindsight · Hindsight", description: DESCRIPTION, type: "website", siteName: "Hindsight" },
};

export default function OpenPage() {
  return <OpenView />;
}
