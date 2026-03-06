"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  majorId: string;
  // Phase 4: initialBookmarked will come from the server
  initialBookmarked?: boolean;
}

export default function BookmarkButton({ majorId, initialBookmarked = false }: Props) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);

  function handleToggle() {
    // Phase 4: call server action here for persistence
    setIsBookmarked((prev) => !prev);
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
