"use client";

import Link from "next/link";
import { Bookmark, Sparkles } from "lucide-react";
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
  /** When set, render a red "★ ..." badge above the university line */
  matchReason?: string | null;
  /** Tracking status label (e.g. "Applied") shown when the user tracks this. */
  statusLabel?: string | null;
  comparison?: { selected: boolean; disabled: boolean; label: string; onToggle: () => void };
}

export default function ScholarshipCard({
  scholarship,
  isBookmarked,
  onToggleBookmark,
  matchReason,
  statusLabel,
  comparison,
}: Props) {
  return (
    <Card className={`flex flex-col h-[420px] overflow-hidden hover:shadow-lg transition-shadow ${matchReason ? "border-l-[3px] border-l-[#9a1a27]" : ""}`}>
      <CardHeader className="pb-3 gap-2">
        {matchReason && (
          <span className="inline-flex items-center gap-1 self-start bg-[#9a1a27] text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-1 leading-tight">
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            {matchReason}
          </span>
        )}
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

        {statusLabel ? (
          <span className="inline-block self-start text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            {statusLabel}
          </span>
        ) : null}

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
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide ${color}`}
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

      <CardFooter className="pt-0 gap-2">
        <Button
          asChild
          className="flex-1 bg-[#9a1a27] hover:bg-[#7d1520] text-white"
        >
          <Link href={`/scholarships/${scholarship.id}`}>View Details</Link>
        </Button>
        {comparison && <Button variant="outline" className="shrink-0" aria-label={comparison.label} aria-pressed={comparison.selected} disabled={comparison.disabled} onClick={comparison.onToggle}>{comparison.selected ? "Selected" : "Compare"}</Button>}
      </CardFooter>
    </Card>
  );
}
