import { supabase } from "@/src/lib/supabaseClient";

export interface UserScholarship {
  id: string;
  user_id: string;
  title: string;
  provider_name: string;
  description: string | null;
  amount_display: string | null;
  amount_value: number | null;
  amount_currency: string;
  awards_count: number | null;
  frequency: string | null;
  study_level: string[];
  funding_type: string[];
  eligible_countries: string[];
  country: string | null;
  deadline_at: string | null;
  external_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type UserScholarshipInput = {
  title: string;
  provider_name: string;
  description?: string | null;
  amount_display?: string | null;
  amount_value?: number | null;
  amount_currency?: string;
  awards_count?: number | null;
  frequency?: string | null;
  study_level?: string[];
  funding_type?: string[];
  eligible_countries?: string[];
  country?: string | null;
  deadline_at?: string | null;
  external_url?: string | null;
  notes?: string | null;
};

export async function fetchUserScholarships(): Promise<UserScholarship[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_scholarships")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addUserScholarship(
  input: UserScholarshipInput,
): Promise<UserScholarship> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_scholarships")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserScholarship(
  id: string,
  input: Partial<UserScholarshipInput>,
): Promise<UserScholarship> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_scholarships")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteUserScholarship(id: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_scholarships")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}
