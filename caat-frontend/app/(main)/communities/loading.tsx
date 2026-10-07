import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

function PostSkeleton() {
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3.5 w-3/5" />
    </div>
  );
}

export default function Loading() {
  return (
    <>
      <PageHeader title="Community Campus" />
      <div className="p-6">
        <div className="max-w-5xl mx-auto flex gap-6 items-start">
          <div className="flex-1 min-w-0 space-y-4">
            {/* Composer */}
            <Skeleton className="h-24 w-full rounded-xl" />
            {/* Search + tabs */}
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-9 w-64 rounded-md" />
            {/* Feed */}
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </div>
          <aside className="w-72 shrink-0 sticky top-6 hidden lg:block space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </aside>
        </div>
      </div>
    </>
  );
}
