import { supabase } from "@/lib/supabase/client";
import { getClientUserId } from "@/lib/current-user";

/**
 * PROD-78 (first slice, documents only): link a document from the student's
 * library (documents) to one of their university applications, and tailor a
 * title and note for that application. Every read and write is owner-filtered
 * here and by row security, and every write targets application_evidence_links
 * only: linking, tailoring and unlinking never change or delete the document.
 * Writes select the row back and treat zero rows as a failure. A link does not
 * count toward the 3-step preparation checklist.
 */

const LINKS = "application_evidence_links";
const LINK_COLUMNS =
  "id, application_id, document_id, tailored_title, tailored_body, tailored_at, created_at, documents(id, file_name, category, status, uploaded_at)";

export const TAILORED_TITLE_MAX = 200;
export const TAILORED_BODY_MAX = 10_000;

export interface LibraryDocument {
  id: string;
  fileName: string;
  category: string;
  status: string | null;
  uploadedAt: string | null;
}

export interface EvidenceLink {
  id: string;
  applicationId: string;
  documentId: string;
  tailoredTitle: string | null;
  tailoredBody: string | null;
  /** null: the link follows the library */
  tailoredAt: string | null;
  createdAt: string;
  /** null when the document row could not be read with the link */
  document: LibraryDocument | null;
}

type DocumentRowShape = { id: string; file_name: string; category: string; status: string | null; uploaded_at: string | null };
type LinkRowShape = {
  id: string;
  application_id: string;
  document_id: string;
  tailored_title: string | null;
  tailored_body: string | null;
  tailored_at: string | null;
  created_at: string;
  documents: DocumentRowShape | null;
};

const LINK_FAILED = "Couldn't link this document. Make sure you still have it and this application, then try again.";
const UNLINK_FAILED = "Couldn't unlink this document. Try again.";
const TAILOR_FAILED = "Couldn't save this change. Try again.";
const CHANGED_ELSEWHERE = "This link changed in another tab or was removed. Reload to see the latest.";

function toDocument(d: DocumentRowShape): LibraryDocument {
  return { id: d.id, fileName: d.file_name, category: d.category, status: d.status ?? null, uploadedAt: d.uploaded_at ?? null };
}

function toLink(r: LinkRowShape): EvidenceLink {
  return {
    id: r.id,
    applicationId: r.application_id,
    documentId: r.document_id,
    tailoredTitle: r.tailored_title ?? null,
    tailoredBody: r.tailored_body ?? null,
    tailoredAt: r.tailored_at ?? null,
    createdAt: r.created_at,
    document: r.documents ? toDocument(r.documents) : null,
  };
}

async function requireUserId(): Promise<string> {
  const userId = await getClientUserId();
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/** One application's links, owner-filtered. Throws on a read error, so the
 *  card can say "unavailable" rather than "nothing linked". */
export async function readEvidenceLinks(userId: string, applicationId: string): Promise<EvidenceLink[]> {
  const { data, error } = await supabase
    .from(LINKS)
    .select(LINK_COLUMNS)
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Could not load your linked documents");
  return ((data ?? []) as unknown as LinkRowShape[]).map(toLink);
}

/** The hub card's own Retry. */
export async function fetchEvidenceLinksForApplication(applicationId: string): Promise<EvidenceLink[]> {
  return readEvidenceLinks(await requireUserId(), applicationId);
}

/** The student's documents, newest first, for the "Link a document" picker. */
export async function fetchLibraryDocuments(): Promise<LibraryDocument[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("documents")
    .select("id, file_name, category, status, uploaded_at")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error("Could not load your documents");
  return ((data ?? []) as DocumentRowShape[]).map(toDocument);
}

/** documentId -> number of applications it is linked to, from one
 *  owner-filtered query. Throws on error (never a wrong zero). */
export async function fetchDocumentUsage(): Promise<Record<string, number>> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from(LINKS)
    .select("document_id, application_id")
    .eq("user_id", userId)
    .not("document_id", "is", null);
  if (error) throw new Error("Could not load where your documents are used");
  const apps = new Map<string, Set<string>>();
  for (const r of (data ?? []) as { document_id: string; application_id: string }[]) {
    if (!apps.has(r.document_id)) apps.set(r.document_id, new Set());
    apps.get(r.document_id)!.add(r.application_id);
  }
  return Object.fromEntries([...apps].map(([id, set]) => [id, set.size]));
}

function oneRow(data: unknown, failure: string): EvidenceLink {
  const rows = (data ?? []) as LinkRowShape[];
  if (rows.length !== 1) throw new Error(failure);
  return toLink(rows[0]);
}

/** Link a library document to an application. A duplicate (for example from
 *  another tab) returns the link that already exists. */
export async function linkDocument(applicationId: string, documentId: string): Promise<EvidenceLink> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from(LINKS)
    .insert({ user_id: userId, application_id: applicationId, kind: "document", document_id: documentId })
    .select(LINK_COLUMNS);
  if (error?.code === "23505") {
    const existing = await supabase
      .from(LINKS)
      .select(LINK_COLUMNS)
      .eq("user_id", userId)
      .eq("application_id", applicationId)
      .eq("document_id", documentId);
    if (existing.error) throw new Error(LINK_FAILED);
    return oneRow(existing.data, LINK_FAILED);
  }
  if (error) throw new Error(LINK_FAILED);
  return oneRow(data, LINK_FAILED);
}

/** Remove the link only. The document stays in the library. */
export async function unlinkDocument(linkId: string): Promise<void> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from(LINKS).delete().eq("id", linkId).eq("user_id", userId).select("id");
  if (error || (data ?? []).length !== 1) throw new Error(UNLINK_FAILED);
}

/** Update the tailored_* columns of a link the caller saw at `seen.tailoredAt`.
 *  Zero rows back means it changed elsewhere: never a silent last-write-wins. */
async function writeTailoring(seen: EvidenceLink, patch: Record<string, string | null>): Promise<EvidenceLink> {
  const userId = await requireUserId();
  const base = supabase.from(LINKS).update(patch).eq("id", seen.id).eq("user_id", userId);
  const guarded = seen.tailoredAt === null ? base.is("tailored_at", null) : base.eq("tailored_at", seen.tailoredAt);
  const { data, error } = await guarded.select(LINK_COLUMNS);
  if (error) throw new Error(TAILOR_FAILED);
  return oneRow(data, CHANGED_ELSEWHERE);
}

/** Tailor a title and/or note for this application. The document is untouched. */
export function saveTailoring(seen: EvidenceLink, input: { title: string; body: string }): Promise<EvidenceLink> {
  const title = input.title.trim() || null;
  const body = input.body.trim() || null;
  if (!title && !body) {
    return Promise.reject(new Error("Add a title or a note, or use the library version instead."));
  }
  if (title && title.length > TAILORED_TITLE_MAX) {
    return Promise.reject(new Error(`Keep the title to ${TAILORED_TITLE_MAX} characters.`));
  }
  if (body && body.length > TAILORED_BODY_MAX) {
    return Promise.reject(new Error("Keep the note to 10,000 characters."));
  }
  return writeTailoring(seen, { tailored_title: title, tailored_body: body, tailored_at: new Date().toISOString() });
}

/** "Keep mine": keep the tailoring and acknowledge the newer library file. */
export function keepTailoring(seen: EvidenceLink): Promise<EvidenceLink> {
  if (seen.tailoredAt === null) return Promise.reject(new Error(TAILOR_FAILED));
  return writeTailoring(seen, { tailored_at: new Date().toISOString() });
}

/** "Use library version": clear the tailoring on this link. Never writes the document. */
export function resetToLibrary(seen: EvidenceLink): Promise<EvidenceLink> {
  return writeTailoring(seen, { tailored_title: null, tailored_body: null, tailored_at: null });
}

/** The library file was (re)uploaded after this application's tailoring.
 *  Uses documents.uploaded_at, not updated_at (a review status change bumps
 *  updated_at without changing the file). */
export function libraryUpdatedSince(link: EvidenceLink): boolean {
  if (!link.tailoredAt || !link.document?.uploadedAt) return false;
  const uploaded = Date.parse(link.document.uploadedAt);
  const tailored = Date.parse(link.tailoredAt);
  return Number.isFinite(uploaded) && Number.isFinite(tailored) && uploaded > tailored;
}

export function linkTitle(link: EvidenceLink): string {
  return link.tailoredTitle ?? link.document?.fileName ?? "Document unavailable";
}
