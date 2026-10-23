// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { button, change, click, deferred, flush, link, mountComponent, queryButton, unmountAll } from "./dom-helpers";
import type { EvidenceLink, LibraryDocument } from "@/lib/evidence-links";

const io = vi.hoisted(() => ({
  linkDocument: vi.fn(),
  unlinkDocument: vi.fn(),
  saveTailoring: vi.fn(),
  keepTailoring: vi.fn(),
  resetToLibrary: vi.fn(),
  fetchLibraryDocuments: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/evidence-links", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/evidence-links")>()),
  linkDocument: io.linkDocument,
  unlinkDocument: io.unlinkDocument,
  saveTailoring: io.saveTailoring,
  keepTailoring: io.keepTailoring,
  resetToLibrary: io.resetToLibrary,
  fetchLibraryDocuments: io.fetchLibraryDocuments,
}));
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: io.toast }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...rest}>{children}</a>,
}));

import { HubLinkedDocuments } from "@/components/applications/hub-linked-documents";

const doc = (id: string, patch: Partial<LibraryDocument> = {}): LibraryDocument => ({
  id, fileName: `${id}.pdf`, category: "letters", status: "pending_review", uploadedAt: "2026-10-01T00:00:00.000Z", ...patch,
});
const lnk = (id: string, documentId: string, patch: Partial<EvidenceLink> = {}): EvidenceLink => ({
  id, applicationId: "app-1", documentId, tailoredTitle: null, tailoredBody: null, tailoredAt: null,
  createdAt: "2026-10-20T00:00:00.000Z", document: doc(documentId), ...patch,
});

type Props = Partial<React.ComponentProps<typeof HubLinkedDocuments>> & { initial: EvidenceLink[] };
function Harness({ initial, ...rest }: Props) {
  const [links, setLinks] = useState(initial);
  return (
    <HubLinkedDocuments
      applicationId="app-1"
      schoolName="Alpha University"
      links={links}
      unavailable={false}
      retrying={false}
      onRetry={vi.fn()}
      onLinksChange={setLinks}
      {...rest}
    />
  );
}
const group = () => document.querySelector('[aria-label="Linked from your documents"]') as HTMLElement;
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;

beforeEach(() => {
  for (const fn of [io.linkDocument, io.unlinkDocument, io.saveTailoring, io.keepTailoring, io.resetToLibrary, io.fetchLibraryDocuments]) fn.mockReset();
  io.toast.error.mockReset();
});
afterEach(unmountAll);

describe("HubLinkedDocuments (PROD-78)", () => {
  it("says nothing is linked yet, with a Link a document action", async () => {
    await mountComponent(<Harness initial={[]} />);
    expect(group().textContent).toContain("You haven't linked a document from your library to this application.");
    expect(button("Link a document").disabled).toBe(false);
  });

  it("shows unavailable with Retry, never the empty copy, and disables linking", async () => {
    const onRetry = vi.fn();
    await mountComponent(<Harness initial={[]} unavailable onRetry={onRetry} />);
    expect(group().textContent).toContain("Couldn't load your linked documents.");
    expect(group().textContent).not.toContain("You haven't linked");
    expect(button("Link a document").disabled).toBe(true);
    await click(button("Retry loading linked documents"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("links a document from the dialog, which lists only documents not yet linked here", async () => {
    io.fetchLibraryDocuments.mockResolvedValue([doc("doc-1"), doc("doc-2"), doc("doc-3")]);
    io.linkDocument.mockResolvedValue(lnk("link-2", "doc-2"));
    await mountComponent(<Harness initial={[lnk("link-1", "doc-1")]} />);
    await click(button("Link a document"));
    await flush();
    const d = dialog()!;
    expect(d.textContent).toContain("It doesn't upload anything new or send anything to the university.");
    expect(queryButton("Link doc-1.pdf", d)).toBeNull();
    await click(button("Link doc-2.pdf", d));
    expect(io.linkDocument).toHaveBeenCalledWith("app-1", "doc-2");
    expect(dialog()).toBeNull();
    expect(link("doc-2.pdf", group()).getAttribute("href")).toBe("/documents");
  });

  it("shows a failed library read in the dialog with Retry, not 'no documents'", async () => {
    io.fetchLibraryDocuments.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce([doc("doc-9")]);
    await mountComponent(<Harness initial={[]} />);
    await click(button("Link a document"));
    await flush();
    expect(dialog()!.textContent).toContain("Couldn't load your documents.");
    expect(dialog()!.textContent).not.toContain("You haven't uploaded");
    await click(button("Retry loading your documents", dialog()!));
    await flush();
    expect(button("Link doc-9.pdf", dialog()!)).toBeTruthy();
  });

  it("tailors the title and note on the link and shows them, with the library file named", async () => {
    io.saveTailoring.mockImplementation(async (seen: EvidenceLink, input: { title: string; body: string }) => ({
      ...seen, tailoredTitle: input.title, tailoredBody: input.body, tailoredAt: "2026-10-22T00:00:00.000Z",
    }));
    await mountComponent(<Harness initial={[lnk("link-1", "doc-1")]} />);
    await click(button("Tailor doc-1.pdf"));
    await change(document.querySelector('input[name="tailored-title"]') as HTMLInputElement, "Arts portfolio");
    await change(document.querySelector('textarea[name="tailored-body"]') as HTMLTextAreaElement, "Upload with the arts form");
    await click(button("Save tailoring"));
    expect(io.saveTailoring).toHaveBeenCalledWith(expect.objectContaining({ id: "link-1" }), { title: "Arts portfolio", body: "Upload with the arts form" });
    expect(group().textContent).toContain("Arts portfolio");
    expect(group().textContent).toContain("Upload with the arts form");
    expect(group().textContent).toContain("Tailored for Alpha University. Library file: doc-1.pdf");
  });

  it("keeps the editor open with the message when tailoring fails", async () => {
    io.saveTailoring.mockRejectedValue(new Error("This link changed in another tab or was removed. Reload to see the latest."));
    await mountComponent(<Harness initial={[lnk("link-1", "doc-1")]} />);
    await click(button("Tailor doc-1.pdf"));
    await change(document.querySelector('input[name="tailored-title"]') as HTMLInputElement, "New");
    await click(button("Save tailoring"));
    expect(group().textContent).toContain("This link changed in another tab");
    expect(document.querySelector('input[name="tailored-title"]')).not.toBeNull();
  });

  it("flags a newer library file on a tailored link; Keep mine keeps the tailoring", async () => {
    const tailored = lnk("link-1", "doc-1", { tailoredTitle: "Mine", tailoredAt: "2026-10-21T00:00:00.000Z", document: doc("doc-1", { uploadedAt: "2026-10-22T00:00:00.000Z" }) });
    io.keepTailoring.mockResolvedValue({ ...tailored, tailoredAt: "2026-10-23T00:00:00.000Z" });
    await mountComponent(<Harness initial={[tailored]} />);
    expect(group().textContent).toContain("Library version updated since you tailored this.");
    await click(button("Keep mine"));
    expect(io.keepTailoring).toHaveBeenCalledWith(tailored);
    expect(group().textContent).not.toContain("Library version updated");
    expect(group().textContent).toContain("Mine");
  });

  it("Use library version asks first, then clears the tailoring on the link only", async () => {
    const tailored = lnk("link-1", "doc-1", { tailoredTitle: "Mine", tailoredAt: "2026-10-21T00:00:00.000Z", document: doc("doc-1", { uploadedAt: "2026-10-22T00:00:00.000Z" }) });
    io.resetToLibrary.mockResolvedValue({ ...tailored, tailoredTitle: null, tailoredAt: null });
    await mountComponent(<Harness initial={[tailored]} />);
    await click(button("Use library version"));
    expect(io.resetToLibrary).not.toHaveBeenCalled();
    expect(group().textContent).toContain("Your tailored title and note for this application will be cleared. The document itself doesn't change.");
    await click(button("Confirm use library version"));
    expect(io.resetToLibrary).toHaveBeenCalledWith(tailored);
    expect(link("doc-1.pdf", group())).toBeTruthy();
    expect(group().textContent).not.toContain("Library version updated");
  });

  it("does not flag an untailored link, which simply follows the library", async () => {
    await mountComponent(<Harness initial={[lnk("link-1", "doc-1", { document: doc("doc-1", { uploadedAt: "2026-10-30T00:00:00.000Z" }) })]} />);
    expect(group().textContent).not.toContain("Library version updated");
  });

  it("unlinks after a confirm that says the file stays in Documents", async () => {
    const pending = deferred();
    io.unlinkDocument.mockReturnValue(pending.promise);
    await mountComponent(<Harness initial={[lnk("link-1", "doc-1")]} />);
    await click(button("Unlink doc-1.pdf"));
    expect(group().textContent).toContain("Removes it from this application only. The file stays in Documents.");
    await click(button("Confirm unlink"));
    expect(io.unlinkDocument).toHaveBeenCalledWith("link-1");
    expect(link("doc-1.pdf", group())).toBeTruthy();
    pending.resolve();
    await flush();
    expect(group().textContent).toContain("You haven't linked a document");
  });

  it("keeps the link and says so when unlinking fails", async () => {
    io.unlinkDocument.mockRejectedValue(new Error("Couldn't unlink this document. Try again."));
    await mountComponent(<Harness initial={[lnk("link-1", "doc-1")]} />);
    await click(button("Unlink doc-1.pdf"));
    await click(button("Confirm unlink"));
    expect(io.toast.error).toHaveBeenCalledWith("Couldn't unlink this document. Try again.");
    expect(link("doc-1.pdf", group())).toBeTruthy();
  });
});
