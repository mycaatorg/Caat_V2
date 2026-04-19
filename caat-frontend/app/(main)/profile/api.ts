import { supabase } from "@/src/lib/supabaseClient";
import type {
  ProfileRow,
  StandardisedTestScore,
  StandardisedTestSubjectRow,
} from "@/types/profile";

// ── Profile ────────────────────────────────────────────────────────────────────

// Explicit allowlist of user-editable profile fields (D4 — prevents mass assignment
// if the profiles table gains new privileged columns not intended to be user-writable).
const ALLOWED_PROFILE_UPDATE_FIELDS = new Set<keyof Omit<ProfileRow, "id">>([
  "first_name", "last_name", "email", "birth_date", "phone",
  "linkedin", "github", "avatar_url", "nationality", "current_location",
  "school_name", "curriculum", "graduation_year", "target_majors",
  "preferred_countries", "activities", "default_resume_id",
]);

export async function fetchProfile(): Promise<ProfileRow> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, email, birth_date, phone, linkedin, github, avatar_url, nationality, current_location, school_name, curriculum, graduation_year, target_majors, preferred_countries, activities, default_resume_id"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  // New user — no profile row yet. Create a blank one and return it.
  if (!data) {
    const fullName: string = user.user_metadata?.full_name ?? "";
    const [firstName, ...rest] = fullName.trim().split(" ");
    const blank: Omit<ProfileRow, never> = {
      id: user.id,
      first_name: firstName || null,
      last_name: rest.join(" ") || null,
      email: user.email ?? null,
      birth_date: null,
      phone: null,
      linkedin: null,
      github: null,
      avatar_url: null,
      nationality: null,
      current_location: null,
      school_name: null,
      curriculum: null,
      graduation_year: null,
      target_majors: null,
      preferred_countries: null,
      activities: null,
      default_resume_id: null,
    };
    const { error: insertError } = await supabase.from("profiles").insert(blank);
    if (insertError) throw new Error(insertError.message);
    return blank;
  }

  return data as ProfileRow;
}

export async function updateProfile(
  userId: string,
  fields: Partial<Omit<ProfileRow, "id">>
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");
  if (user.id !== userId) throw new Error("Unauthorized");

  // Only pass through allowlisted fields to prevent mass assignment (D4)
  const safeFields = Object.fromEntries(
    Object.entries(fields).filter(([key]) =>
      ALLOWED_PROFILE_UPDATE_FIELDS.has(key as keyof Omit<ProfileRow, "id">)
    )
  );

  const { error } = await supabase
    .from("profiles")
    .update(safeFields)
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

// ── Activities ────────────────────────────────────────────────────────────────

export async function fetchActivities(): Promise<string[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .select("activities")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.activities as string[] | null) ?? [];
}

export async function updateActivities(activities: string[]): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ activities })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
}

export async function setDefaultResumeId(resumeId: string | null): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ default_resume_id: resumeId })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
}

// ── Majors ────────────────────────────────────────────────────────────────────

export async function fetchMajorNames(): Promise<string[]> {
  const { data, error } = await supabase
    .from("majors")
    .select("name")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.name as string);
}

// ── Standardised test scores ───────────────────────────────────────────────────

export async function fetchTestScores(
  profileId: string
): Promise<StandardisedTestScore[]> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");
  if (user.id !== profileId) throw new Error("Unauthorized");

  // Single query using embedded relation — avoids a second round-trip
  const { data: scores, error: scoresError } = await supabase
    .from("standardised_test_scores")
    .select("*, standardised_test_subjects(*)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });

  if (scoresError) throw new Error(scoresError.message);
  if (!scores?.length) return [];

  return scores.map((score) => ({
    ...score,
    subjects: (score.standardised_test_subjects ?? []) as StandardisedTestSubjectRow[],
  })) as StandardisedTestScore[];
}

export async function saveTestScores(
  profileId: string,
  scores: StandardisedTestScore[]
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");
  if (user.id !== profileId) throw new Error("Unauthorized");

  // Fetch existing score IDs so we can delete removed ones
  const { data: existing } = await supabase
    .from("standardised_test_scores")
    .select("id")
    .eq("profile_id", profileId);

  const existingIds = new Set((existing ?? []).map((r) => r.id));
  const incomingIds = new Set(scores.map((s) => s.id));

  // Delete scores that were removed
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
  if (toDelete.length) {
    const { error } = await supabase
      .from("standardised_test_scores")
      .delete()
      .in("id", toDelete);
    if (error) throw new Error(error.message);
  }

  for (const score of scores) {
    // Upsert the score row
    const { data: upserted, error: scoreError } = await supabase
      .from("standardised_test_scores")
      .upsert(
        {
          id: score.id,
          profile_id: profileId,
          curriculum: score.curriculum,
          cumulative_score: score.cumulative_score,
          score_scale: score.score_scale,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("id")
      .single();

    if (scoreError) throw new Error(scoreError.message);
    const scoreId = upserted.id;

    // Replace subjects: delete all then re-insert
    await supabase
      .from("standardised_test_subjects")
      .delete()
      .eq("test_score_id", scoreId);

    if (score.subjects.length) {
      const { error: subError } = await supabase
        .from("standardised_test_subjects")
        .insert(
          score.subjects.map((sub) => ({
            test_score_id: scoreId,
            subject_name: sub.subject_name,
            grade: sub.grade,
          }))
        );
      if (subError) throw new Error(subError.message);
    }
  }
}
