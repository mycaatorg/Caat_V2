import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Major } from "@/types/majors";

// C13: the majors list is small (~90 rows) and global (changes rarely), but the
// page fetched `select("*")` uncached on every view. Select only the columns the
// list renders and cache the result (revalidate 1h). Uses a plain anon client
// (no cookies) so it can live in unstable_cache; majors are anon-readable.
export const getMajorsList = unstable_cache(
  async (): Promise<Major[]> => {
    const sb = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data } = await sb
      .from("majors")
      .select("id, name, category, description, career_paths, typical_coursework, qs_ranking_url, created_at")
      .order("name", { ascending: true });
    return (data ?? []) as Major[];
  },
  ["majors-list-with-comparison-v2"],
  { revalidate: 3600, tags: ["majors-catalog"] },
);
