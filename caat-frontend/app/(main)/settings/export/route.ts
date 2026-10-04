import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

async function checkedQuery<T>(
  query: PromiseLike<{ data: T | null; error: unknown | null }>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// F5 - Data export. Streams a single JSON document of everything the signed-in
// user owns, as a file download. Every query is scoped to the caller's own id
// (defense in depth alongside RLS) so the export can only ever contain the
// requester's own rows.
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const uid = user.id;

  try {
    // Tables keyed by the column that identifies the owner.
    const byUserId = [
      "calendar_events",
      "user_todos",
      "user_recommenders",
      "user_scholarships",
      "user_school_applications",
      "user_school_notes",
      "user_bookmarked_schools",
      "user_bookmarked_scholarships",
      "user_bookmarked_majors",
      "custom_essay_prompts",
      "essay_drafts",
      "documents",
      "dashboard_layouts",
      "user_dashboard_widgets",
      "community_posts",
      "community_comments",
      "community_group_members",
      "notifications",
    ] as const;

    const data: Record<string, unknown> = {};

    // Profile (owner column is `id`).
    const profile = await checkedQuery(
      supabase.from("profiles").select("*").eq("id", uid),
    );
    data.profile = profile ?? [];

    // Standardised tests + their subjects (subjects are scoped through the scores).
    const scores = await checkedQuery(
      supabase.from("standardised_test_scores").select("*").eq("profile_id", uid),
    ) ?? [];
    data.standardised_test_scores = scores ?? [];
    const scoreIds = (scores ?? []).map((s) => s.id);
    data.standardised_test_subjects = scoreIds.length
      ? (await checkedQuery(
          supabase.from("standardised_test_subjects").select("*").in("test_score_id", scoreIds),
        )) ?? []
      : [];

    // Resumes + their sections (sections scoped through the user's resumes).
    const resumes = await checkedQuery(
      supabase.from("resumes").select("*").eq("user_id", uid),
    ) ?? [];
    data.resumes = resumes ?? [];
    const resumeIds = (resumes ?? []).map((r) => r.id);
    data.resume_sections = resumeIds.length
      ? (await checkedQuery(
          supabase.from("resume_sections").select("*").in("resume_id", resumeIds),
        )) ?? []
      : [];

    // Community groups the user created.
    data.community_groups = await checkedQuery(
      supabase.from("community_groups").select("*").eq("creator_id", uid),
    ) ?? [];

    // Everything keyed by user_id.
    for (const table of byUserId) {
      data[table] = await checkedQuery(supabase.from(table).select("*").eq("user_id", uid)) ?? [];
    }

    const payload = {
      export_version: 1,
      generated_at: new Date().toISOString(),
      account: { id: user.id, email: user.email },
      data,
    };

    const filename = `caat-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not export your data. Please try again." }, { status: 500 });
  }
}
