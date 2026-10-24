"use client";

import { useEffect, useState } from "react";
import { Bookmark, ChevronDown, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase/client";
import {
  SCHOLARSHIP_STATUSES,
  SCHOLARSHIP_STATUS_LABELS,
  trackScholarship,
  untrackScholarship,
  type ScholarshipStatus,
} from "@/lib/scholarship-tracking";

/**
 * Unified track + status control for the scholarship detail page (item 5).
 * Tracking and status are one thing: picking any status starts tracking the
 * scholarship (no separate bookmark step), and it updates the UI instantly
 * with no page refresh. Attaching a saved scholarship to one of the student's
 * applications (PROD-77) happens on that application's hub, not here; the
 * status upsert below never changes the attachment.
 */
export default function ScholarshipTracking({ scholarshipId }: { scholarshipId: string }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ScholarshipStatus | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setSignedIn(true);
      const { data } = await supabase
        .from("user_bookmarked_scholarships")
        .select("status")
        .eq("user_id", user.id)
        .eq("scholarship_id", scholarshipId)
        .maybeSingle();
      if (data) setStatus(((data as { status: string | null }).status as ScholarshipStatus) ?? "interested");
      setLoading(false);
    })();
  }, [scholarshipId]);

  const track = async (s: ScholarshipStatus) => {
    const prev = status;
    setStatus(s);
    try {
      await trackScholarship(scholarshipId, s);
    } catch {
      setStatus(prev);
      toast.error("Could not update. Please try again.");
    }
  };
  const untrack = async () => {
    const prev = status;
    setStatus(null);
    try {
      await untrackScholarship(scholarshipId);
    } catch {
      setStatus(prev);
      toast.error("Could not update. Please try again.");
    }
  };

  if (loading) {
    return (
      <Button variant="outline" size="icon" disabled aria-label="Loading">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }
  if (!signedIn) {
    return (
      <Button variant="outline" size="icon" onClick={() => toast.error("Sign in to save scholarships.")} aria-label="Save">
        <Bookmark className="h-4 w-4" />
      </Button>
    );
  }

  const tracked = status !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={tracked ? "default" : "outline"} size="sm" className="gap-1.5">
          <Bookmark className={`h-3.5 w-3.5 ${tracked ? "fill-current" : ""}`} />
          {tracked ? SCHOLARSHIP_STATUS_LABELS[status!] : "Save"}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {SCHOLARSHIP_STATUSES.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => track(s)}>
            {SCHOLARSHIP_STATUS_LABELS[s]}
            {status === s ? <Check className="h-3.5 w-3.5 ml-auto text-muted-foreground" /> : null}
          </DropdownMenuItem>
        ))}
        {tracked ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={untrack} className="text-[#9a1a27] dark:text-[#e06b78] focus:text-[#9a1a27]">
              Remove from saved
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
