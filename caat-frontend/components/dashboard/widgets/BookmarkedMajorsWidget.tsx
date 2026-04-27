"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BookOpen, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/src/lib/supabaseClient";
import type { Major } from "@/types/majors";
import { CATEGORY_COLORS } from "@/constants/majors";

interface BookmarkedMajorRow {
  major_id: string;
  majors: Pick<Major, "id" | "name" | "category"> | null;
}

const DISPLAY_LIMIT = 10;

export function BookmarkedMajorsWidget() {
  const [majors, setMajors] = useState<Pick<Major, "id" | "name" | "category">[]>([]);
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
            .from("user_bookmarked_majors")
            .select("major_id, majors(id, name, category)")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(DISPLAY_LIMIT),
          supabase
            .from("user_bookmarked_majors")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id),
        ]);

        if (dataRes.error) throw dataRes.error;

        const items = ((dataRes.data ?? []) as unknown as BookmarkedMajorRow[])
          .map((r) => r.majors)
          .filter((m): m is Pick<Major, "id" | "name" | "category"> => m !== null);

        setMajors(items);
        setTotalCount(countRes.count ?? items.length);
      } catch {
        toast.error("Failed to load bookmarked majors");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    );
  }

  if (majors.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No bookmarked majors yet.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/majors">Browse Majors</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 h-full min-h-0">
      <ul className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto pr-1">
        {majors.map((major) => (
          <li key={major.id}>
            <Link
              href={`/majors/${major.id}`}
              className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted/50 group transition-colors"
            >
              <span className="text-sm font-medium truncate">{major.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge
                  variant="secondary"
                  className={`text-xs hidden sm:inline-flex ${CATEGORY_COLORS[major.category] ?? ""}`}
                >
                  {major.category}
                </Badge>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/majors"
        className="text-xs text-muted-foreground hover:text-foreground text-center block shrink-0"
      >
        {totalCount > DISPLAY_LIMIT
          ? `+${totalCount - DISPLAY_LIMIT} more · View all majors →`
          : "View all majors →"}
      </Link>
    </div>
  );
}
