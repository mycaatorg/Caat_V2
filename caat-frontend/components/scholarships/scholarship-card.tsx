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

const TAG_COLORS: Record<string, string> = {
  "FULL RIDE":   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "MERIT-BASED": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "NEED-BLIND":  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "REGIONAL":    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "POST-GRAD":   "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  "PRESTIGIOUS": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "STEM":        "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

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
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3 gap-2">
        {/* University name + bookmark */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400 leading-tight">
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

      <CardContent className="flex-grow pb-3">
        {/* Amount */}
        <p className="text-2xl font-bold leading-tight">
          {scholarship.amount}
          {scholarship.amountSuffix && (
            <span className="text-sm font-normal text-muted-foreground ml-1">
              {scholarship.amountSuffix}
            </span>
          )}
        </p>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-3 mt-2">
          {scholarship.description}
        </p>
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          asChild
          className="w-full bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          <Link href={`/scholarships/${scholarship.id}`}>View Details</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
