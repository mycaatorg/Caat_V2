"use client";

import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/src/lib/supabaseClient";

interface Props {
  majorId: string;
}

export default function BookmarkButton({ majorId }: Props) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      setUserId(session.user.id);

      const { data } = await supabase
        .from("user_bookmarked_majors")
        .select("major_id")
        .eq("user_id", session.user.id)
        .eq("major_id", majorId)
        .maybeSingle();

      setIsBookmarked(!!data);
    }

    load();
  }, [majorId]);

  async function handleToggle() {
    if (!userId) return;

    const next = !isBookmarked;
    setIsBookmarked(next); // optimistic

    if (isBookmarked) {
      await supabase
        .from("user_bookmarked_majors")
        .delete()
        .eq("user_id", userId)
        .eq("major_id", majorId);
    } else {
      await supabase
        .from("user_bookmarked_majors")
        .upsert({ user_id: userId, major_id: majorId });
    }
  }

  return (
    <Button
      size="icon"
      variant={isBookmarked ? "default" : "outline"}
      onClick={handleToggle}
      aria-label={isBookmarked ? "Remove bookmark" : "Bookmark major"}
    >
      <Bookmark className={isBookmarked ? "fill-current" : ""} />
    </Button>
  );
}
