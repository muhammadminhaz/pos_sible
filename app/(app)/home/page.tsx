import { Suspense } from "react";
import { Dashboard } from "@/features/reports/Dashboard";

export default function HomePage() {
  return <Suspense><Dashboard /></Suspense>;
}
