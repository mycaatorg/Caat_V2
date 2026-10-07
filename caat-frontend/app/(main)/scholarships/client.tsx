"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Search,
  ChevronDown,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Star,
  CircleDot,
} from "lucide-react";
import dynamic from "next/dynamic";

const MyScholarshipsPanel = dynamic(() => import("./my-scholarships-panel"), {
  ssr: false,
});
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
import type { ProfileRow } from "@/types/profile";
import { matchScholarship } from "@/lib/profile-match";
import {
  FUNDING_MAP,
  LEVEL_MAP,
  CITIZENSHIP_MAP,
  FIELD_PATTERNS,
} from "@/lib/scholarship-filters";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthContext";
import { toast } from "sonner";
import {
  SCHOLARSHIP_STATUS_LABELS,
  type BookmarkTracking,
  type ScholarshipStatus,
} from "@/lib/scholarship-tracking";

type ScholarshipStatusFilter = "all" | "interested" | "applied" | "outcome";
const STATUS_FILTERS: { key: ScholarshipStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "interested", label: "Interested" },
  { key: "applied", label: "Applied" },
  { key: "outcome", label: "Outcome" },
];

// The full universe of Field-of-Study filter labels. The set was previously
// derived from the whole in-memory table; with server-side filtering the table
// is no longer shipped, so we offer every known field label and let the query
// decide what matches.
const FIELD_LABELS = FIELD_PATTERNS.map((p) => p.label);

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
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

interface TrackingSeed {
  scholarship_id: string;
  status: ScholarshipStatus;
  school_id: number | null;
}

interface Props {
  /** One page of scholarships, already filtered, match-sorted and paginated on the server. */
  rows: ScholarshipRow[];
  /** Total number of scholarships matching the current filters (for pagination). */
  totalCount: number;
  currentPage: number;
  itemsPerPage: number;
  profile: ProfileRow | null;
  initialBookmarkedIds: string[];
  initialTracking: TrackingSeed[];
  availableUniversities: string[];
}

export default function ScholarshipsClient({
  rows,
  totalCount,
  currentPage,
  itemsPerPage,
  profile,
  initialBookmarkedIds,
  initialTracking,
  availableUniversities,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [view, setView] = useState<"browse" | "mine">(
    sp.get("view") === "mine" ? "mine" : "browse",
  );

  // Filter state is driven by the URL (the server reads it back to build the
  // query). Text inputs keep local state so typing stays responsive and is
  // debounced into the URL.
  const [searchQuery, setSearchQuery] = useState(sp.get("q") ?? "");
  const [locationQuery, setLocationQuery] = useState(sp.get("location") ?? "");
  const selectedFunding = parseArray(sp.get("funding"));
  const selectedLevels = parseArray(sp.get("level"));
  const selectedCitizenships = parseArray(sp.get("citizenship"));
  const selectedFields = parseArray(sp.get("field"));
  const selectedUniversities = parseArray(sp.get("university"));
  const showBookmarked = sp.get("bookmarked") === "1";
  const showOpenOnly = sp.get("open") === "1";
  const statusFilter: ScholarshipStatusFilter =
    (["interested", "applied", "outcome"] as const).find(
      (s) => s === sp.get("status"),
    ) ?? "all";

  // Bookmark + tracking state seeded from the server so cards render with the
  // right icons/labels on first paint (no per-card fetch). Optimistic toggles
  // mutate it locally; navigation re-seeds it from fresh server props.
  const seededBookmarks = useMemo(
    () => new Set(initialBookmarkedIds),
    [initialBookmarkedIds],
  );
  const seededTracking = useMemo(() => {
    const m = new Map<string, BookmarkTracking>();
    for (const t of initialTracking) {
      m.set(t.scholarship_id, { status: t.status, school_id: t.school_id });
    }
    return m;
  }, [initialTracking]);

  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(seededBookmarks);
  const [tracking, setTracking] = useState<Map<string, BookmarkTracking>>(seededTracking);

  // Re-seed local state when the server sends a fresh snapshot (navigation).
  useEffect(() => {
    setBookmarkedIds(seededBookmarks);
  }, [seededBookmarks]);
  useEffect(() => {
    setTracking(seededTracking);
  }, [seededTracking]);

  const { user } = useAuth();
  const userId = user?.id ?? null;

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  function switchView(next: "browse" | "mine") {
    setView(next);
    const params = new URLSearchParams(sp.toString());
    if (next === "mine") params.set("view", "mine");
    else params.delete("view");
    params.delete("page");
    router.replace(
      `${pathname}${params.toString() ? `?${params.toString()}` : ""}`,
      { scroll: false },
    );
  }

  const pushParams = useCallback(
    (overrides: Record<string, string | null>, opts?: { keepPage?: boolean }) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      if (!opts?.keepPage) params.delete("page");
      router.replace(
        `${pathname}${params.toString() ? `?${params.toString()}` : ""}`,
        { scroll: false },
      );
    },
    [router, pathname, sp],
  );

  // Debounce text-input params so a full server refetch doesn't fire on every
  // keystroke (M2/D6). The controlled input updates immediately; the URL (and
  // thus the query) updates after the user pauses.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedPush = useCallback(
    (key: string, value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        pushParams({ [key]: value.trim() || null });
      }, 300);
    },
    [pushParams],
  );
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  async function handleToggleBookmark(id: string) {
    if (!userId) {
      toast.error("Sign in to bookmark scholarships.");
      return;
    }

    const isBookmarked = bookmarkedIds.has(id);
    const prevTrackingEntry = tracking.get(id);

    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isBookmarked) next.delete(id);
      else next.add(id);
      return next;
    });
    setTracking((prev) => {
      const next = new Map(prev);
      if (isBookmarked) next.delete(id);
      else next.set(id, { status: "interested", school_id: null });
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
      // When the current view is scoped to bookmarks/status, the server-side
      // set changed, so refresh to reflect the new membership across pages.
      if (showBookmarked || statusFilter !== "all") {
        router.refresh();
      }
    } catch {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (isBookmarked) next.add(id);
        else next.delete(id);
        return next;
      });
      setTracking((prev) => {
        const next = new Map(prev);
        if (isBookmarked) {
          if (prevTrackingEntry) next.set(id, prevTrackingEntry);
        } else {
          next.delete(id);
        }
        return next;
      });
      toast.error("Failed to update bookmark. Please try again.");
    }
  }

  function toggleMultiFilter(
    value: string,
    paramKey: string,
    current: string[],
  ) {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    pushParams({ [paramKey]: next.length > 0 ? next.join(",") : null });
  }

  function clearAll() {
    setLocationQuery("");
    setSearchQuery("");
    router.replace(pathname, { scroll: false });
  }

  const hasActiveFilters =
    locationQuery.trim().length > 0 ||
    selectedFunding.length > 0 ||
    selectedLevels.length > 0 ||
    selectedCitizenships.length > 0 ||
    selectedFields.length > 0 ||
    selectedUniversities.length > 0 ||
    showBookmarked ||
    showOpenOnly ||
    statusFilter !== "all" ||
    searchQuery.trim().length > 0;

  function goToPage(page: number) {
    const clamped = Math.max(1, Math.min(page, totalPages));
    pushParams({ page: clamped > 1 ? String(clamped) : null }, { keepPage: true });
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
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        {/* View switcher */}
        <div className="flex items-center border border-foreground/70 mb-6 w-fit">
          <button
            onClick={() => switchView("browse")}
            className={`px-5 py-2 text-[11px] tracking-[0.1em] uppercase font-code transition-colors duration-100 focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-[#9a1a27] focus-visible:outline-offset-[-2px] ${
              view === "browse"
                ? "bg-[#9a1a27] text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => switchView("mine")}
            className={`flex items-center gap-1.5 px-5 py-2 text-[11px] tracking-[0.1em] uppercase font-code border-l border-foreground/70 transition-colors duration-100 focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-[#9a1a27] focus-visible:outline-offset-[-2px] ${
              view === "mine"
                ? "bg-[#9a1a27] text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Star
              className={`h-3 w-3 ${view === "mine" ? "fill-white text-white" : "text-muted-foreground"}`}
            />
            My Scholarships
          </button>
        </div>

        {/* My Scholarships view */}
        {view === "mine" && <MyScholarshipsPanel />}

        {/* Browse view */}
        {view === "browse" && (
          <>
            <div className="mb-6">
              {/* Search bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9"
                  placeholder="Search scholarships..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    debouncedPush("q", e.target.value);
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
                        <span className="max-w-24 truncate">
                          {locationQuery}
                        </span>
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
                          debouncedPush("location", e.target.value);
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

                {/* Level */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`gap-1.5 ${selectedLevels.length > 0 ? "border-primary" : ""}`}
                    >
                      Level
                      {selectedLevels.length > 0 && (
                        <span className="bg-black text-white text-[10px] font-code px-1.5 py-0.5 leading-none">
                          {selectedLevels.length}
                        </span>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {Object.keys(LEVEL_MAP).map((opt) => (
                      <DropdownMenuCheckboxItem
                        key={opt}
                        checked={selectedLevels.includes(opt)}
                        onCheckedChange={() =>
                          toggleMultiFilter(opt, "level", selectedLevels)
                        }
                      >
                        {opt}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Funding criteria */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`gap-1.5 ${selectedFunding.length > 0 ? "border-primary" : ""}`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 opacity-60" />
                      Funding
                      {selectedFunding.length > 0 && (
                        <span className="bg-black text-white text-[10px] font-code px-1.5 py-0.5 leading-none">
                          {selectedFunding.length}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {Object.keys(FUNDING_MAP).map((opt) => (
                      <DropdownMenuCheckboxItem
                        key={opt}
                        checked={selectedFunding.includes(opt)}
                        onCheckedChange={() =>
                          toggleMultiFilter(opt, "funding", selectedFunding)
                        }
                      >
                        {opt}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Citizenship */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`gap-1.5 ${selectedCitizenships.length > 0 ? "border-primary" : ""}`}
                    >
                      Citizenship
                      {selectedCitizenships.length > 0 && (
                        <span className="bg-black text-white text-[10px] font-code px-1.5 py-0.5 leading-none">
                          {selectedCitizenships.length}
                        </span>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    {Object.keys(CITIZENSHIP_MAP).map((opt) => (
                      <DropdownMenuCheckboxItem
                        key={opt}
                        checked={selectedCitizenships.includes(opt)}
                        onCheckedChange={() =>
                          toggleMultiFilter(opt, "citizenship", selectedCitizenships)
                        }
                      >
                        {opt}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Field of Study */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`gap-1.5 ${selectedFields.length > 0 ? "border-primary" : ""}`}
                    >
                      Field of Study
                      {selectedFields.length > 0 && (
                        <span className="bg-black text-white text-[10px] font-code px-1.5 py-0.5 leading-none">
                          {selectedFields.length}
                        </span>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-64 max-h-72 overflow-y-auto"
                  >
                    {FIELD_LABELS.map((field) => (
                      <DropdownMenuCheckboxItem
                        key={field}
                        checked={selectedFields.includes(field)}
                        onCheckedChange={() =>
                          toggleMultiFilter(field, "field", selectedFields)
                        }
                      >
                        {field}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* University */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`gap-1.5 ${selectedUniversities.length > 0 ? "border-primary" : ""}`}
                    >
                      University
                      {selectedUniversities.length > 0 && (
                        <span className="bg-black text-white text-[10px] font-code px-1.5 py-0.5 leading-none">
                          {selectedUniversities.length}
                        </span>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-72 max-h-72 overflow-y-auto"
                  >
                    {availableUniversities.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No universities available
                      </div>
                    )}
                    {availableUniversities.map((uni) => (
                      <DropdownMenuCheckboxItem
                        key={uni}
                        checked={selectedUniversities.includes(uni)}
                        onCheckedChange={() =>
                          toggleMultiFilter(uni, "university", selectedUniversities)
                        }
                      >
                        {uni}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Currently Open pill */}
                <Button
                  size="sm"
                  variant={showOpenOnly ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() => pushParams({ open: showOpenOnly ? null : "1" })}
                >
                  <CircleDot
                    className={`h-3.5 w-3.5 ${showOpenOnly ? "fill-current" : ""}`}
                  />
                  Open
                </Button>

                {/* Bookmarked pill */}
                <Button
                  size="sm"
                  variant={showBookmarked ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() =>
                    pushParams({ bookmarked: showBookmarked ? null : "1" })
                  }
                >
                  <Bookmark
                    className={`h-3.5 w-3.5 ${showBookmarked ? "fill-current" : ""}`}
                  />
                  Bookmarked
                  {bookmarkedIds.size > 0 && (
                    <span
                      className={`text-xs rounded-md px-1.5 py-0.5 font-medium leading-none ${
                        showBookmarked
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {bookmarkedIds.size}
                    </span>
                  )}
                </Button>

                {/* Status filter tabs */}
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                {STATUS_FILTERS.map((f) => (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={statusFilter === f.key ? "default" : "outline"}
                    onClick={() =>
                      pushParams({ status: f.key === "all" ? null : f.key })
                    }
                  >
                    {f.label}
                  </Button>
                ))}

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
              {totalCount} scholarship{totalCount !== 1 ? "s" : ""}
              {hasActiveFilters ? " matching your filters" : ""}
            </p>

            {/* Scholarship grid */}
            {rows.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {rows.map((row) => {
                  const match = matchScholarship(profile, row);
                  return (
                    <ScholarshipCard
                      key={row.id}
                      scholarship={rowToCard(row)}
                      isBookmarked={bookmarkedIds.has(row.id)}
                      onToggleBookmark={handleToggleBookmark}
                      matchReason={match.reason}
                      statusLabel={
                        bookmarkedIds.has(row.id) && tracking.get(row.id)
                          ? SCHOLARSHIP_STATUS_LABELS[tracking.get(row.id)!.status]
                          : null
                      }
                    />
                  );
                })}
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
                  ),
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
          </>
        )}
      </div>
    </div>
  );
}
