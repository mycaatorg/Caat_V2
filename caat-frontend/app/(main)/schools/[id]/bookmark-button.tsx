"use client";

import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/src/lib/supabaseClient";

interface Props {
  schoolId: number;
}

export default function SchoolBookmarkButton({ schoolId }: Props) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      setUserId(session.user.id);

      const { data } = await supabase
        .from("user_bookmarked_schools")
        .select("school_id")
        .eq("user_id", session.user.id)
        .eq("school_id", schoolId)
        .maybeSingle();

      setIsBookmarked(!!data);
    }

    load();
  }, [schoolId]);

  async function handleToggle() {
    if (!userId) return;

    const next = !isBookmarked;
    setIsBookmarked(next);

    if (isBookmarked) {
      await supabase
        .from("user_bookmarked_schools")
        .delete()
        .eq("user_id", userId)
        .eq("school_id", schoolId);
    } else {
      await supabase
        .from("user_bookmarked_schools")
        .upsert({ user_id: userId, school_id: schoolId });
    }
  }

  return (
    <Button
      size="icon"
      variant={isBookmarked ? "default" : "outline"}
      onClick={handleToggle}
      aria-label={isBookmarked ? "Remove bookmark" : "Bookmark school"}
    >
      <Bookmark className={isBookmarked ? "fill-current" : ""} />
    </Button>
  );
}
