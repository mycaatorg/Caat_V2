"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

import { TAG_COLORS } from "@/constants/scholarships";

export interface Scholarship {
  id: string;
  university: string;
  name: string;
  tags: string[];
  /** Primary display amount, e.g. "$65,000" or "Fully Funded" */
  amount: string;
  /** Optional suffix shown in muted text, e.g. "/ year" or "/ total" */
  amountSuffix?: string;
  description: string;
}

interface Props {
  scholarship: Scholarship;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
}

export default function ScholarshipCard({
  scholarship,
  isBookmarked,
  onToggleBookmark,
}: Props) {
  return (
    <Card className="flex flex-col h-[420px] overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3 gap-2">
        {/* University name + bookmark */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
            {scholarship.university}
          </span>
          <Button
            size="icon-sm"
            variant={isBookmarked ? "default" : "outline"}
            className="shrink-0"
            onClick={() => onToggleBookmark(scholarship.id)}
            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark scholarship"}
          >
            <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? "fill-current" : ""}`} />
          </Button>
        </div>

        {/* Scholarship title */}
        <h3 className="font-semibold text-[15px] leading-snug">
          {scholarship.name}
        </h3>

        {/* Tag badges */}
        {scholarship.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {scholarship.tags.map((tag) => {
              const color =
                TAG_COLORS[tag] ??
                "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
              return (
                <span
                  key={tag}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${color}`}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col pb-3 overflow-hidden">
        {/* Amount */}
        <p className="text-2xl font-bold leading-tight">
          {scholarship.amount}
          {scholarship.amountSuffix && (
            <span className="text-sm font-normal text-muted-foreground ml-1">
              {scholarship.amountSuffix}
            </span>
          )}
        </p>

        {/* Description — scrolls inside the fixed-height card so long
            stipend blurbs don't stretch the grid row. Explicit max-h
            guards against the flex chain failing to constrain height. */}
        <div className="mt-2 flex-1 min-h-0 max-h-[180px] overflow-y-auto pr-2">
          <p className="text-sm text-muted-foreground">
            {scholarship.description}
          </p>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          asChild
          className="w-full bg-[#9a1a27] hover:bg-[#7d1520] text-white"
        >
          <Link href={`/scholarships/${scholarship.id}`}>View Details</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
