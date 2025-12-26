export type SectionType =
  | "personal"
  | "education"
  | "experience"
  | "skills"
  | "custom";

export type SectionMode = "guided" | "free";

export type ResumeSection = {
  id: string;
  type: SectionType;
  label: string;
  mode: SectionMode;

  contentHtml: string;

  // Only used when mode is guided
  structuredData?: Record<string, any>;
};

export type ResumeRow = {
        id: string;                 // uuid
        user_id: string;            // uuid (auth.users.id)
        title: string | null;
        template: string | null;
        created_at: string;         // timestamptz ISO string
        updated_at: string;         // timestamptz ISO string
};

export type ResumeSectionRow = {
        id: string;                 // uuid
        resume_id: string;          // uuid -> resumes.id
        section_key: string;        // text ( store SectionType values here)
        label: string;              // text
        content_html: string;       // text
        mode: string;               // text (store SectionMode values here)
        sort_order: number;         // int4
        structured_data: Record<string, any> | null;
        created_at: string;         // timestamptz ISO string
        updated_at: string;         // timestamptz ISO string
};

/**
 * What the builder shell will keep in state.
 * (Same as ResumeSection but with sortOrder because db needs it)
 */
export type ResumeSectionState = ResumeSection & {
        sortOrder: number;
};

/**
 * Full resume state what you load into the page).
 */
export type ResumeState = {
        resumeId: string;
        title: string;
        template: string | null;
        sections: ResumeSectionState[];
};


export type SaveResumePayload = {
        resumeId: string;
        title: string;
        template?: string | null;
        sections: Array<{
                id: string;                 // existing section uuid (or temp id tht gets map)
                type: SectionType;
                label: string;
                mode: SectionMode;
                contentHtml: string;
                structuredData?: Record<string, any>;
                sortOrder: number;
        }>;
};