"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { Major, MajorCategory } from "@/types/majors";
import MajorCard from "@/components/majors/major-card";
import MajorFilters from "@/components/majors/major-filters";
import { Button } from "@/components/ui/button";
import { supabase } from "@/src/lib/supabaseClient";

export type FilterView = MajorCategory | "All" | "Bookmarked";

const MAX_COMPARE = 3;

interface Props {
  majors: Major[];
  initialFilter?: FilterView;
}

export default function MajorsClient({
  majors,
  initialFilter = "All",
}: Props) {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<FilterView>(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  // Load current user and their bookmarks on mount
  useEffect(() => {
    async function loadBookmarks() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      setUserId(session.user.id);

      const { data } = await supabase
        .from("user_bookmarked_majors")
        .select("major_id")
        .eq("user_id", session.user.id);

      if (data) {
        setBookmarkedIds(new Set(data.map((row) => row.major_id)));
      }
    }

    loadBookmarks();
  }, []);

  const filtered = useMemo(() => {
    return majors.filter((m) => {
      if (selectedFilter === "Bookmarked") {
        if (!bookmarkedIds.has(m.id)) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return m.name.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q);
      }
      const matchesCategory = selectedFilter === "All" || m.category === selectedFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        m.name.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [majors, searchQuery, selectedFilter, bookmarkedIds]);

  function handleToggleSelect(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }

  async function handleToggleBookmark(id: string) {
    if (!userId) return;

    const isCurrentlyBookmarked = bookmarkedIds.has(id);

    // Optimistic update
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      isCurrentlyBookmarked ? next.delete(id) : next.add(id);
      return next;
    });

    if (isCurrentlyBookmarked) {
      await supabase
        .from("user_bookmarked_majors")
        .delete()
        .eq("user_id", userId)
        .eq("major_id", id);
    } else {
      await supabase
        .from("user_bookmarked_majors")
        .upsert({ user_id: userId, major_id: id });
    }
  }

  function handleCompare() {
    router.push(`/majors/compare?ids=${compareIds.join(",")}`);
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <MajorFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
          bookmarkedCount={bookmarkedIds.size}
        />

        <p className="text-sm text-muted-foreground mb-6">
          {filtered.length} major{filtered.length !== 1 ? "s" : ""}
          {selectedFilter === "Bookmarked" ? " bookmarked" : ""}
          {selectedFilter !== "All" && selectedFilter !== "Bookmarked"
            ? ` in ${selectedFilter}`
            : ""}
          {searchQuery ? ` matching "${searchQuery}"` : ""}
        </p>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            {selectedFilter === "Bookmarked"
              ? "No bookmarked majors yet. Bookmark a major to see it here."
              : "No majors found. Try adjusting your search or filters."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
            {filtered.map((major) => (
              <MajorCard
                key={major.id}
                major={major}
                isBookmarked={bookmarkedIds.has(major.id)}
                isSelected={compareIds.includes(major.id)}
                canSelect={
                  compareIds.length < MAX_COMPARE ||
                  compareIds.includes(major.id)
                }
                onToggleSelect={handleToggleSelect}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
          </div>
        )}
      </div>

      {/* Compare bar — appears when 2+ majors are selected */}
      {compareIds.length >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="flex items-center gap-3 bg-background border rounded-full px-5 py-2.5 shadow-xl pointer-events-auto">
            <span className="text-sm font-medium">
              {compareIds.length} majors selected
            </span>
            <Button size="sm" onClick={handleCompare}>
              <ArrowLeftRight />
              Compare
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCompareIds([])}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
