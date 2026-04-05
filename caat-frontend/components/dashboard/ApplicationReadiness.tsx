"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/src/lib/supabaseClient";
import { cn } from "@/lib/utils";

interface ReadinessStep {
  id: string;
  label: string;
  description: string;
  href: string;
  completed: boolean;
  failed?: boolean;
}

async function checkReadiness(): Promise<ReadinessStep[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return getDefaultSteps(false);
  }

  // Run checks in parallel
  const [profileRes, documentsRes, essaysRes, schoolsRes, scholarshipsRes] =
    await Promise.allSettled([
      // Profile: check if user has actually filled in their first name
      supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle(),
      // Documents: at least one uploaded
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      // Essays: at least one draft started
      supabase
        .from("essay_drafts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      // Schools: at least one bookmarked
      supabase
        .from("user_bookmarked_schools")
        .select("school_id", { count: "exact", head: true })
        .eq("user_id", user.id),
      // Scholarships: at least one bookmarked
      supabase
        .from("user_bookmarked_scholarships")
        .select("scholarship_id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

  function isOk(res: PromiseSettledResult<{ error: unknown }>) {
    return res.status === "fulfilled" && !res.value.error;
  }

  const profileData =
    profileRes.status === "fulfilled"
      ? (profileRes.value.data as { first_name: string | null } | null)
      : null;
  const profileDone =
    isOk(profileRes) &&
    profileData !== null &&
    typeof profileData?.first_name === "string" &&
    profileData.first_name.trim().length > 0;
  const profileFailed = profileRes.status === "rejected" || (profileRes.status === "fulfilled" && !!profileRes.value.error);

  const docsDone =
    isOk(documentsRes) &&
    ((documentsRes as PromiseFulfilledResult<{ count: number | null; error: unknown }>).value.count ?? 0) > 0;
  const docsFailed = documentsRes.status === "rejected" || (documentsRes.status === "fulfilled" && !!documentsRes.value.error);

  const essaysDone =
    isOk(essaysRes) &&
    ((essaysRes as PromiseFulfilledResult<{ count: number | null; error: unknown }>).value.count ?? 0) > 0;
  const essaysFailed = essaysRes.status === "rejected" || (essaysRes.status === "fulfilled" && !!essaysRes.value.error);

  const schoolsDone =
    isOk(schoolsRes) &&
    ((schoolsRes as PromiseFulfilledResult<{ count: number | null; error: unknown }>).value.count ?? 0) > 0;
  const schoolsFailed = schoolsRes.status === "rejected" || (schoolsRes.status === "fulfilled" && !!schoolsRes.value.error);

  const scholarshipsDone =
    isOk(scholarshipsRes) &&
    ((scholarshipsRes as PromiseFulfilledResult<{ count: number | null; error: unknown }>).value.count ?? 0) > 0;
  const scholarshipsFailed =
    scholarshipsRes.status === "rejected" || (scholarshipsRes.status === "fulfilled" && !!scholarshipsRes.value.error);

  return [
    {
      id: "profile",
      label: "Complete your profile",
      description: "Add your personal details and academic background.",
      href: "/profile",
      completed: profileDone,
      failed: profileFailed && !profileDone,
    },
    {
      id: "schools",
      label: "Bookmark target schools",
      description: "Save at least one school you're interested in.",
      href: "/schools",
      completed: schoolsDone,
      failed: schoolsFailed && !schoolsDone,
    },
    {
      id: "documents",
      label: "Upload a document",
      description: "Upload transcripts, test scores, or other documents.",
      href: "/documents",
      completed: docsDone,
      failed: docsFailed && !docsDone,
    },
    {
      id: "essays",
      label: "Start an essay draft",
      description: "Begin drafting your application essays.",
      href: "/essays",
      completed: essaysDone,
      failed: essaysFailed && !essaysDone,
    },
    {
      id: "scholarships",
      label: "Explore scholarships",
      description: "Bookmark at least one scholarship opportunity.",
      href: "/scholarships",
      completed: scholarshipsDone,
      failed: scholarshipsFailed && !scholarshipsDone,
    },
  ];
}

function getDefaultSteps(completed: boolean): ReadinessStep[] {
  return [
    { id: "profile", label: "Complete your profile", description: "", href: "/profile", completed },
    { id: "schools", label: "Bookmark target schools", description: "", href: "/schools", completed },
    { id: "documents", label: "Upload a document", description: "", href: "/documents", completed },
    { id: "essays", label: "Start an essay draft", description: "", href: "/essays", completed },
    { id: "scholarships", label: "Explore scholarships", description: "", href: "/scholarships", completed },
  ];
}

export function ApplicationReadiness() {
  const [steps, setSteps] = useState<ReadinessStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      setSteps(await checkReadiness());
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const now = Date.now();
    lastRefreshRef.current = now;
    checkReadiness()
      .then(setSteps)
      .finally(() => setLoading(false));

    // Re-check when user returns to this tab, but at most once per 60 seconds
    // to avoid firing 5 parallel Supabase queries on every tab switch.
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastRefreshRef.current;
        if (elapsed > 60_000) {
          lastRefreshRef.current = Date.now();
          refresh(true);
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refresh]);

  const completedCount = steps.filter((s) => s.completed).length;
  const percentage = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Application Readiness</h2>
          <p className="text-sm text-muted-foreground">
            {completedCount} of {steps.length} steps completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refresh(false)}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="Refresh readiness"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <Badge
            variant={percentage === 100 ? "default" : "secondary"}
            className="text-base font-bold px-3 py-1"
          >
            {percentage}%
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={percentage} className="h-2" />

      {/* Step list */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50",
                step.completed && "bg-muted/30 border-transparent",
                step.failed && "border-dashed opacity-60"
              )}
            >
              {step.completed ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
              ) : step.failed ? (
                <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "font-medium leading-tight",
                    step.completed && "text-muted-foreground line-through"
                  )}
                >
                  {step.label}
                </p>
                {step.failed ? (
                  <p className="text-xs text-amber-500 mt-0.5 leading-snug">Could not check</p>
                ) : step.description && !step.completed ? (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {step.description}
                  </p>
                ) : null}
              </div>
              {!step.completed && !step.failed && (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
