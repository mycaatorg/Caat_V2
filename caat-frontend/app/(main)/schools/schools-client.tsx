"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Bookmark, School } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/src/lib/supabaseClient";

interface BookmarkedSchool {
  id: number;
  name: string;
  country: string | null;
}

interface BookmarkRow {
  school_id: number;
  schools: BookmarkedSchool | null;
}

export type SchoolFilterView = "All" | "Bookmarked";

// ---------------------------------------------------------------------------
// Filter chip bar — shown at the top of the schools page
// ---------------------------------------------------------------------------
export function SchoolFilterBar({
  activeFilter,
  bookmarkedCount,
}: {
  activeFilter: SchoolFilterView;
  bookmarkedCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setFilter(filter: SchoolFilterView) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "Bookmarked") {
      params.set("filter", "bookmarked");
    } else {
      params.delete("filter");
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => setFilter("All")}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors border
          ${activeFilter === "All"
            ? "bg-foreground text-background border-foreground"
            : "bg-background text-muted-foreground border-border hover:bg-muted"
          }`}
      >
        All
      </button>
      <button
        onClick={() => setFilter("Bookmarked")}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors border
          ${activeFilter === "Bookmarked"
            ? "bg-foreground text-background border-foreground"
            : "bg-background text-muted-foreground border-border hover:bg-muted"
          }`}
      >
        <Bookmark className="h-3.5 w-3.5" />
        Bookmarked
        {bookmarkedCount > 0 && (
          <span className={`ml-0.5 rounded-full px-1.5 py-0 text-xs font-semibold
            ${activeFilter === "Bookmarked" ? "bg-background/20" : "bg-muted-foreground/20"}`}>
            {bookmarkedCount}
          </span>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bookmarked schools list — replaces the server-rendered grid
// ---------------------------------------------------------------------------
export function BookmarkedSchoolsList() {
  const [schools, setSchools] = useState<BookmarkedSchool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_bookmarked_schools")
        .select("school_id, schools(id, name, country)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const items = ((data ?? []) as unknown as BookmarkRow[])
        .map((r) => r.schools)
        .filter((s): s is BookmarkedSchool => s !== null);

      setSchools(items);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (schools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <School className="h-10 w-10 opacity-40" />
        <p className="text-base font-medium">No bookmarked schools yet.</p>
        <p className="text-sm">
          Browse schools and click the bookmark icon on any school to save it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {schools.length} bookmarked school{schools.length !== 1 ? "s" : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {schools.map((school) => (
          <Link key={school.id} href={`/schools/${school.id}`}>
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-sm px-3 py-1.5"
            >
              {school.name}
              {school.country && (
                <span className="ml-1.5 opacity-60">· {school.country}</span>
              )}
            </Badge>
          </Link>
        ))}
      </div>
      <Button asChild variant="ghost" size="sm" className="text-xs mt-2">
        <Link href="/schools">← Back to all schools</Link>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook: load bookmarked count for the filter chip badge
// ---------------------------------------------------------------------------
export function useBookmarkedSchoolCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { count: c } = await supabase
        .from("user_bookmarked_schools")
        .select("school_id", { count: "exact", head: true })
        .eq("user_id", user.id);

      setCount(c ?? 0);
    }
    load();
  }, []);

  return count;
}
