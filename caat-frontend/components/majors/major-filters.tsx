import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MajorCategory } from "@/types/majors";

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
  selectedCategory: MajorCategory | "All";
  onCategoryChange: (cat: MajorCategory | "All") => void;
}

export default function MajorFilters({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
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
            variant={selectedCategory === cat ? "default" : "outline"}
            onClick={() => onCategoryChange(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>
    </div>
  );
}
