"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight, ChevronDown, AlertCircle, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/src/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { calcCompletion } from "@/lib/profile-utils";
import type { ProfileRow, StandardisedTestScore } from "@/types/profile";

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

  // Run all checks in parallel
  const [
    profileRes, scoresRes,
    documentsRes, essaysRes,
    schoolsRes, scholarshipsRes,
    applicationsRes, resumesRes,
    recommendersRes, majorsRes,
    schoolListRes,
  ] = await Promise.allSettled([
    supabase.from("profiles").select(
      "id, first_name, last_name, birth_date, nationality, current_location, phone, linkedin, school_name, curriculum, graduation_year, avatar_url, target_majors, preferred_countries"
    ).eq("id", user.id).maybeSingle(),
    supabase.from("standardised_test_scores").select("id, profile_id, curriculum, cumulative_score, score_scale, created_at, updated_at").eq("profile_id", user.id),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("essay_drafts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("user_bookmarked_schools").select("school_id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("user_bookmarked_scholarships").select("scholarship_id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("user_school_applications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("resumes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("user_recommenders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("user_bookmarked_majors").select("major_id", { count: "exact", head: true }).eq("user_id", user.id),
    // School count for "build a balanced list" check (>= 3 schools)
    supabase.from("user_bookmarked_schools").select("school_id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  type CountRes = PromiseFulfilledResult<{ count: number | null; error: unknown }>;
  function isOk(res: PromiseSettledResult<{ error: unknown }>) {
    return res.status === "fulfilled" && !res.value.error;
  }
  function countOf(res: PromiseSettledResult<{ count: number | null; error: unknown }>) {
    return isOk(res) ? ((res as CountRes).value.count ?? 0) : 0;
  }
  function failed(res: PromiseSettledResult<{ error: unknown }>) {
    return res.status === "rejected" || (res.status === "fulfilled" && !!res.value.error);
  }

  const profileData = profileRes.status === "fulfilled" ? (profileRes.value.data as ProfileRow | null) : null;
  const scoresData = scoresRes.status === "fulfilled"
    ? ((scoresRes as PromiseFulfilledResult<{ data: unknown[] | null; error: unknown }>).value.data as StandardisedTestScore[] ?? [])
    : [];
  const profileDone = isOk(profileRes) && profileData !== null && calcCompletion(profileData, scoresData) === 100;

  const docsDone        = countOf(documentsRes) > 0;
  const essaysDone      = countOf(essaysRes) > 0;
  const schoolsDone     = countOf(schoolsRes) > 0;
  const scholarsDone    = countOf(scholarshipsRes) > 0;
  const appsDone        = countOf(applicationsRes) > 0;
  const resumeDone      = countOf(resumesRes) > 0;
  const recommendersDone = countOf(recommendersRes) > 0;
  const majorsDone      = countOf(majorsRes) > 0;
  const schoolListDone  = countOf(schoolListRes) >= 3;

  return [
    {
      id: "profile",
      label: "Complete your profile",
      description: "Add your personal details and academic background.",
      href: "/profile",
      completed: profileDone,
      failed: failed(profileRes) && !profileDone,
    },
    {
      id: "schools",
      label: "Shortlist target schools",
      description: "Bookmark schools you plan to apply to.",
      href: "/schools",
      completed: schoolsDone,
      failed: failed(schoolsRes) && !schoolsDone,
    },
    {
      id: "majors",
      label: "Research your majors",
      description: "Bookmark majors that match your interests.",
      href: "/majors",
      completed: majorsDone,
      failed: failed(majorsRes) && !majorsDone,
    },
    {
      id: "applications",
      label: "Open your applications",
      description: "Start tracking applications for your target schools.",
      href: "/applications",
      completed: appsDone,
      failed: failed(applicationsRes) && !appsDone,
    },
    {
      id: "resume",
      label: "Build your resume",
      description: "Create a resume to attach to your applications.",
      href: "/resume-builder",
      completed: resumeDone,
      failed: failed(resumesRes) && !resumeDone,
    },
    {
      id: "essays",
      label: "Draft your essays",
      description: "Begin writing your personal statement and supplements.",
      href: "/essays",
      completed: essaysDone,
      failed: failed(essaysRes) && !essaysDone,
    },
    {
      id: "recommenders",
      label: "Add recommenders",
      description: "Log teachers or counsellors writing your letters.",
      href: "/profile",
      completed: recommendersDone,
      failed: failed(recommendersRes) && !recommendersDone,
    },
    {
      id: "documents",
      label: "Upload your documents",
      description: "Upload transcripts, test scores, or ID documents.",
      href: "/documents",
      completed: docsDone,
      failed: failed(documentsRes) && !docsDone,
    },
    {
      id: "scholarships",
      label: "Find scholarships",
      description: "Bookmark scholarships you're eligible to apply for.",
      href: "/scholarships",
      completed: scholarsDone,
      failed: failed(scholarshipsRes) && !scholarsDone,
    },
    {
      id: "school-list",
      label: "Build a balanced list (3+ schools)",
      description: "A strong list has safety, match, and reach schools.",
      href: "/schools",
      completed: schoolListDone,
      failed: failed(schoolListRes) && !schoolListDone,
    },
  ];
}

function getDefaultSteps(completed: boolean): ReadinessStep[] {
  return [
    { id: "profile",       label: "Complete your profile",    description: "", href: "/profile",        completed },
    { id: "schools",       label: "Shortlist target schools", description: "", href: "/schools",        completed },
    { id: "majors",        label: "Research your majors",     description: "", href: "/majors",         completed },
    { id: "applications",  label: "Open your applications",   description: "", href: "/applications",   completed },
    { id: "resume",        label: "Build your resume",        description: "", href: "/resume-builder", completed },
    { id: "essays",        label: "Draft your essays",        description: "", href: "/essays",         completed },
    { id: "recommenders",  label: "Add recommenders",         description: "", href: "/profile",        completed },
    { id: "documents",     label: "Upload your documents",    description: "", href: "/documents",      completed },
    { id: "scholarships",  label: "Find scholarships",              description: "", href: "/scholarships", completed },
    { id: "school-list",   label: "Build a balanced list (3+ schools)", description: "", href: "/schools", completed },
  ];
}

export function ApplicationReadiness() {
  const [steps, setSteps] = useState<ReadinessStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(true);
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
      <div className="border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-2 w-full" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border bg-card p-6 space-y-5">
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

      {/* Progress bar — always visible, clickable to toggle steps */}
      <button
        type="button"
        onClick={() => setStepsOpen((o) => !o)}
        className="w-full group flex items-center gap-3"
        aria-expanded={stepsOpen}
        aria-label={stepsOpen ? "Hide steps" : "Show steps"}
      >
        <div className="flex-1">
          <Progress value={percentage} className="h-2" />
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
            stepsOpen && "rotate-180"
          )}
        />
      </button>

      {/* Step list — collapsible, fixed height grid with scroll */}
      {stepsOpen && (
        <ul className="grid grid-cols-3 gap-2 max-h-[168px] overflow-y-auto pr-1">
          {steps.map((step) => (
            <li key={step.id}>
              <Link
                href={step.href}
                className={cn(
                  "flex items-center gap-2 border p-2.5 text-sm transition-colors hover:bg-muted/50",
                  step.completed && "bg-muted/30 border-transparent",
                  step.failed && "border-dashed opacity-60"
                )}
              >
                {step.completed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : step.failed ? (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span
                  className={cn(
                    "flex-1 min-w-0 text-xs leading-tight font-medium truncate",
                    step.completed && "text-muted-foreground line-through"
                  )}
                >
                  {step.label}
                </span>
                {!step.completed && !step.failed && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
