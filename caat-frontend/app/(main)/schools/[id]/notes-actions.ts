"use server";

import { createSupabaseServer } from "@/lib/supabase-server";

const NOTES_MAX_LENGTH = 5000;

export interface SchoolNote {
  notes: string;
  updated_at: string | null;
}

/**
 * Fetch the current user's note for a school. Returns an empty note
 * (notes: "", updated_at: null) when there is no row yet so the client
 * doesn't have to special-case "first time" loading.
 */
export async function fetchSchoolNoteAction(
  schoolId: number,
): Promise<{ note: SchoolNote; error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { note: { notes: "", updated_at: null }, error: "Not signed in" };
  }

  const { data, error } = await supabase
    .from("user_school_notes")
    .select("notes, updated_at")
    .eq("user_id", user.id)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    return {
      note: { notes: "", updated_at: null },
      error: "Could not load note.",
    };
  }
  return {
    note: { notes: data?.notes ?? "", updated_at: data?.updated_at ?? null },
    error: null,
  };
}

/**
 * Upsert the current user's note for a school. Empty / whitespace-only
 * content deletes the row so the database doesn't accumulate empty rows
 * for every school a user briefly visits.
 */
export async function saveSchoolNoteAction(
  schoolId: number,
  notes: string,
): Promise<{ updated_at: string | null; error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { updated_at: null, error: "Not signed in" };

  if (typeof notes !== "string") {
    return { updated_at: null, error: "Invalid note." };
  }
  if (notes.length > NOTES_MAX_LENGTH) {
    return {
      updated_at: null,
      error: `Notes must be ${NOTES_MAX_LENGTH} characters or fewer.`,
    };
  }

  const trimmed = notes.trim();

  // Empty note → delete the row entirely.
  if (trimmed.length === 0) {
    const { error } = await supabase
      .from("user_school_notes")
      .delete()
      .eq("user_id", user.id)
      .eq("school_id", schoolId);
    if (error) return { updated_at: null, error: "Could not save note." };
    return { updated_at: null, error: null };
  }

  const { data, error } = await supabase
    .from("user_school_notes")
    .upsert(
      {
        user_id: user.id,
        school_id: schoolId,
        notes,
      },
      { onConflict: "user_id,school_id" },
    )
    .select("updated_at")
    .single();

  if (error) return { updated_at: null, error: "Could not save note." };
  return { updated_at: data.updated_at, error: null };
}
