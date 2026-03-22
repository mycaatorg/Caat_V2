import { supabase } from "@/src/lib/supabaseClient";
import type {
  ProfileRow,
  StandardisedTestScore,
  StandardisedTestSubjectRow,
} from "@/types/profile";

// ── Profile ────────────────────────────────────────────────────────────────────

export async function fetchProfile(): Promise<ProfileRow> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, email, birth_date, phone, linkedin, github, avatar_url, nationality, current_location, school_name, curriculum, graduation_year, target_majors, preferred_countries"
    )
    .eq("id", user.id)
    .single();

  if (error) throw new Error(error.message);
  return data as ProfileRow;
}

export async function updateProfile(
  userId: string,
  fields: Partial<Omit<ProfileRow, "id">>
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", userId);

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
  const { data: scores, error: scoresError } = await supabase
    .from("standardised_test_scores")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });

  if (scoresError) throw new Error(scoresError.message);
  if (!scores?.length) return [];

  const scoreIds = scores.map((s) => s.id);

  const { data: subjects, error: subjectsError } = await supabase
    .from("standardised_test_subjects")
    .select("*")
    .in("test_score_id", scoreIds)
    .order("created_at", { ascending: true });

  if (subjectsError) throw new Error(subjectsError.message);

  return scores.map((score) => ({
    ...score,
    subjects: (subjects ?? []).filter(
      (sub) => sub.test_score_id === score.id
    ) as StandardisedTestSubjectRow[],
  })) as StandardisedTestScore[];
}

export async function saveTestScores(
  profileId: string,
  scores: StandardisedTestScore[]
): Promise<void> {
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
