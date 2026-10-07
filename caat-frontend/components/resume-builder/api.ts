// components/resume-builder/api.ts
import { supabase } from "@/lib/supabase/client";
import { sanitizeError } from "@/lib/safe-error";
import type {
        ResumeRow,
        ResumeSectionRow,
        ResumeSectionState,
        ResumeState,
        SaveResumePayload,
        SectionType,
        SectionMode,
} from "./types";
import { coerceSettings, DEFAULT_SETTINGS } from "./settings";
import type { TablesInsert, TablesUpdate } from "@/types/database";

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
        if (error) throw new Error(sanitizeError(error));

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

	if (error) throw new Error(sanitizeError(error));
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

	if (secErr) throw new Error(sanitizeError(secErr));

	return {
		resumeId: (resume as ResumeRow).id,
		title: (resume as ResumeRow).title ?? "Untitled",
		template: (resume as ResumeRow).template ?? null,
		settings: coerceSettings((resume as ResumeRow).settings),
		sections: (((sectionRows ?? []) as unknown as ResumeSectionRow[]).map(rowToState)),
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

	if (error) throw new Error(sanitizeError(error));
	const resume = created as ResumeRow;

	return {
		resumeId: resume.id,
		title: resume.title ?? "New Resume",
		template: resume.template ?? null,
		settings: { ...DEFAULT_SETTINGS },
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

        if (findErr) throw new Error(sanitizeError(findErr));

        // 2) Create if missing
        const resume: ResumeRow =
                (foundResume as unknown as ResumeRow | null) ??
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

                        if (createErr) throw new Error(sanitizeError(createErr));
                        return created as unknown as ResumeRow;
                })());

        // 3) Load sections ordered by sort_order
        const { data: sectionRows, error: secErr } = await supabase
                .from("resume_sections")
                .select("*")
                .eq("resume_id", resume.id)
                .order("sort_order", { ascending: true });

        if (secErr) throw new Error(sanitizeError(secErr));

        return {
                resumeId: resume.id,
                title: resume.title ?? "Main Resume",
                template: resume.template ?? null,
                settings: coerceSettings(resume.settings),
                sections: (((sectionRows ?? []) as unknown as ResumeSectionRow[]).map(rowToState)),
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

        if (resumeErr) throw new Error(sanitizeError(resumeErr));

        // 1b) Best-effort: persist resume-level settings. Tolerates the `settings`
        //     column not existing yet (pre-migration) so saving never breaks —
        //     the rest of the resume still saves; settings just won't persist.
        if (payload.settings !== undefined) {
                const { error: settingsErr } = await supabase
                        .from("resumes")
                        // `settings` is an optional column that may not exist pre-migration,
                        // so it is not in the generated schema. Cast to write it best-effort.
                        .update({ settings: payload.settings } as unknown as TablesUpdate<"resumes">)
                        .eq("id", payload.resumeId)
                        .eq("user_id", userId);
                if (settingsErr && process.env.NODE_ENV !== "production") {
                        console.warn(
                                "Resume settings not persisted (run the `settings jsonb` migration on resumes?):",
                                settingsErr.message
                        );
                }
        }

        // 2) Verify any existing section IDs in the payload actually belong to
        //    this resume — prevents overwriting another user's sections via
        //    crafted section UUIDs (B3).
        const rows = payload.sections.map((s) => payloadSectionToRow(payload.resumeId, s));
        const existingIds = rows.map((r) => r.id).filter((id): id is string => !!id);

        if (existingIds.length > 0) {
                const { data: existing } = await supabase
                        .from("resume_sections")
                        .select("id, resume_id")
                        .in("id", existingIds);

                const foreign = (existing ?? []).filter(
                        (s) => s.resume_id !== payload.resumeId
                );
                if (foreign.length > 0) throw new Error("Not authorized");
        }

        // 3) Upsert all sections (content + structured_data + sort_order)
        const { error: secErr } = await supabase
                .from("resume_sections")
                .upsert(rows as unknown as TablesInsert<"resume_sections">[], { onConflict: "id" });

        if (secErr) throw new Error(sanitizeError(secErr));
}

/* ---------------------------
   Delete
---------------------------- */

export async function deleteSection(sectionId: string): Promise<void> {
        const userId = await requireUserId();

        // Verify the section belongs to a resume owned by this user (B1)
        const { data: section, error: fetchErr } = await supabase
                .from("resume_sections")
                .select("resume_id")
                .eq("id", sectionId)
                .maybeSingle();

        if (fetchErr) throw new Error(sanitizeError(fetchErr));
        // No row: the section was never saved (removed inside the autosave
        // window, or after its save failed). There is nothing left to delete.
        if (!section) return;

        const { data: resume, error: resumeErr } = await supabase
                .from("resumes")
                .select("id")
                .eq("id", section.resume_id)
                .eq("user_id", userId)
                .maybeSingle();

        if (resumeErr || !resume) throw new Error("Not authorized");

        const { error } = await supabase
                .from("resume_sections")
                .delete()
                .eq("id", sectionId);

        if (error) throw new Error(sanitizeError(error));
}

/** Delete a whole resume and its sections (user-scoped). */
export async function deleteResume(resumeId: string): Promise<void> {
	const userId = await requireUserId();

	// Verify the resume belongs to this user before deleting anything (B2)
	const { data: resume, error: checkErr } = await supabase
		.from("resumes")
		.select("id")
		.eq("id", resumeId)
		.eq("user_id", userId)
		.maybeSingle();

	if (checkErr || !resume) throw new Error("Resume not found");

	const { error: secErr } = await supabase
		.from("resume_sections")
		.delete()
		.eq("resume_id", resumeId);
	if (secErr) throw new Error(sanitizeError(secErr));

	const { error: resumeErr } = await supabase
		.from("resumes")
		.delete()
		.eq("id", resumeId)
		.eq("user_id", userId);
	if (resumeErr) throw new Error(sanitizeError(resumeErr));
}
