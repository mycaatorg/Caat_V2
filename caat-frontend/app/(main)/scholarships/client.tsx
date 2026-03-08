"use client";

import { useState, useMemo, useEffect } from "react";
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAJOR_FIELDS = [
  "Engineering",
  "Business",
  "Natural Sciences",
  "Social Sciences",
  "Arts & Humanities",
  "Health Sciences",
];

const ELIGIBILITY_MAP: Record<string, (s: ScholarshipRow) => boolean> = {
  "Merit-Based":   (s) => s.merit_based,
  "Need-Based":    (s) => s.need_based,
  "Full Ride":     (s) => s.funding_type.includes("full_ride"),
  "Undergraduate": (s) => s.study_level.includes("undergraduate"),
  "Postgraduate":  (s) => s.study_level.includes("postgraduate"),
};

const ITEMS_PER_PAGE = 6;

// ---------------------------------------------------------------------------
// Helper — map a DB row to the flat Scholarship shape the card expects
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface Props {
  scholarships: ScholarshipRow[];
}

export default function ScholarshipsClient({ scholarships }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedEligibility, setSelectedEligibility] = useState<string[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // -------------------------------------------------------------------------
  // Load the logged-in user's existing scholarship bookmarks on mount
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Optimistic bookmark toggle, persisted to Supabase
  // -------------------------------------------------------------------------
  async function handleToggleBookmark(id: string) {
    if (!userId) return;

    const isBookmarked = bookmarkedIds.has(id);

    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      isBookmarked ? next.delete(id) : next.add(id);
      return next;
    });

    if (isBookmarked) {
      await supabase
        .from("user_bookmarked_scholarships")
        .delete()
        .eq("user_id", userId)
        .eq("scholarship_id", id);
    } else {
      await supabase
        .from("user_bookmarked_scholarships")
        .upsert({ user_id: userId, scholarship_id: id });
    }
  }

  // -------------------------------------------------------------------------
  // Filter helpers
  // -------------------------------------------------------------------------
  function toggleMultiFilter<T>(
    value: T,
    setter: React.Dispatch<React.SetStateAction<T[]>>
  ) {
    setter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function clearAll() {
    setLocationQuery("");
    setSelectedFields([]);
    setSelectedEligibility([]);
    setShowBookmarked(false);
    setSearchQuery("");
    setCurrentPage(1);
  }

  const hasActiveFilters =
    locationQuery.trim().length > 0 ||
    selectedFields.length > 0 ||
    selectedEligibility.length > 0 ||
    showBookmarked ||
    searchQuery.trim().length > 0;

  // -------------------------------------------------------------------------
  // Client-side filtering against DB fields
  // -------------------------------------------------------------------------
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();

    return scholarships.filter((s) => {
      // Bookmarked-only view
      if (showBookmarked && !bookmarkedIds.has(s.id)) return false;

      // Search: title or provider_name
      if (
        q &&
        !s.title.toLowerCase().includes(q) &&
        !s.provider_name.toLowerCase().includes(q)
      ) {
        return false;
      }

      // Location: case-insensitive partial match across country, school_name, state_region
      if (locationQuery.trim()) {
        const lq = locationQuery.trim().toLowerCase();
        const matchesLocation =
          s.country?.toLowerCase().includes(lq) ||
          s.school_name?.toLowerCase().includes(lq) ||
          s.state_region?.toLowerCase().includes(lq);
        if (!matchesLocation) return false;
      }

      // Eligibility: all selected criteria must match
      if (
        selectedEligibility.length > 0 &&
        !selectedEligibility.every((opt) => ELIGIBILITY_MAP[opt]?.(s))
      ) {
        return false;
      }

      // Major/Field: placeholder — junction table data not fetched yet
      // selectedFields is intentionally unused until scholarship_majors join is added

      return true;
    });
  }, [scholarships, searchQuery, locationQuery, selectedEligibility, showBookmarked, bookmarkedIds]);

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  function goToPage(page: number) {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
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

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen p-8 pt-4">
      <main className="max-w-5xl mx-auto">

        {/* Page title + filter row */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-4">
            Scholarships
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            {/* Location — free-text search */}
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
                    placeholder="e.g. aus, canada, uk…"
                    value={locationQuery}
                    onChange={(e) => {
                      setLocationQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    autoFocus
                  />
                </div>
                {locationQuery.trim() && (
                  <button
                    className="mt-1.5 text-xs text-muted-foreground hover:text-foreground w-full text-right pr-1"
                    onClick={() => setLocationQuery("")}
                  >
                    Clear
                  </button>
                )}
              </PopoverContent>
            </Popover>

            {/* Major/Field */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-1.5 ${selectedFields.length > 0 ? "border-primary" : ""}`}
                >
                  Major/Field
                  {selectedFields.length > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none">
                      {selectedFields.length}
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {MAJOR_FIELDS.map((field) => (
                  <DropdownMenuCheckboxItem
                    key={field}
                    checked={selectedFields.includes(field)}
                    onCheckedChange={() =>
                      toggleMultiFilter(field, setSelectedFields)
                    }
                  >
                    {field}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

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
                      toggleMultiFilter(opt, setSelectedEligibility)
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
                setShowBookmarked((prev) => !prev);
                setCurrentPage(1);
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
