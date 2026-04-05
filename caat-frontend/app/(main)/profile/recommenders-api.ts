import { supabase } from "@/src/lib/supabaseClient";
import type { RecommenderRow, RecommenderStatus } from "@/types/profile";

async function getUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return user;
}

export async function fetchRecommenders(): Promise<RecommenderRow[]> {
  const user = await getUser();
  const { data, error } = await supabase
    .from("user_recommenders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RecommenderRow[];
}

export async function addRecommender(fields: {
  name: string;
  subject?: string;
  status: RecommenderStatus;
  notes?: string;
}): Promise<RecommenderRow> {
  const user = await getUser();
  const { data, error } = await supabase
    .from("user_recommenders")
    .insert({ user_id: user.id, ...fields })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RecommenderRow;
}

export async function updateRecommender(
  id: string,
  patch: {
    name?: string;
    subject?: string;
    status?: RecommenderStatus;
    notes?: string;
  }
): Promise<void> {
  const user = await getUser();
  const { error } = await supabase
    .from("user_recommenders")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function deleteRecommender(id: string): Promise<void> {
  const user = await getUser();
  const { error } = await supabase
    .from("user_recommenders")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}
