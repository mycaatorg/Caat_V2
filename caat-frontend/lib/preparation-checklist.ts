/**
 * The preparation checklist for one application (PROD-147). One rule, used by
 * the application hub, the applications list and the dashboard summary, so
 * all three always show the same steps and the same score.
 *
 * It tracks what the student has prepared in CAAT for THIS application. It
 * never says the application was sent: the student's own status does that,
 * and the status is not a step here.
 *
 * "Shared" means school_id is null: the essays and documents tools use null
 * for a draft or file that applies to every application.
 */

export const PREP_STEP_COUNT = 3;

export const PREP_STEP_LABELS = {
  deadline: "Deadline is set",
  essay: "An essay drafted for this school or shared",
  documents: "A document attached here or a shared key document",
} as const;

export const PREP_CHECKLIST_TITLE = "Preparation checklist";

/** Shared document categories that count for every application. */
export const KEY_DOC_CATEGORIES: { category: string; label: string }[] = [
  { category: "transcripts", label: "Academic transcript" },
  { category: "identity", label: "Passport / ID" },
  { category: "language", label: "Language proficiency" },
  { category: "letters", label: "Recommendation letter" },
];
const KEY_DOC_CATEGORY_SET = new Set(KEY_DOC_CATEGORIES.map((d) => d.category));

export interface PrepPrompt {
  id: string;
  scope: string | null;
}
export interface PrepDraft {
  prompt_id: string;
  school_id: number | null;
}
export interface PrepDocument {
  category: string;
  school_id: number | null;
}

/** The student's essay prompts, drafts and documents, loaded once. */
export interface PreparationInputs {
  prompts: PrepPrompt[];
  drafts: PrepDraft[];
  documents: PrepDocument[];
}

export const EMPTY_PREPARATION_INPUTS: PreparationInputs = { prompts: [], drafts: [], documents: [] };

export interface PreparationChecklist {
  deadlineSet: boolean;
  /** an essay drafted for this school (per-school prompt) or a shared prompt */
  essayDrafted: boolean;
  /** a document attached to this application, or a shared key document */
  keyDocsUploaded: boolean;
  /** 0 to PREP_STEP_COUNT */
  score: number;
}

/** Whether a prompt is shared across applications (default: per school). */
export function isSharedPrompt(prompt: PrepPrompt): boolean {
  return (prompt.scope ?? "per_school") === "shared";
}

/** Whether a draft is the one the hub shows for this prompt and school: a
 *  per-school prompt's draft tagged to THIS school, or a shared prompt's
 *  untagged draft. */
export function draftCountsFor(prompt: PrepPrompt, draft: PrepDraft, schoolId: number): boolean {
  if (draft.prompt_id !== prompt.id) return false;
  return isSharedPrompt(prompt) ? draft.school_id == null : draft.school_id === schoolId;
}

export function essayDraftedFor(schoolId: number, inputs: Pick<PreparationInputs, "prompts" | "drafts">): boolean {
  return inputs.prompts.some((p) => inputs.drafts.some((d) => draftCountsFor(p, d, schoolId)));
}

export function documentsReadyFor(schoolId: number, documents: PrepDocument[]): boolean {
  return documents.some(
    (d) => d.school_id === schoolId || (d.school_id == null && KEY_DOC_CATEGORY_SET.has(d.category))
  );
}

export function prepScore(steps: Pick<PreparationChecklist, "deadlineSet" | "essayDrafted" | "keyDocsUploaded">): number {
  return (steps.deadlineSet ? 1 : 0) + (steps.essayDrafted ? 1 : 0) + (steps.keyDocsUploaded ? 1 : 0);
}

export function preparationFor(
  application: { school_id: number; deadline_at: string | null },
  inputs: PreparationInputs
): PreparationChecklist {
  const steps = {
    deadlineSet: !!application.deadline_at,
    essayDrafted: essayDraftedFor(application.school_id, inputs),
    keyDocsUploaded: documentsReadyFor(application.school_id, inputs.documents),
  };
  return { ...steps, score: prepScore(steps) };
}

/** "2 of 3 steps": the one score wording, everywhere. */
export function prepScoreLabel(score: number): string {
  return `${score} of ${PREP_STEP_COUNT} steps`;
}
