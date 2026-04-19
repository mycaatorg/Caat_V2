"use client";

import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/src/lib/supabaseClient";
import { toast } from "sonner";
import { SCHOOL_BOOKMARK_EVENT } from "./schools-client";

interface Props {
  schoolId: number;
  /** When true, renders a small icon button suitable for list card footers */
  compact?: boolean;
}

export default function SchoolBookmarkButton({ schoolId, compact = false }: Props) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { data } = await supabase
        .from("user_bookmarked_schools")
        .select("school_id")
        .eq("user_id", user.id)
        .eq("school_id", schoolId)
        .maybeSingle();

      setIsBookmarked(!!data);
    }

    load();
  }, [schoolId]);

  async function handleToggle() {
    if (!userId) {
      toast.error("Sign in to bookmark schools.");
      return;
    }

    const prev = isBookmarked;
    setIsBookmarked(!prev);

    try {
      if (prev) {
        const { error } = await supabase
          .from("user_bookmarked_schools")
          .delete()
          .eq("user_id", userId)
          .eq("school_id", schoolId);
        if (error) throw error;
        window.dispatchEvent(new CustomEvent(SCHOOL_BOOKMARK_EVENT, { detail: -1 }));
      } else {
        const { error } = await supabase
          .from("user_bookmarked_schools")
          .upsert({ user_id: userId, school_id: schoolId });
        if (error) throw error;
        window.dispatchEvent(new CustomEvent(SCHOOL_BOOKMARK_EVENT, { detail: 1 }));
      }
    } catch {
      setIsBookmarked(prev);
      toast.error("Failed to update bookmark. Please try again.");
    }
  }

  const button = (
    <Button
      size="icon"
      variant={isBookmarked ? "default" : "outline"}
      onClick={handleToggle}
      aria-label={isBookmarked ? "Remove bookmark" : "Bookmark school"}
      className={compact ? "h-8 w-8" : undefined}
    >
      <Bookmark className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} ${isBookmarked ? "fill-current" : ""}`} />
    </Button>
  );

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{isBookmarked ? "Remove bookmark" : "Bookmark"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
