import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 max-w-5xl mx-auto w-full">
      {/* Hero card */}
      <div className="rounded-xl border p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
          <Skeleton className="size-20 rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="w-full md:w-64 flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[180, 160, 220, 200].map((h, i) => (
          <Skeleton key={i} className="rounded-xl" style={{ height: h }} />
        ))}
      </div>
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}
