"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { supabase } from "@/lib/supabase/client";
import { getClientUserId } from "@/lib/current-user";
import {
  CUSTOM_SOURCE_PILL,
  fetchUnifiedDeadlines,
  type UnifiedDeadline,
} from "@/lib/unified-deadlines";

function daysUntil(dateISO: string): number {
  const target = new Date(dateISO + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Round, not ceil: DST makes a day span 23h/25h, and ceil turns that into an
  // off-by-one day count.
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function dotColor(days: number) {
  if (days <= 7) return "bg-[#9a1a27]";
  if (days <= 30) return "bg-amber-500";
  return "bg-green-500";
}

function countdownText(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  return `${days}d`;
}

function countdownColor(days: number) {
  if (days <= 7) return "text-[#9a1a27] dark:text-[#e06b78]";
  if (days <= 30) return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

const SOURCE_STYLES: Record<UnifiedDeadline["source"], { label: string; className: string }> = {
  app: {
    label: "App",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  scholarship: {
    label: "Schol",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  custom: {
    label: CUSTOM_SOURCE_PILL.visible,
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  event: {
    label: "Event",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
};

const DISPLAY_LIMIT = 8;

export function UpcomingDeadlinesWidget() {
  const [items, setItems] = useState<UnifiedDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(false);
      try {
        const userId = await getClientUserId();
        if (!userId) return;
        const all = await fetchUnifiedDeadlines(supabase, userId);
        if (!cancelled) setItems(all.slice(0, DISPLAY_LIMIT));
      } catch {
        // D2 — a real failure shows an error+retry, not a "no deadlines" empty.
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        compact
        message="Couldn't load your deadlines."
        onRetry={() => { setLoading(true); setReloadKey((k) => k + 1); }}
      />
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Clock className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
        <p className="text-xs text-muted-foreground">
          Bookmark scholarships, set deadlines on your applications, or add a calendar event.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const days = daysUntil(item.dateISO);
        const style = SOURCE_STYLES[item.source];
        return (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
          >
            <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor(days)}`} />
            <span
              className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${style.className}`}
            >
              {item.source === "custom" ? (
                <>
                  <span aria-hidden="true">{CUSTOM_SOURCE_PILL.visible}</span>
                  <span className="sr-only">{CUSTOM_SOURCE_PILL.spoken}</span>
                </>
              ) : style.label}
            </span>
            <span className="flex-1 min-w-0 truncate">{item.title}</span>
            <span
              className={`text-xs font-medium shrink-0 tabular-nums ${countdownColor(days)}`}
            >
              {countdownText(days)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
