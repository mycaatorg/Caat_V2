"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/src/lib/supabaseClient";

interface DeadlineItem {
  id: string;
  label: string;
  type: "school" | "scholarship";
  deadline_at: string; // ISO date
  href: string;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function dotColor(days: number) {
  if (days <= 7) return "bg-red-500";
  if (days <= 30) return "bg-amber-500";
  return "bg-green-500";
}

function countdownText(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  return `${days}d`;
}

function countdownColor(days: number) {
  if (days <= 7) return "text-red-500";
  if (days <= 30) return "text-amber-500";
  return "text-green-600 dark:text-green-400";
}

const DISPLAY_LIMIT = 8;

export function UpcomingDeadlinesWidget() {
  const [items, setItems] = useState<DeadlineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const today = new Date().toISOString().split("T")[0];

        const [scholarshipRes, applicationRes] = await Promise.all([
          // Bookmarked scholarships with future deadlines
          supabase
            .from("user_bookmarked_scholarships")
            .select("scholarship_id, scholarships(id, title, deadline_at)")
            .eq("user_id", user.id),
          // Tracked applications with deadlines
          supabase
            .from("user_school_applications")
            .select("id, deadline_at, status, schools(name)")
            .eq("user_id", user.id)
            .not("deadline_at", "is", null),
        ]);

        const deadlines: DeadlineItem[] = [];

        // Scholarship deadlines
        if (scholarshipRes.data) {
          for (const row of scholarshipRes.data as unknown as {
            scholarship_id: string;
            scholarships: { id: string; title: string; deadline_at: string | null } | null;
          }[]) {
            const s = row.scholarships;
            if (s?.deadline_at && s.deadline_at >= today) {
              deadlines.push({
                id: `s-${s.id}`,
                label: s.title,
                type: "scholarship",
                deadline_at: s.deadline_at,
                href: `/scholarships/${s.id}`,
              });
            }
          }
        }

        // Application deadlines
        if (applicationRes.data) {
          for (const row of applicationRes.data as unknown as {
            id: string;
            deadline_at: string;
            status: string;
            schools: { name: string } | null;
          }[]) {
            if (
              row.deadline_at >= today &&
              row.status !== "withdrawn" &&
              row.status !== "rejected"
            ) {
              deadlines.push({
                id: `a-${row.id}`,
                label: row.schools?.name ?? "Unknown School",
                type: "school",
                deadline_at: row.deadline_at,
                href: "/applications",
              });
            }
          }
        }

        // Sort by deadline ascending
        deadlines.sort(
          (a, b) =>
            new Date(a.deadline_at).getTime() -
            new Date(b.deadline_at).getTime()
        );

        setItems(deadlines.slice(0, DISPLAY_LIMIT));
      } catch {
        // Silently fail — widget is non-critical
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Clock className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No upcoming deadlines.
        </p>
        <p className="text-xs text-muted-foreground">
          Bookmark scholarships or set deadlines on your applications.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const days = daysUntil(item.deadline_at);
        return (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
          >
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${dotColor(days)}`}
            />
            <span className="flex-1 min-w-0 truncate">{item.label}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {item.type === "scholarship" ? "Scholarship" : "Application"}
            </span>
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
