import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

export default function MainNotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center min-h-[60vh]">
        <Compass className="h-10 w-10 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-semibold">We couldn&apos;t find that page</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          The link may be out of date, or the item may have been removed. Try one
          of these instead.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-1">
          <Button asChild>
            <Link href="/today">Go to Today</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/scholarships">Browse scholarships</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/schools">Browse schools</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
