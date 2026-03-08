// components/resume-builder/api.ts
import { supabase } from "@/src/lib/supabaseClient";
import type {
        ResumeRow,
        ResumeSectionRow,
        ResumeSectionState,
        ResumeState,
        SaveResumePayload,
        SectionType,
        SectionMode,
} from "./types";

/* ---------------------------
   Small helpers: map DB to UI
---------------------------- */

function rowToState(row: ResumeSectionRow): ResumeSectionState {
        return {
                id: row.id,
                type: row.section_key as SectionType,
                label: row.label,
                mode: row.mode as SectionMode,
                contentHtml: row.content_html,
                structuredData: row.structured_data ?? undefined,
                sortOrder: row.sort_order,
        };
}

function payloadSectionToRow(
        resumeId: string,
        s: SaveResumePayload["sections"][number]
): Partial<ResumeSectionRow> {
        return {
                id: s.id,
                resume_id: resumeId,
                section_key: s.type,
                label: s.label,
                mode: s.mode,
                content_html: s.contentHtml,
                structured_data: s.structuredData ?? null,
                sort_order: s.sortOrder,
        };
}

/* ---------------------------
   Auth
---------------------------- */

export async function requireUserId(): Promise<string> {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw new Error(error.message);

        const userId = data.user?.id;
        if (!userId) throw new Error("Not authenticated");

        return userId;
}

/* ---------------------------
   Load: get-or-create resume + sections
---------------------------- */

/** List all resumes for the current user (for switcher). */
export async function listResumes(): Promise<Pick<ResumeRow, "id" | "title" | "created_at">[]> {
	const userId = await requireUserId();
	const { data, error } = await supabase
		.from("resumes")
		.select("id, title, created_at")
		.eq("user_id", userId)
		.order("created_at", { ascending: false });

	if (error) throw new Error(error.message);
	return (data ?? []) as Pick<ResumeRow, "id" | "title" | "created_at">[];
}

/** Load a specific resume by id (sections included). */
export async function loadResumeById(resumeId: string): Promise<ResumeState | null> {
	const userId = await requireUserId();

	const { data: resume, error: resumeErr } = await supabase
		.from("resumes")
		.select("*")
		.eq("id", resumeId)
		.eq("user_id", userId)
		.maybeSingle();

	if (resumeErr || !resume) return null;

	const { data: sectionRows, error: secErr } = await supabase
		.from("resume_sections")
		.select("*")
		.eq("resume_id", resumeId)
		.order("sort_order", { ascending: true });

	if (secErr) throw new Error(secErr.message);

	return {
		resumeId: (resume as ResumeRow).id,
		title: (resume as ResumeRow).title ?? "Untitled",
		template: (resume as ResumeRow).template ?? null,
		sections: (sectionRows ?? []).map(rowToState),
	};
}

/** Create a new resume and return its state (with no sections or default sections). */
export async function createResume(title?: string): Promise<ResumeState> {
	const userId = await requireUserId();

	const { data: created, error } = await supabase
		.from("resumes")
		.insert({
			user_id: userId,
			title: title ?? "New Resume",
			template: null,
		})
		.select("*")
		.single();

	if (error) throw new Error(error.message);
	const resume = created as ResumeRow;

	return {
		resumeId: resume.id,
		title: resume.title ?? "New Resume",
		template: resume.template ?? null,
		sections: [],
	};
}

export async function loadOrCreateResumeState(): Promise<ResumeState> {
        const userId = await requireUserId();

        // 1) Try to get the user's first resume
        const { data: foundResume, error: findErr } = await supabase
                .from("resumes")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle();

        if (findErr) throw new Error(findErr.message);

        // 2) Create if missing
        const resume: ResumeRow =
                foundResume ??
                (await (async () => {
                        const { data: created, error: createErr } = await supabase
                                .from("resumes")
                                .insert({
                                        user_id: userId,
                                        title: "Main Resume",
                                        template: null,
                                })
                                .select("*")
                                .single();

                        if (createErr) throw new Error(createErr.message);
                        return created as ResumeRow;
                })());

        // 3) Load sections ordered by sort_order
        const { data: sectionRows, error: secErr } = await supabase
                .from("resume_sections")
                .select("*")
                .eq("resume_id", resume.id)
                .order("sort_order", { ascending: true });

        if (secErr) throw new Error(secErr.message);

        return {
                resumeId: resume.id,
                title: resume.title ?? "Main Resume",
                
                template: resume.template ?? null,
                sections: (sectionRows ?? []).map(rowToState),
        };
}

/* ---------------------------
   Save: update resume + upsert sections
---------------------------- */

export async function saveResumeState(payload: SaveResumePayload): Promise<void> {
        const userId = await requireUserId();

        // 1) Update resume metadata (scoped to this user)
        const { error: resumeErr } = await supabase
                .from("resumes")
                .update({
                        title: payload.title,
                        template: payload.template ?? null,
                })
                .eq("id", payload.resumeId)
                .eq("user_id", userId);

        if (resumeErr) throw new Error(resumeErr.message);

        // 2) Upsert all sections (content + structured_data + sort_order)
        const rows = payload.sections.map((s) => payloadSectionToRow(payload.resumeId, s));

        const { error: secErr } = await supabase
                .from("resume_sections")
                .upsert(rows, { onConflict: "id" });

        if (secErr) throw new Error(secErr.message);
}

/* ---------------------------
   Delete
---------------------------- */

export async function deleteSection(sectionId: string): Promise<void> {
        const { error } = await supabase
                .from("resume_sections")
                .delete()
                .eq("id", sectionId);

        if (error) throw new Error(error.message);
}

/** Delete a whole resume and its sections (user-scoped). */
export async function deleteResume(resumeId: string): Promise<void> {
	const userId = await requireUserId();

	const { error: secErr } = await supabase
		.from("resume_sections")
		.delete()
		.eq("resume_id", resumeId);
	if (secErr) throw new Error(secErr.message);

	const { error: resumeErr } = await supabase
		.from("resumes")
		.delete()
		.eq("id", resumeId)
		.eq("user_id", userId);
	if (resumeErr) throw new Error(resumeErr.message);
}
