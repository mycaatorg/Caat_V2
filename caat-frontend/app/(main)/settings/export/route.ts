import { evidencePages } from "@/lib/evidence-pagination";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

import { accountExportCollections } from "@/lib/account-export-collections";

const NO_STORE = { "Cache-Control": "no-store" };
const EXPORT_ERROR = "Could not export your data. Please try again.";

/** Read child rows only through the caller's owned parent IDs. Bound the URL
 * size as well as the response size; a failed batch aborts the whole export. */
async function childRows<T>(ids: string[], fetchPage: (ids: string[], from: number, to: number) => PromiseLike<{data: T[] | null; error: unknown}>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    rows.push(...await evidencePages((from, to) => fetchPage(batch, from, to), EXPORT_ERROR));
  }
  return rows;
}

// Account records and text, not uploaded file binaries or authentication data.
// Every query is owner-scoped directly or through already-owned parent IDs.
export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: NO_STORE });
    }

    const uid = user.id;

    const data: Record<string, unknown> = {};
    data.profile = await evidencePages((from, to) => supabase.from("profiles").select("*").eq("id", uid).order("id").range(from, to), EXPORT_ERROR);

    const scores = await evidencePages((from, to) => supabase.from("standardised_test_scores").select("*").eq("profile_id", uid).order("id").range(from, to), EXPORT_ERROR);
    data.standardised_test_scores = scores;
    data.standardised_test_subjects = await childRows(scores.map(s => s.id), (ids, from, to) =>
      supabase.from("standardised_test_subjects").select("*").in("test_score_id", ids).order("id").range(from, to));

    const resumes = await evidencePages((from, to) => supabase.from("resumes").select("*").eq("user_id", uid).order("id").range(from, to), EXPORT_ERROR);
    data.resumes = resumes;
    data.resume_sections = await childRows(resumes.map(r => r.id), (ids, from, to) =>
      supabase.from("resume_sections").select("*").in("resume_id", ids).order("id").range(from, to));

    for (const { table, owner, order } of accountExportCollections) {
      data[table] = await evidencePages((from, to) => {
        // The manifest checks each owner column against its own table type.
        // filter accepts that union without widening the client to `any`.
        let query = supabase.from(table).select("*").filter(owner, "eq", uid);
        for (const column of order) query = query.order(column);
        return query.range(from, to);
      }, EXPORT_ERROR);
    }

    const payload = {
      export_version: 1,
      scope: {
        includes: "Your profile, saved opportunities, workspace records and readable community activity. Document records are included; uploaded files are not bundled. Notifications addressed to you may mention other people.",
        excludes: ["uploaded_file_contents", "authentication_secrets", "moderation_reports", "unrelated_users_records"],
        pagination: "Each query is limited to 1,000 page requests, including its final empty page. A failed or incomplete query cancels the download.",
        consistency: "Current account data; edits made while the download is being prepared may affect its contents.",
      },
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
    return NextResponse.json({ error: EXPORT_ERROR }, { status: 500, headers: NO_STORE });
  }
}
