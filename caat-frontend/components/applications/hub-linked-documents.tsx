"use client";

import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Link2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TAILORED_BODY_MAX,
  TAILORED_TITLE_MAX,
  fetchLibraryDocuments,
  keepTailoring,
  libraryUpdatedSince,
  linkDocument,
  linkTitle,
  resetToLibrary,
  saveTailoring,
  unlinkDocument,
  type EvidenceLink,
  type LibraryDocument,
} from "@/lib/evidence-links";

const MAROON = "text-[#9a1a27] dark:text-[#e06b78]";

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-code text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70 mb-2.5">
      {children}
    </div>
  );
}

const LINK_COPY =
  "Linking reuses a file from your Documents for this application. It doesn't upload anything new or send anything to the university.";

/**
 * PROD-78 (documents slice): documents from the student's library linked to
 * this application, on the hub's Documents card. Each link can carry a title
 * and note tailored for this application; tailoring, Keep mine and Use library
 * version write the link only, and Unlink removes the link only (the file
 * stays in Documents). Writes are not optimistic. A failed read shows Retry,
 * never "nothing linked". None of this changes the 3-step preparation score.
 */
export function HubLinkedDocuments({
  applicationId,
  schoolName,
  links,
  unavailable,
  retrying,
  onRetry,
  onLinksChange,
}: {
  applicationId: string;
  schoolName: string;
  links: EvidenceLink[];
  unavailable: boolean;
  retrying: boolean;
  onRetry: () => void;
  onLinksChange: React.Dispatch<React.SetStateAction<EvidenceLink[]>>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; action: "unlink" | "reset" } | null>(null);
  const [library, setLibrary] = useState<{ docs: LibraryDocument[] | null; failed: boolean; loading: boolean }>({ docs: null, failed: false, loading: false });

  /** Read the student's documents each time the picker opens (owner-only). */
  const loadLibrary = async () => {
    setLibrary((cur) => ({ ...cur, failed: false, loading: true }));
    try {
      const docs = await fetchLibraryDocuments();
      setLibrary({ docs, failed: false, loading: false });
    } catch {
      setLibrary((cur) => ({ ...cur, failed: true, loading: false }));
    }
  };

  const replace = (next: EvidenceLink) => onLinksChange(current => current.map((l) => (l.id === next.id ? next : l)));

  const run = async (id: string, work: () => Promise<void>, fallback: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await work();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : fallback);
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (l: EvidenceLink) => {
    setConfirming(null);
    setEditError(null);
    setDraft({ title: l.tailoredTitle ?? "", body: l.tailoredBody ?? "" });
    setEditing(l.id);
  };

  const saveEdit = async (l: EvidenceLink) => {
    if (busyId) return;
    setBusyId(l.id);
    setEditError(null);
    try {
      replace(await saveTailoring(l, draft));
      setEditing(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Couldn't save this change. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const onLinked = (created: EvidenceLink) => {
    onLinksChange(current => current.some((l) => l.id === created.id) ? current : [...current, created]);
    setDialogOpen(false);
  };

  return (
    <section role="region" aria-label="Linked from your documents" className="mb-4" data-linked-documents>
      <GroupHeading>Linked from your documents</GroupHeading>
      {unavailable ? (
        <div role="status" className="rounded-lg border border-dashed bg-muted/20 px-6 py-6 text-center text-sm text-muted-foreground">
          <p>Couldn&apos;t load your linked documents.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-none"
            disabled={retrying}
            aria-label="Retry loading linked documents"
            onClick={onRetry}
          >
            {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            Retry
          </Button>
        </div>
      ) : links.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-4 text-center text-sm text-muted-foreground">
          You haven&apos;t linked a document from your library to this application.
        </p>
      ) : (
        <ul className="divide-y">
          {links.map((l) => {
            const title = linkTitle(l);
            const tailored = l.tailoredAt !== null;
            const busy = busyId === l.id;
            const updated = libraryUpdatedSince(l);
            return (
              <li key={l.id} className="py-3 min-w-0" data-evidence-link={l.id}>
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <Link href="/documents" className="font-medium text-sm hover:underline break-words">
                      {title}
                    </Link>
                    {l.tailoredBody ? <p className="text-sm text-muted-foreground whitespace-pre-line break-words mt-0.5">{l.tailoredBody}</p> : null}
                    <p className="text-xs text-muted-foreground mt-0.5 break-words">
                      {tailored
                        ? `Tailored for ${schoolName}. Library file: ${l.document?.fileName ?? "unavailable"}`
                        : "From your library"}
                    </p>
                  </div>
                  {editing === l.id ? null : (
                    <div className="flex shrink-0 gap-1.5">
                      <Button variant="outline" size="sm" className="rounded-none" disabled={busyId !== null} aria-label={`Tailor ${title}`} onClick={() => startEdit(l)}>
                        Tailor
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-none"
                        disabled={busyId !== null}
                        aria-label={`Unlink ${title}`}
                        onClick={() => setConfirming({ id: l.id, action: "unlink" })}
                      >
                        Unlink
                      </Button>
                    </div>
                  )}
                </div>

                {updated && editing !== l.id ? (
                  <div role="status" className="mt-2 rounded-md border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2 text-sm">
                    <p>Library version updated since you tailored this.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-none"
                        disabled={busyId !== null}
                        onClick={() => void run(l.id, async () => replace(await keepTailoring(l)), "Couldn't save this change. Try again.")}
                      >
                        {busy && confirming === null ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                        Keep mine
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-none"
                        disabled={busyId !== null}
                        onClick={() => setConfirming({ id: l.id, action: "reset" })}
                      >
                        Use library version
                      </Button>
                    </div>
                  </div>
                ) : null}

                {confirming?.id === l.id ? (
                  <div role="group" aria-label={confirming.action === "unlink" ? `Unlink ${title}` : `Use library version for ${title}`} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span>
                      {confirming.action === "unlink"
                        ? "Removes it and its scholarship requirement links from this application. The file stays in Documents."
                        : "Your tailored title and note for this application will be cleared. The document itself doesn't change."}
                    </span>
                    <Button
                      size="sm"
                      className="rounded-none"
                      disabled={busy}
                      aria-label={confirming.action === "unlink" ? "Confirm unlink" : "Confirm use library version"}
                      onClick={() => {
                        const action = confirming.action;
                        void run(
                          l.id,
                          async () => {
                            if (action === "unlink") {
                              await unlinkDocument(l.id);
                              onLinksChange(current => current.filter((x) => x.id !== l.id));
                            } else {
                              replace(await resetToLibrary(l));
                            }
                            setConfirming(null);
                          },
                          action === "unlink" ? "Couldn't unlink this document. Try again." : "Couldn't save this change. Try again.",
                        );
                      }}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                      {confirming.action === "unlink" ? "Unlink" : "Use library version"}
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-none" disabled={busy} onClick={() => setConfirming(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : null}

                {editing === l.id ? (
                  <form
                    className="mt-3 space-y-2"
                    aria-label={`Tailor for ${schoolName}`}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveEdit(l);
                    }}
                  >
                    <p className="text-xs text-muted-foreground">
                      Saved for this application only. The file in Documents and your other applications stay as they are.
                    </p>
                    <label className="block text-xs font-medium">
                      Title for {schoolName}
                      <Input
                        name="tailored-title"
                        className="mt-1"
                        maxLength={TAILORED_TITLE_MAX}
                        placeholder={l.document?.fileName ?? ""}
                        value={draft.title}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      />
                    </label>
                    <label className="block text-xs font-medium">
                      Note
                      <Textarea
                        name="tailored-body"
                        className="mt-1"
                        maxLength={TAILORED_BODY_MAX}
                        value={draft.body}
                        onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                      />
                    </label>
                    {editError ? <p role="alert" className="text-xs text-[#9a1a27] dark:text-[#e06b78]">{editError}</p> : null}
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" className="rounded-none" disabled={busy} aria-label="Save tailoring">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                        Save
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="rounded-none" disabled={busy} onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <Button
        variant="outline"
        size="sm"
        className="mt-3 rounded-none w-full"
        disabled={unavailable || busyId !== null}
        onClick={() => {
          setDialogOpen(true);
          void loadLibrary();
        }}
      >
        <Link2 className="h-4 w-4" aria-hidden="true" /> Link a document
      </Button>
      <LinkDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        applicationId={applicationId}
        docs={library.docs}
        failed={library.failed}
        loading={library.loading}
        onRetry={() => void loadLibrary()}
        linkedIds={new Set(links.map((l) => l.documentId))}
        onLinked={onLinked}
      />
    </section>
  );
}

function LinkDocumentDialog({
  open,
  onOpenChange,
  applicationId,
  docs,
  failed,
  loading,
  onRetry,
  linkedIds,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  docs: LibraryDocument[] | null;
  failed: boolean;
  loading: boolean;
  onRetry: () => void;
  linkedIds: Set<string>;
  onLinked: (link: EvidenceLink) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const link = async (d: LibraryDocument) => {
    if (busyId) return;
    setBusyId(d.id);
    try {
      onLinked(await linkDocument(applicationId, d.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't link this document. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const available = (docs ?? []).filter((d) => !linkedIds.has(d.id));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 max-h-[85vh] overflow-y-auto bg-background border border-foreground/70 p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-base font-semibold">Link a document</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-xs text-muted-foreground mt-2">{LINK_COPY}</Dialog.Description>
          {failed ? (
            <div role="status" className="mt-4 text-sm text-muted-foreground">
              <p>Couldn&apos;t load your documents.</p>
              <Button variant="outline" size="sm" className="mt-2 rounded-none" disabled={loading} aria-label="Retry loading your documents" onClick={onRetry}>
                Retry
              </Button>
            </div>
          ) : docs === null || (loading && docs.length === 0) ? (
            <p className="mt-4 text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your documents
            </p>
          ) : docs.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              You haven&apos;t uploaded any documents yet.{" "}
              <Link href="/documents" className={`${MAROON} hover:underline`}>Upload in Documents</Link>
            </p>
          ) : available.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">All your documents are already linked here.</p>
          ) : (
            <ul className="mt-4 divide-y">
              {available.map((d) => (
                <li key={d.id} className="py-3 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <span className="min-w-0 flex-1 font-medium text-sm break-words">{d.fileName}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-none"
                    disabled={busyId !== null}
                    aria-label={`Link ${d.fileName}`}
                    onClick={() => void link(d)}
                  >
                    {busyId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                    Link
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
