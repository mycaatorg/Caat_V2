"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { School } from "lucide-react";
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

const DISPLAY_LIMIT = 12;

export function BookmarkedSchoolsWidget() {
  const [schools, setSchools] = useState<BookmarkedSchool[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const [dataRes, countRes] = await Promise.all([
          supabase
            .from("user_bookmarked_schools")
            .select("school_id, schools(id, name, country)")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(DISPLAY_LIMIT),
          supabase
            .from("user_bookmarked_schools")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id),
        ]);

        if (dataRes.error) throw dataRes.error;

        const items = ((dataRes.data ?? []) as unknown as BookmarkRow[])
          .map((r) => r.schools)
          .filter((s): s is BookmarkedSchool => s !== null);

        setSchools(items);
        setTotalCount(countRes.count ?? items.length);
      } catch {
        toast.error("Failed to load bookmarked schools");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-6 w-24 rounded-full" />
        ))}
      </div>
    );
  }

  if (schools.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <School className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No bookmarked schools yet.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/schools">Browse Schools</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 h-full min-h-0">
      <div className="flex flex-wrap gap-1 flex-1 min-h-0 overflow-y-auto pr-1 content-start">
        {schools.map((school) => (
          <Link key={school.id} href={`/schools/${school.id}`}>
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs"
            >
              {school.name}
              {school.country && (
                <span className="ml-1 opacity-60">· {school.country}</span>
              )}
            </Badge>
          </Link>
        ))}
      </div>
      <Link
        href="/schools"
        className="text-xs text-muted-foreground hover:text-foreground text-center block shrink-0"
      >
        {totalCount > DISPLAY_LIMIT
          ? `+${totalCount - DISPLAY_LIMIT} more · View all schools →`
          : "View all schools →"}
      </Link>
    </div>
  );
}
