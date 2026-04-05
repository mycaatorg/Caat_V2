"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { Major, FilterView } from "@/types/majors";
import MajorCard from "@/components/majors/major-card";
import MajorFilters from "@/components/majors/major-filters";
import CompareTable from "@/components/majors/compare-table";
import { Button } from "@/components/ui/button";
import * as Dialog from "@radix-ui/react-dialog";
import { supabase } from "@/src/lib/supabaseClient";
import { toast } from "sonner";
import { MAJOR_CATEGORIES } from "@/constants/majors";

const MAX_COMPARE = 3;

const VALID_FILTERS = new Set<string>([
  "All",
  "Bookmarked",
  ...MAJOR_CATEGORIES.filter((c) => c !== "All"),
]);

interface Props {
  majors: Major[];
  initialFilter?: FilterView;
}

export default function MajorsClient({
  majors,
  initialFilter = "All",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const categoryFromUrl = searchParams.get("category") ?? "";
  const qFromUrl = searchParams.get("q") ?? "";
  const filterFromUrl = categoryFromUrl === "Bookmarked"
    ? "Bookmarked"
    : VALID_FILTERS.has(categoryFromUrl)
      ? (categoryFromUrl as FilterView)
      : initialFilter;

  const [selectedFilter, setSelectedFilter] = useState<FilterView>(filterFromUrl);
  const [searchQuery, setSearchQuery] = useState(qFromUrl);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  const pushParams = useCallback(
    (filter: FilterView, q: string) => {
      const params = new URLSearchParams();
      if (filter !== "All") params.set("category", filter);
      if (q.trim()) params.set("q", q.trim());
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname],
  );

  function handleFilterChange(filter: FilterView) {
    setSelectedFilter(filter);
    pushParams(filter, searchQuery);
  }

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    pushParams(selectedFilter, q);
  }

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

  const selectedMajors = useMemo(
    () => compareIds.map((id) => majors.find((m) => m.id === id)).filter(Boolean) as Major[],
    [compareIds, majors]
  );

  function handleToggleSelect(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }

  async function handleToggleBookmark(id: string) {
    if (!userId) {
      toast.error("Sign in to bookmark majors.");
      return;
    }

    const isCurrentlyBookmarked = bookmarkedIds.has(id);

    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlyBookmarked) { next.delete(id); } else { next.add(id); }
      return next;
    });

    try {
      if (isCurrentlyBookmarked) {
        const { error } = await supabase
          .from("user_bookmarked_majors")
          .delete()
          .eq("user_id", userId)
          .eq("major_id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_bookmarked_majors")
          .upsert({ user_id: userId, major_id: id });
        if (error) throw error;
      }
    } catch {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyBookmarked) { next.add(id); } else { next.delete(id); }
        return next;
      });
      toast.error("Failed to update bookmark. Please try again.");
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <MajorFilters
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          selectedFilter={selectedFilter}
          onFilterChange={handleFilterChange}
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

      {compareIds.length >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="flex items-center gap-3 bg-background border rounded-full px-5 py-2.5 shadow-xl pointer-events-auto">
            <span className="text-sm font-medium">
              {compareIds.length} majors selected
            </span>
            <Button size="sm" onClick={() => setIsCompareOpen(true)}>
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

      <Dialog.Root open={isCompareOpen} onOpenChange={setIsCompareOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-5xl max-h-[85vh] overflow-auto rounded-xl shadow-2xl bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <Dialog.Title className="sr-only">Compare Majors</Dialog.Title>
            <CompareTable majors={selectedMajors} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
