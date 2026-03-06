"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { Major, MajorCategory } from "@/types/majors";
import MajorCard from "@/components/majors/major-card";
import MajorFilters from "@/components/majors/major-filters";
import { Button } from "@/components/ui/button";

const MAX_COMPARE = 3;

interface Props {
  majors: Major[];
  // Phase 4: server will pass the user's existing bookmarked IDs
  initialBookmarkedIds?: string[];
}

export default function MajorsClient({
  majors,
  initialBookmarkedIds = [],
}: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    MajorCategory | "All"
  >("All");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  // Phase 4: this will be wired to server actions for persistence
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(
    new Set(initialBookmarkedIds)
  );

  const filtered = useMemo(() => {
    return majors.filter((m) => {
      const matchesCategory =
        selectedCategory === "All" || m.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        m.name.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [majors, searchQuery, selectedCategory]);

  function handleToggleSelect(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }

  function handleToggleBookmark(id: string) {
    // Phase 4: call server action here for persistence
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />

        <p className="text-sm text-muted-foreground mb-6">
          {filtered.length} major{filtered.length !== 1 ? "s" : ""}
          {selectedCategory !== "All" ? ` in ${selectedCategory}` : ""}
          {searchQuery ? ` matching "${searchQuery}"` : ""}
        </p>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No majors found. Try adjusting your search or filters.
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
