"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Search,
  ChevronDown,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Bookmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ScholarshipCard, {
  Scholarship,
} from "@/components/scholarships/scholarship-card";
import {
  ScholarshipRow,
  deriveDisplayTags,
  formatAmountDisplay,
} from "@/types/scholarships";
import { supabase } from "@/src/lib/supabaseClient";
import { toast } from "sonner";

const ELIGIBILITY_MAP: Record<string, (s: ScholarshipRow) => boolean> = {
  "Merit-Based":   (s) => s.merit_based,
  "Need-Based":    (s) => s.need_based,
  "Full Ride":     (s) => s.funding_type.includes("full_ride"),
  "Undergraduate": (s) => s.study_level.includes("undergraduate"),
  "Postgraduate":  (s) => s.study_level.includes("postgraduate"),
};

const ITEMS_PER_PAGE = 6;

function rowToCard(row: ScholarshipRow): Scholarship {
  return {
    id: row.id,
    university: row.provider_name,
    name: row.title,
    tags: deriveDisplayTags(row),
    amount: formatAmountDisplay(row),
    description: row.description ?? row.eligibility_summary ?? "",
  };
}

function parseArray(val: string | null): string[] {
  if (!val) return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

interface Props {
  scholarships: ScholarshipRow[];
}

export default function ScholarshipsClient({ scholarships }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(sp.get("q") ?? "");
  const [locationQuery, setLocationQuery] = useState(sp.get("location") ?? "");
  const [selectedEligibility, setSelectedEligibility] = useState<string[]>(
    parseArray(sp.get("eligibility")),
  );
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [showBookmarked, setShowBookmarked] = useState(sp.get("bookmarked") === "1");
  const [userId, setUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(Number(sp.get("page")) || 1);

  const pushParams = useCallback(
    (overrides: Record<string, string | null>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (v) { params.set(k, v); } else { params.delete(k); }
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, sp],
  );

  useEffect(() => {
    async function loadBookmarks() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      setUserId(session.user.id);

      const { data } = await supabase
        .from("user_bookmarked_scholarships")
        .select("scholarship_id")
        .eq("user_id", session.user.id);

      if (data) {
        setBookmarkedIds(new Set(data.map((r) => r.scholarship_id as string)));
      }
    }

    loadBookmarks();
  }, []);

  async function handleToggleBookmark(id: string) {
    if (!userId) {
      toast.error("Sign in to bookmark scholarships.");
      return;
    }

    const isBookmarked = bookmarkedIds.has(id);

    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isBookmarked) { next.delete(id); } else { next.add(id); }
      return next;
    });

    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from("user_bookmarked_scholarships")
          .delete()
          .eq("user_id", userId)
          .eq("scholarship_id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_bookmarked_scholarships")
          .upsert({ user_id: userId, scholarship_id: id });
        if (error) throw error;
      }
    } catch {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (isBookmarked) { next.add(id); } else { next.delete(id); }
        return next;
      });
      toast.error("Failed to update bookmark. Please try again.");
    }
  }

  function toggleMultiFilter<T>(
    value: T,
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    paramKey: string,
    current: T[],
  ) {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setter(next);
    setCurrentPage(1);
    pushParams({ [paramKey]: next.length > 0 ? next.join(",") : null });
  }

  function clearAll() {
    setLocationQuery("");
    setSelectedEligibility([]);
    setShowBookmarked(false);
    setSearchQuery("");
    setCurrentPage(1);
    router.replace(pathname, { scroll: false });
  }

  const hasActiveFilters =
    locationQuery.trim().length > 0 ||
    selectedEligibility.length > 0 ||
    showBookmarked ||
    searchQuery.trim().length > 0;

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();

    return scholarships.filter((s) => {
      if (showBookmarked && !bookmarkedIds.has(s.id)) return false;

      if (
        q &&
        !s.title.toLowerCase().includes(q) &&
        !s.provider_name.toLowerCase().includes(q)
      ) {
        return false;
      }

      if (locationQuery.trim()) {
        const lq = locationQuery.trim().toLowerCase();
        const matchesLocation =
          s.country?.toLowerCase().includes(lq) ||
          s.school_name?.toLowerCase().includes(lq) ||
          s.state_region?.toLowerCase().includes(lq);
        if (!matchesLocation) return false;
      }

      if (
        selectedEligibility.length > 0 &&
        !selectedEligibility.every((opt) => ELIGIBILITY_MAP[opt]?.(s))
      ) {
        return false;
      }

      return true;
    });
  }, [scholarships, searchQuery, locationQuery, selectedEligibility, showBookmarked, bookmarkedIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  function goToPage(page: number) {
    const clamped = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clamped);
  }

  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="min-h-screen p-8 pt-4">
      <main className="max-w-5xl mx-auto">

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-4">
            Scholarships
          </h1>

          {/* Search bar */}
          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Search scholarships..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
                pushParams({ q: e.target.value.trim() || null });
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Location */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-1.5 ${locationQuery.trim() ? "border-primary" : ""}`}
                >
                  {locationQuery.trim() ? (
                    <span className="max-w-24 truncate">{locationQuery}</span>
                  ) : (
                    "Location"
                  )}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-8 text-sm"
                    placeholder="e.g. aus, canada, uk..."
                    value={locationQuery}
                    onChange={(e) => {
                      setLocationQuery(e.target.value);
                      setCurrentPage(1);
                      pushParams({ location: e.target.value.trim() || null });
                    }}
                    autoFocus
                  />
                </div>
                {locationQuery.trim() && (
                  <button
                    className="mt-1.5 text-xs text-muted-foreground hover:text-foreground w-full text-right pr-1"
                    onClick={() => {
                      setLocationQuery("");
                      pushParams({ location: null });
                    }}
                  >
                    Clear
                  </button>
                )}
              </PopoverContent>
            </Popover>

            {/* Eligibility */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-1.5 ${selectedEligibility.length > 0 ? "border-primary" : ""}`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 opacity-60" />
                  Eligibility
                  {selectedEligibility.length > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none">
                      {selectedEligibility.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {Object.keys(ELIGIBILITY_MAP).map((opt) => (
                  <DropdownMenuCheckboxItem
                    key={opt}
                    checked={selectedEligibility.includes(opt)}
                    onCheckedChange={() =>
                      toggleMultiFilter(opt, setSelectedEligibility, "eligibility", selectedEligibility)
                    }
                  >
                    {opt}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Bookmarked pill */}
            <Button
              size="sm"
              variant={showBookmarked ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => {
                const next = !showBookmarked;
                setShowBookmarked(next);
                setCurrentPage(1);
                pushParams({ bookmarked: next ? "1" : null });
              }}
            >
              <Bookmark
                className={`h-3.5 w-3.5 ${showBookmarked ? "fill-current" : ""}`}
              />
              Bookmarked
              {bookmarkedIds.size > 0 && (
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 font-medium leading-none ${
                    showBookmarked
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {bookmarkedIds.size}
                </span>
              )}
            </Button>

            {/* Clear all */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={clearAll}
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-6">
          {filtered.length} scholarship{filtered.length !== 1 ? "s" : ""}
          {hasActiveFilters ? " matching your filters" : ""}
        </p>

        {/* Scholarship grid */}
        {paginated.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {paginated.map((row) => (
              <ScholarshipCard
                key={row.id}
                scholarship={rowToCard(row)}
                isBookmarked={bookmarkedIds.has(row.id)}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <p className="text-lg font-medium">No scholarships found</p>
            <p className="text-sm mt-1">
              Try adjusting your search or filters.
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {pageNumbers.map((p, idx) =>
              p === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 text-sm text-muted-foreground select-none"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={p}
                  variant={currentPage === p ? "default" : "outline"}
                  size="icon"
                  onClick={() => goToPage(p as number)}
                  aria-label={`Page ${p}`}
                  aria-current={currentPage === p ? "page" : undefined}
                >
                  {p}
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
