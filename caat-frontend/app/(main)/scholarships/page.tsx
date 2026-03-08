"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import ScholarshipCard, { Scholarship } from "@/components/scholarships/scholarship-card";

// ---------------------------------------------------------------------------
// Placeholder data — replace with real Supabase fetch when backend is ready
// ---------------------------------------------------------------------------
const MOCK_SCHOLARSHIPS: Scholarship[] = [
  {
    id: "1",
    university: "Stanford University",
    name: "Global Leadership Fellowship",
    tags: ["FULL RIDE", "MERIT-BASED"],
    amount: "$65,000",
    amountSuffix: "/ year",
    description:
      "Awarded to incoming international students who demonstrate exceptional leadership potential and community impact through their academic and extracurricular achievements.",
  },
  {
    id: "2",
    university: "National University of Singapore",
    name: "ASEAN Undergraduate Award",
    tags: ["NEED-BLIND", "REGIONAL"],
    amount: "$25,000",
    amountSuffix: "/ year",
    description:
      "Supporting talented students from ASEAN member countries to pursue their undergraduate studies at NUS.",
  },
  {
    id: "3",
    university: "University of Toronto",
    name: "Lester B. Pearson Scholarship",
    tags: ["FULL RIDE", "MERIT-BASED"],
    amount: "$52,000",
    amountSuffix: "/ total",
    description:
      "Canada's most prestigious scholarship for international students who demonstrate exceptional academic achievement and impact in their school and community.",
  },
  {
    id: "4",
    university: "Oxford University",
    name: "Rhodes Scholarship",
    tags: ["POST-GRAD", "PRESTIGIOUS"],
    amount: "Fully Funded",
    description:
      "Covering all fees and providing a living stipend for postgraduate study at the University of Oxford.",
  },
  {
    id: "5",
    university: "MIT",
    name: "Science Excellence Award",
    tags: ["STEM", "MERIT-BASED"],
    amount: "$15,000",
    amountSuffix: "/ year",
    description:
      "Targeted at undergraduate students who have shown exceptional research promise in the physical sciences.",
  },
  {
    id: "6",
    university: "University of Melbourne",
    name: "Chancellor's Scholarship",
    tags: ["FULL RIDE", "NEED-BLIND"],
    amount: "50% Fee Remission",
    description:
      "Awarded to high-achieving students from various backgrounds based on ATAR scores and community impact.",
  },
  {
    id: "7",
    university: "Harvard University",
    name: "Harvard International Scholarship",
    tags: ["NEED-BLIND", "MERIT-BASED"],
    amount: "$70,000",
    amountSuffix: "/ year",
    description:
      "Need-based scholarship covering full cost of attendance for exceptional international students admitted to Harvard College.",
  },
  {
    id: "8",
    university: "ETH Zurich",
    name: "Excellence Scholarship & Opportunity",
    tags: ["MERIT-BASED", "POST-GRAD"],
    amount: "$30,000",
    amountSuffix: "/ year",
    description:
      "A merit-based scholarship programme for outstanding Master's students at one of the world's leading technical universities.",
  },
  {
    id: "9",
    university: "University of Edinburgh",
    name: "Global Research Scholarship",
    tags: ["STEM", "PRESTIGIOUS"],
    amount: "£20,000",
    amountSuffix: "/ year",
    description:
      "Open to international students pursuing postgraduate research degrees in STEM disciplines at the University of Edinburgh.",
  },
];

const LOCATIONS = ["United States", "United Kingdom", "Singapore", "Canada", "Australia", "Switzerland"];
const MAJOR_FIELDS = ["Engineering", "Business", "Natural Sciences", "Social Sciences", "Arts & Humanities", "Health Sciences"];
const ELIGIBILITY_OPTIONS = ["Merit-Based", "Need-Based", "Need-Blind", "Full Ride", "Undergraduate", "Postgraduate"];

const ITEMS_PER_PAGE = 6;

export default function ScholarshipsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedEligibility, setSelectedEligibility] = useState<string[]>([]);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  function toggleBookmark(id: string) {
    setBookmarked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleMultiFilter<T>(
    value: T,
    setter: React.Dispatch<React.SetStateAction<T[]>>
  ) {
    setter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function clearAll() {
    setSelectedLocations([]);
    setSelectedFields([]);
    setSelectedEligibility([]);
    setSearchQuery("");
    setCurrentPage(1);
  }

  const hasActiveFilters =
    selectedLocations.length > 0 ||
    selectedFields.length > 0 ||
    selectedEligibility.length > 0 ||
    searchQuery.trim().length > 0;

  // Client-side search filter (placeholder — swap for server-side when API is ready)
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return MOCK_SCHOLARSHIPS.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.university.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [searchQuery]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  function goToPage(page: number) {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }

  // Build visible page numbers: always show 1, totalPages, and pages near current
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
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Top header bar — matches pattern used across (main) pages           */}
      {/* ------------------------------------------------------------------ */}
      <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/schools">Schools</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbLink>Scholarships</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Search — right side of the header */}
        <div className="ml-auto relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-9"
            placeholder="Search by scholarship name or university..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Page content                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="min-h-screen p-8 pt-4">
        <main className="max-w-5xl mx-auto">

          {/* Page title + filter row */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-4">Scholarships</h1>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Location filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`gap-1.5 ${selectedLocations.length > 0 ? "border-primary" : ""}`}
                  >
                    Location
                    {selectedLocations.length > 0 && (
                      <span className="bg-primary text-primary-foreground text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none">
                        {selectedLocations.length}
                      </span>
                    )}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  {LOCATIONS.map((loc) => (
                    <DropdownMenuCheckboxItem
                      key={loc}
                      checked={selectedLocations.includes(loc)}
                      onCheckedChange={() =>
                        toggleMultiFilter(loc, setSelectedLocations)
                      }
                    >
                      {loc}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Major/Field filter */}
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

              {/* Eligibility filter */}
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
                  {ELIGIBILITY_OPTIONS.map((opt) => (
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

          {/* Scholarship grid */}
          {paginated.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {paginated.map((scholarship) => (
                <ScholarshipCard
                  key={scholarship.id}
                  scholarship={scholarship}
                  isBookmarked={bookmarked.has(scholarship.id)}
                  onToggleBookmark={toggleBookmark}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <p className="text-lg font-medium">No scholarships found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters.</p>
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
    </>
  );
}
