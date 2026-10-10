import { Skeleton } from "@/components/ui/skeleton";

/** Shown inside the app shell while any private route streams in: a page title, a KPI row and a table. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
