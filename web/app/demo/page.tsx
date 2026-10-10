import type { Metadata } from "next";
import { withSiteName } from "@/lib/site";
import { DemoEntry } from "@/features/demo/DemoEntry";

export const metadata: Metadata = { title: { absolute: withSiteName("Demo") }, robots: { index: false, follow: false } };

export default function DemoPage() {
  return <DemoEntry />;
}
