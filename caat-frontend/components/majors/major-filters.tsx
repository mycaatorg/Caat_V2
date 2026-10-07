import { Search, Bookmark } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { FilterView } from "@/types/majors";
import { MAJOR_CATEGORIES } from "@/constants/majors";

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedFilter: FilterView;
  onFilterChange: (filter: FilterView) => void;
  bookmarkedCount: number;
}

export default function MajorFilters({
  searchQuery,
  onSearchChange,
  selectedFilter,
  onFilterChange,
  bookmarkedCount,
}: Props) {
  return (
    <div className="mb-8 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {MAJOR_CATEGORIES.map((cat) => (
          <Button
            key={cat}
            size="sm"
            variant={selectedFilter === cat ? "default" : "outline"}
            onClick={() => onFilterChange(cat)}
            className={selectedFilter === cat ? "bg-[#9a1a27] text-white hover:bg-[#7d141f] border-[#9a1a27] dark:border-[#e06b78]" : ""}
          >
            {cat}
          </Button>
        ))}

        <Button
          size="sm"
          variant={selectedFilter === "Bookmarked" ? "default" : "outline"}
          onClick={() => onFilterChange("Bookmarked")}
          className={`gap-1.5 ${selectedFilter === "Bookmarked" ? "bg-[#9a1a27] text-white hover:bg-[#7d141f] border-[#9a1a27] dark:border-[#e06b78]" : ""}`}
        >
          <Bookmark
            className={`h-3.5 w-3.5 ${selectedFilter === "Bookmarked" ? "fill-current" : ""}`}
          />
          Bookmarked
          {bookmarkedCount > 0 && (
            <span
              className={`text-xs rounded-md px-1.5 py-0.5 font-medium ${
                selectedFilter === "Bookmarked"
                  ? "bg-white/20 text-white"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {bookmarkedCount}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
