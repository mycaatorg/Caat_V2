import Link from "next/link";
import { Bookmark, Check, Plus } from "lucide-react";
import { Major } from "@/types/majors";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CATEGORY_COLORS } from "@/constants/majors";

interface Props {
  major: Major;
  isBookmarked: boolean;
  isSelected: boolean;
  canSelect: boolean;
  onToggleSelect: (id: string) => void;
  onToggleBookmark: (id: string) => void;
}

export default function MajorCard({
  major,
  isBookmarked,
  isSelected,
  canSelect,
  onToggleSelect,
  onToggleBookmark,
}: Props) {
  const categoryColor =
    CATEGORY_COLORS[major.category] ??
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <Card
      className={`flex flex-col h-full hover:shadow-lg transition-shadow ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
    >
      <CardHeader className="gap-2">
        {/* Category + bookmark (top right, matches scholarship card) */}
        <div className="flex items-start justify-between gap-2">
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${categoryColor}`}
          >
            {major.category}
          </span>
          <Button
            size="icon-sm"
            variant={isBookmarked ? "default" : "outline"}
            className="shrink-0"
            onClick={() => onToggleBookmark(major.id)}
            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark major"}
          >
            <Bookmark className={isBookmarked ? "fill-current" : ""} />
          </Button>
        </div>

        <CardTitle className="text-lg leading-tight">
          <Link
            href={`/majors/${major.id}`}
            className="hover:underline underline-offset-2"
          >
            {major.name}
          </Link>
        </CardTitle>
        {major.description && (
          <CardDescription className="line-clamp-2">
            {major.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-grow" />

      <CardFooter className="pt-0">
        {/* Full-width primary CTA — matches scholarship card. Stays red
            even when selected; the icon + label switches to indicate state. */}
        <Button
          className="w-full"
          disabled={!canSelect && !isSelected}
          onClick={() => onToggleSelect(major.id)}
        >
          {isSelected ? (
            <>
              <Check />
              Selected
            </>
          ) : (
            <>
              <Plus />
              Compare
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
