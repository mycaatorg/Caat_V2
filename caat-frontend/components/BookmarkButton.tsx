"use client";

import { useState, useEffect, useRef, type ReactElement } from "react";
import { Bookmark, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthContext";
import { toast } from "sonner";

type BookmarkTable =
  | "user_bookmarked_majors"
  | "user_bookmarked_scholarships"
  | "user_bookmarked_schools";

interface BookmarkButtonProps {
  /** The bookmark join table for this entity. */
  table: BookmarkTable;
  /** The entity id column on that table (e.g. "major_id"). */
  column: string;
  /** The entity id value. */
  id: string | number;
  /** Singular noun used in the aria-label and sign-in toast (e.g. "major"). */
  label: string;
  /** List-card variant: smaller button + tooltip. */
  compact?: boolean;
  /** Extra size classes for the icon when not compact (schools uses "h-4 w-4"). */
  iconSize?: string;
  /** Called with +1 on bookmark and -1 on un-bookmark, after the write succeeds. */
  onToggle?: (delta: 1 | -1) => void;
  /**
   * Initial bookmarked state resolved server-side. When provided, the button
   * skips its per-mount `getUser()` + per-card bookmark query, which removes the
   * N+1 request storm on list pages (C2). The signed-in user still comes from
   * AuthContext (one shared call) so the toggle works.
   */
  initialBookmarked?: boolean;
}

type ReadStatus = "loading" | "ready" | "error";

interface ReadState {
  /** Which read this result belongs to (entity + owner + attempt). */
  key: string;
  status: ReadStatus;
  bookmarked: boolean;
}

/**
 * Shared bookmark toggle button for majors, scholarships and schools. Optimistic
 * toggle with rollback + error toast on failure. Preserves the per-entity
 * behavior the three original buttons had (labels, sizing, schools' list event).
 *
 * Until the owner's saved state is known (auth still resolving, or the bookmark
 * read in flight) the button is inert and named "Loading <label> bookmark",
 * so it never claims "not bookmarked" or acts on a guess. A failed read becomes
 * a retry button rather than an unsaved state, and a second click while a write
 * is in flight is ignored (PROD-149). Pending states after a click use
 * aria-disabled + aria-busy rather than `disabled`, so keyboard focus stays put.
 */
export default function BookmarkButton({
  table,
  column,
  id,
  label,
  compact = false,
  iconSize,
  onToggle,
  initialBookmarked,
}: BookmarkButtonProps) {
  // The user is resolved once, app-wide, by AuthProvider — no per-card getUser.
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  // List pages pass `initialBookmarked` (resolved in one server query), so the
  // per-card read is skipped there and the N+1 query stays gone (C2).
  const skipInitialFetch = initialBookmarked !== undefined;
  const [attempt, setAttempt] = useState(0);
  // The server value is part of the key, so a refreshed prop (router.refresh,
  // a new list page) replaces the local state instead of being ignored.
  const key = skipInitialFetch
    ? `server:${initialBookmarked}`
    : `${table}:${column}:${id}:${userId}:${attempt}`;
  const [read, setRead] = useState<ReadState>(() => ({
    key: skipInitialFetch ? key : "",
    status: skipInitialFetch ? "ready" : "loading",
    bookmarked: initialBookmarked ?? false,
  }));
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // Once the user has clicked, focus may be on the button, so later pending
  // states use aria-disabled instead of `disabled` (which would drop focus).
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    if (skipInitialFetch || authLoading || !userId) return;
    let active = true;
    const settle = (status: ReadStatus, bookmarked = false) => {
      if (active) setRead({ key, status, bookmarked });
    };
    Promise.resolve(
      supabase
        .from(table)
        .select(column)
        .eq("user_id", userId)
        .eq(column, id as never)
        .maybeSingle()
    ).then(
      ({ data, error }) => (error ? settle("error") : settle("ready", !!data)),
      () => settle("error")
    );
    return () => {
      active = false;
    };
  }, [table, column, id, userId, authLoading, skipInitialFetch, key]);

  // A result only counts for the read it answered; anything else is pending.
  let status: ReadStatus | "signed-out";
  if (skipInitialFetch) status = "ready";
  else if (authLoading) status = "loading";
  else if (!userId) status = "signed-out";
  else status = read.key === key ? read.status : "loading";
  const current =
    read.key === key ? read.bookmarked : skipInitialFetch && !!initialBookmarked;
  const isBookmarked = status === "ready" && current;

  async function handleToggle() {
    if (status === "signed-out" || !userId) {
      toast.error(`Sign in to bookmark ${label}s.`);
      return;
    }
    if (status !== "ready" || inFlight.current) return;

    inFlight.current = true;
    setInteracted(true);
    setBusy(true);
    const readKey = key;
    const prev = current;
    // Server-resolved state has no read to match, so it adopts this key.
    const show = (bookmarked: boolean) =>
      setRead((cur) =>
        cur.key === readKey || skipInitialFetch
          ? { key: readKey, status: "ready", bookmarked }
          : cur
      );
    show(!prev);

    try {
      if (prev) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("user_id", userId)
          .eq(column, id as never);
        if (error) throw error;
        onToggle?.(-1);
      } else {
        const { error } = await supabase
          .from(table)
          .upsert({ user_id: userId, [column]: id } as never);
        if (error) throw error;
        onToggle?.(1);
      }
    } catch {
      show(prev);
      toast.error("Failed to update bookmark. Please try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const sizeClass = compact ? "h-8 w-8" : undefined;
  // Looks disabled while staying focusable; the handlers ignore the clicks.
  const pendingClass = "opacity-50 cursor-not-allowed";
  const iconClass = (extra = "") =>
    `${compact ? "h-3.5 w-3.5" : iconSize ?? ""} ${extra}`.trim();

  let button: ReactElement;
  let tip: string;
  if (status === "loading") {
    tip = `Loading ${label} bookmark`;
    button = (
      <Button
        size="icon"
        variant="outline"
        disabled={!interacted}
        aria-disabled
        aria-busy
        aria-label={tip}
        className={`${pendingClass} ${sizeClass ?? ""}`.trim()}
      >
        <Loader2 className={iconClass("animate-spin")} />
      </Button>
    );
  } else if (status === "error") {
    tip = `Could not load ${label} bookmark. Retry`;
    button = (
      <Button
        size="icon"
        variant="outline"
        onClick={() => {
          setInteracted(true);
          setAttempt((n) => n + 1);
        }}
        aria-label={tip}
        title={compact ? undefined : tip}
        className={`text-destructive ${sizeClass ?? ""}`.trim()}
      >
        <RotateCcw className={iconClass()} />
      </Button>
    );
  } else {
    tip = isBookmarked ? "Remove bookmark" : "Bookmark";
    button = (
      <Button
        size="icon"
        variant={isBookmarked ? "default" : "outline"}
        onClick={handleToggle}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        aria-pressed={isBookmarked}
        aria-label={isBookmarked ? "Remove bookmark" : `Bookmark ${label}`}
        className={busy ? `${pendingClass} ${sizeClass ?? ""}`.trim() : sizeClass}
      >
        <Bookmark className={iconClass(isBookmarked ? "fill-current" : "")} />
      </Button>
    );
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
