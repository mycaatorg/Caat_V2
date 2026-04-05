import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left: prompts list */}
        <div className="space-y-3">
          <Skeleton className="h-7 w-32" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
        {/* Right: editor area */}
        <div className="space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
