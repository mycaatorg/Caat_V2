import { supabase } from "@/src/lib/supabaseClient";
import type { ApplicationRow, ApplicationStatus } from "@/types/applications";

async function getUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return user;
}

export async function fetchApplications(): Promise<ApplicationRow[]> {
  const user = await getUser();
  const { data, error } = await supabase
    .from("user_school_applications")
    .select("*, schools(id, name, country)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ApplicationRow[];
}

export async function fetchApplicationForSchool(
  schoolId: number
): Promise<ApplicationRow | null> {
  const user = await getUser();
  const { data, error } = await supabase
    .from("user_school_applications")
    .select("*, schools(id, name, country)")
    .eq("user_id", user.id)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as ApplicationRow | null;
}

export async function addApplication(
  schoolId: number
): Promise<ApplicationRow> {
  const user = await getUser();
  const { data, error } = await supabase
    .from("user_school_applications")
    .insert({ user_id: user.id, school_id: schoolId, status: "researching" })
    .select("*, schools(id, name, country)")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ApplicationRow;
}

export async function updateApplication(
  id: string,
  patch: {
    status?: ApplicationStatus;
    deadline_at?: string | null;
    notes?: string | null;
  }
): Promise<void> {
  const user = await getUser();
  const { error } = await supabase
    .from("user_school_applications")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function deleteApplication(id: string): Promise<void> {
  const user = await getUser();
  const { error } = await supabase
    .from("user_school_applications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function searchSchools(
  query: string
): Promise<{ id: number; name: string; country: string | null }[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, country")
    .ilike("name", `%${query}%`)
    .order("name", { ascending: true })
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: number; name: string; country: string | null }[];
}
