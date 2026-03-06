import { Search, Bookmark } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MajorCategory } from "@/types/majors";
import { FilterView } from "@/app/(main)/majors/client";

const CATEGORIES: (MajorCategory | "All")[] = [
  "All",
  "Engineering",
  "Business",
  "Health Sciences",
  "Arts & Humanities",
  "Social Sciences",
  "Natural Sciences",
  "Education",
];

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
          placeholder="Search majors..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            size="sm"
            variant={selectedFilter === cat ? "default" : "outline"}
            onClick={() => onFilterChange(cat)}
          >
            {cat}
          </Button>
        ))}

        <Button
          size="sm"
          variant={selectedFilter === "Bookmarked" ? "default" : "outline"}
          onClick={() => onFilterChange("Bookmarked")}
          className="gap-1.5"
        >
          <Bookmark
            className={`h-3.5 w-3.5 ${selectedFilter === "Bookmarked" ? "fill-current" : ""}`}
          />
          Bookmarked
          {bookmarkedCount > 0 && (
            <span
              className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${
                selectedFilter === "Bookmarked"
                  ? "bg-primary-foreground/20 text-primary-foreground"
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
