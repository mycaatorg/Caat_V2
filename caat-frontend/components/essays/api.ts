import { supabase } from "@/src/lib/supabaseClient";

export type EssayPrompt = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tips: string | null;
  sort_order: number;
};

export type EssayDraft = {
  id: string;
  user_id: string;
  prompt_id: string;
  prompt_slug: string;
  label: string | null;
  content: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchEssayPrompts() {
  const { data, error } = await supabase
    .from("essay_prompts")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data as EssayPrompt[];
}

export async function fetchCurrentDraft(promptId: string) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("essay_drafts")
    .select("*")
    .eq("user_id", user.id)
    .eq("prompt_id", promptId)
    .eq("is_current", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as EssayDraft | null;
}

export async function upsertCurrentDraft(args: {
  promptId: string;
  promptSlug: string;
  content: string;
  label?: string;
}) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not signed in");

  // Try to find existing current draft
  const { data: existing, error: existingError } = await supabase
    .from("essay_drafts")
    .select("id")
    .eq("user_id", user.id)
    .eq("prompt_id", args.promptId)
    .eq("is_current", true)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await supabase
      .from("essay_drafts")
      .update({
        content: args.content,
        label: args.label ?? null,
        prompt_slug: args.promptSlug,
      })
      .eq("id", existing.id);

    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("essay_drafts")
    .insert({
      user_id: user.id,
      prompt_id: args.promptId,
      prompt_slug: args.promptSlug,
      content: args.content,
      label: args.label ?? "Draft 1",
      is_current: true,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to create draft");
  return data.id as string;
}

/* ---------------------------
   List all drafts for a prompt (for switcher UI)
---------------------------- */

export async function fetchDraftsForPrompt(promptId: string): Promise<EssayDraft[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("essay_drafts")
    .select("*")
    .eq("user_id", user.id)
    .eq("prompt_id", promptId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as EssayDraft[];
}

/* ---------------------------
   Update a specific draft (save content or rename label)
---------------------------- */

export async function updateDraft(
  draftId: string,
  patch: { content?: string; label?: string | null }
): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not signed in");

  const updates: { content?: string; label?: string | null } = {};
  if (patch.content !== undefined) updates.content = patch.content;
  if (patch.label !== undefined) updates.label = patch.label;

  const { error } = await supabase
    .from("essay_drafts")
    .update(updates)
    .eq("id", draftId)
    .eq("user_id", user.id);

  if (error) throw error;
}

/* ---------------------------
   Create a new draft for a prompt (sets it as current)
---------------------------- */

export async function createDraft(args: {
  promptId: string;
  promptSlug: string;
  label?: string;
}): Promise<EssayDraft> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not signed in");

  // Unset current on all other drafts for this prompt so unique index holds
  await supabase
    .from("essay_drafts")
    .update({ is_current: false })
    .eq("user_id", user.id)
    .eq("prompt_id", args.promptId);

  const { data, error } = await supabase
    .from("essay_drafts")
    .insert({
      user_id: user.id,
      prompt_id: args.promptId,
      prompt_slug: args.promptSlug,
      content: "",
      label: args.label ?? "New draft",
      is_current: true,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to create draft");
  return data as EssayDraft;
}

/* ---------------------------
   Delete a draft
---------------------------- */

export async function deleteDraft(draftId: string): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("essay_drafts")
    .delete()
    .eq("id", draftId)
    .eq("user_id", user.id);

  if (error) throw error;
}