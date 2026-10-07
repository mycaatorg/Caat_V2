/**
 * Onboarding persistence (PROD-73). Each answer is saved as soon as it is
 * given, so leaving halfway keeps progress. Writes are owner-scoped and must
 * touch the caller's row, or they fail rather than report success.
 */
import { supabase } from "@/lib/supabase/client";
import { getClientUserId } from "@/lib/current-user";
import { sanitizeError } from "@/lib/safe-error";
import type { JourneyStage, StudentStatus, YearLevel } from "@/types/profile";

export interface OnboardingAnswers {
  year_level?: YearLevel | null;
  student_status?: StudentStatus | null;
  journey_stage?: JourneyStage | null;
  preferred_countries?: string[];
  target_majors?: string[];
  graduation_year?: number | null;
}

export interface OnboardingProfile {
  year_level: YearLevel | null;
  student_status: StudentStatus | null;
  journey_stage: JourneyStage | null;
  preferred_countries: string[];
  target_majors: string[];
  graduation_year: number | null;
  onboarding_completed_at: string | null;
}

async function userId(): Promise<string> {
  const id = await getClientUserId();
  if (!id) throw new Error("Not authenticated");
  return id;
}

async function writeProfile(patch: Record<string, unknown>): Promise<void> {
  const id = await userId();
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(sanitizeError(error));
  if (!data || data.length === 0) throw new Error("Profile not found");
}

export async function fetchOnboardingProfile(): Promise<OnboardingProfile> {
  const id = await userId();
  const { data, error } = await supabase
    .from("profiles")
    .select("year_level, student_status, journey_stage, preferred_countries, target_majors, graduation_year, onboarding_completed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(sanitizeError(error));
  return {
    year_level: (data?.year_level as YearLevel | null) ?? null,
    student_status: (data?.student_status as StudentStatus | null) ?? null,
    journey_stage: (data?.journey_stage as JourneyStage | null) ?? null,
    preferred_countries: ((data?.preferred_countries as string[] | null) ?? []).filter(Boolean),
    target_majors: ((data?.target_majors as string[] | null) ?? []).filter(Boolean),
    graduation_year: (data?.graduation_year as number | null) ?? null,
    onboarding_completed_at: (data?.onboarding_completed_at as string | null) ?? null,
  };
}

export function saveOnboardingAnswers(answers: OnboardingAnswers): Promise<void> {
  return writeProfile({ ...answers });
}

export function completeOnboarding(): Promise<void> {
  return writeProfile({ onboarding_completed_at: new Date().toISOString() });
}

export function dismissOnboarding(): Promise<void> {
  return writeProfile({ onboarding_dismissed_at: new Date().toISOString() });
}

/** Year level → expected final school year, only used when none is set. */
export function graduationYearFor(level: YearLevel, now: Date = new Date()): number | null {
  const year = now.getFullYear();
  if (level === "year_12") return year;
  if (level === "year_11") return year + 1;
  if (level === "year_10") return year + 2;
  return null;
}

/** Add without duplicates (case-insensitive), keeping existing order. */
export function mergeUnique(existing: string[], added: string[]): string[] {
  const seen = new Set(existing.map((v) => v.toLowerCase()));
  return [...existing, ...added.filter((v) => !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()))];
}
