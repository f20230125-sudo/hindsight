import type { Metadata } from "next";
import { OpenView } from "@/components/open/OpenView";

export const metadata: Metadata = { title: "Open in Hindsight" };

export default function OpenPage() {
  return <OpenView />;
}
