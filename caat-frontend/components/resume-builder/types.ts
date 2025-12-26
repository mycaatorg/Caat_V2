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
