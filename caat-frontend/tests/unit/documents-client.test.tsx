// @vitest-environment jsdom
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentRow } from "@/app/(main)/documents/api";
import { button, click, deferred, flush, hasText, mountComponent, queryButton, unmountAll } from "./dom-helpers";

const io = vi.hoisted(() => ({
  fetchDocuments: vi.fn(),
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  reuploadDocument: vi.fn(),
  getDocumentSignedUrl: vi.fn(),
  fetchMySchools: vi.fn(),
  fetchDocumentUsage: vi.fn(),
  params: new URLSearchParams(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/app/(main)/documents/api", () => ({
  fetchDocuments: io.fetchDocuments,
  uploadDocument: io.uploadDocument,
  deleteDocument: io.deleteDocument,
  reuploadDocument: io.reuploadDocument,
  getDocumentSignedUrl: io.getDocumentSignedUrl,
}));
vi.mock("@/lib/my-schools", () => ({ fetchMySchools: io.fetchMySchools }));
vi.mock("@/lib/evidence-links", () => ({ fetchDocumentUsage: io.fetchDocumentUsage }));
// Stable across renders, like Next's hook while the URL is unchanged.
vi.mock("next/navigation", () => ({ useSearchParams: () => io.params }));
vi.mock("sonner", () => ({ toast: io.toast }));
// Menus render inline so the real handlers run; Radix positioning is not under test.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children, onClick, onSelect }: React.PropsWithChildren<{ onClick?: () => void; onSelect?: () => void }>) => (
    <button type="button" data-menu-item onClick={() => (onClick ?? onSelect)?.()}>{children}</button>
  ),
}));

import DocumentVaultClient from "@/app/(main)/documents/client";

function doc(id: string, name: string, patch: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id,
    user_id: "student-1",
    file_name: name,
    storage_path: `student-1/transcripts/${name}`,
    category: "transcripts",
    status: "pending_review",
    mime_type: "application/pdf",
    file_size: 2048,
    uploaded_at: "2026-10-01T00:00:00.000Z",
    review_notes: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    ...patch,
  };
}

const usageEntry = (applicationId = "app-1", schoolName = "Alpha University", tailored = false) => ({ applicationId, schoolName, tailored });
const transcript = () => doc("doc-1", "transcript.pdf");
const passport = () => doc("doc-2", "passport.pdf", { category: "identity" });
const pdf = (name = "new-transcript.pdf") => new File(["%PDF-1.7"], name, { type: "application/pdf" });

const fileNames = () =>
  [...document.querySelectorAll("span.truncate.block")].map((el) => el.textContent?.trim());
const row = (name: string) =>
  [...document.querySelectorAll("span.truncate.block")].find((el) => el.textContent?.trim() === name)!.closest("div.grid") as HTMLElement;
const menuItem = (name: string, label: string) =>
  [...row(name).querySelectorAll<HTMLButtonElement>("button[data-menu-item]")].find((b) => b.textContent?.trim() === label)!;
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const deleteDialogButton = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((b) => b.textContent?.trim() === label) ?? null;

async function chooseFile(file: File) {
  const input = fileInput();
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function mount(initialDocs: DocumentRow[] | null = [transcript(), passport()]) {
  await mountComponent(<DocumentVaultClient initialDocs={initialDocs} />);
  await flush();
}

beforeEach(() => {
  vi.clearAllMocks();
  io.params = new URLSearchParams();
  io.fetchMySchools.mockResolvedValue([{ id: 7, name: "Alpha University" }]);
  io.uploadDocument.mockImplementation(async (file: File) => doc("doc-new", file.name));
  io.deleteDocument.mockResolvedValue(undefined);
  io.fetchDocumentUsage.mockResolvedValue({});
});

afterEach(() => unmountAll());

describe("loading", () => {
  it("renders the server-provided list without refetching", async () => {
    await mount();
    expect(fileNames()).toEqual(["transcript.pdf", "passport.pdf"]);
    expect(io.fetchDocuments).not.toHaveBeenCalled();
  });

  it("shows a retryable error instead of an empty vault when loading fails", async () => {
    io.fetchDocuments.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([transcript()]);
    await mount(null);
    expect(io.toast.error).toHaveBeenCalledWith("Failed to load documents");
    expect(hasText("Couldn't load your documents.")).toBe(true);
    expect(hasText("No documents uploaded yet.")).toBe(false);
    expect(queryButton(/Upload your first document/)).toBeNull();

    await click(button("Try again"));
    await flush();
    expect(fileNames()).toEqual(["transcript.pdf"]);
    expect(hasText("Couldn't load your documents.")).toBe(false);
  });
});

describe("load error recovery", () => {
  it("hides the stats while loading failed and shows the full list after an upload", async () => {
    io.fetchDocuments.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([doc("doc-new", "new-transcript.pdf"), transcript()]);
    await mount(null);
    expect(hasText("Verified")).toBe(false);
    await click(button(/Upload New/));
    await chooseFile(pdf());
    await click(button("Upload"));
    await flush();
    await flush();
    expect(hasText("Couldn't load your documents.")).toBe(false);
    expect(fileNames()).toEqual(["new-transcript.pdf", "transcript.pdf"]);
  });
});

describe("upload", () => {
  it("uploads the chosen file, adds it to the list and closes the sheet", async () => {
    await mount();
    await click(button(/Upload New/));
    await chooseFile(pdf());
    await click(button("Upload"));
    await flush();
    expect(io.uploadDocument).toHaveBeenCalledWith(expect.objectContaining({ name: "new-transcript.pdf" }), "transcripts", null);
    expect(fileNames()[0]).toBe("new-transcript.pdf");
    expect(io.toast.success).toHaveBeenCalledWith("Document uploaded successfully");
    expect(fileInput()).toBeNull();
  });

  it("keeps the sheet and chosen file after a failed upload and retries once per click", async () => {
    const attempt = deferred<DocumentRow>();
    io.uploadDocument.mockReturnValueOnce(attempt.promise);
    await mount();
    await click(button(/Upload New/));
    await chooseFile(pdf());
    const upload = button("Upload");
    await click(upload);
    expect(upload.disabled).toBe(true);
    await click(upload);
    expect(io.uploadDocument).toHaveBeenCalledTimes(1);

    await act(async () => attempt.reject(new Error("Document limit reached (50 max). Please delete old documents before uploading new ones.")));
    await flush();
    expect(io.toast.error).toHaveBeenCalledWith(expect.stringContaining("Document limit reached"));
    expect(io.toast.success).not.toHaveBeenCalled();
    expect(fileNames()).toEqual(["transcript.pdf", "passport.pdf"]);
    expect(hasText("new-transcript.pdf")).toBe(true);
    expect(button("Upload").disabled).toBe(false);

    await click(button("Upload"));
    await flush();
    expect(io.uploadDocument).toHaveBeenCalledTimes(2);
    expect(fileNames()[0]).toBe("new-transcript.pdf");
  });

  it.each([
    ["an unsupported type", new File(["x"], "essay.docx", { type: "application/msword" }), "Only PDF, JPG, and PNG files are accepted"],
    ["an oversized file", Object.defineProperty(pdf("huge.pdf"), "size", { value: 11 * 1024 * 1024 }), "File must be under 10MB"],
  ])("refuses %s before calling the server", async (_label, file, message) => {
    await mount();
    await click(button(/Upload New/));
    await chooseFile(file as File);
    expect(io.toast.error).toHaveBeenCalledWith(message);
    expect(button("Upload").disabled).toBe(true);
    expect(io.uploadDocument).not.toHaveBeenCalled();
  });

  it("tags an upload opened from a school's application", async () => {
    io.params = new URLSearchParams("school=7");
    await mount();
    await chooseFile(pdf());
    await click(button("Upload"));
    await flush();
    expect(io.uploadDocument).toHaveBeenCalledWith(expect.any(File), "transcripts", 7);
  });
});

describe("delete", () => {
  it("asks for confirmation, then removes the document", async () => {
    await mount();
    await click(menuItem("transcript.pdf", "Delete"));
    expect(io.deleteDocument).not.toHaveBeenCalled();
    await click(deleteDialogButton("Delete")!);
    await flush();
    expect(io.deleteDocument).toHaveBeenCalledWith(expect.objectContaining({ id: "doc-1" }));
    expect(fileNames()).toEqual(["passport.pdf"]);
    expect(io.toast.success).toHaveBeenCalledWith("Document deleted");
    expect(deleteDialogButton("Delete")).toBeNull();
  });

  it("keeps the document and the dialog after a failed delete, and retries", async () => {
    io.deleteDocument.mockRejectedValueOnce(new Error("Something went wrong. Please try again."));
    await mount();
    await click(menuItem("transcript.pdf", "Delete"));
    await click(deleteDialogButton("Delete")!);
    await flush();
    expect(io.toast.error).toHaveBeenCalledWith("Something went wrong. Please try again.");
    expect(io.toast.success).not.toHaveBeenCalled();
    expect(fileNames()).toEqual(["transcript.pdf", "passport.pdf"]);
    expect(deleteDialogButton("Delete")?.disabled).toBe(false);

    await click(deleteDialogButton("Delete")!);
    await flush();
    expect(fileNames()).toEqual(["passport.pdf"]);
  });

  it("can be cancelled without deleting", async () => {
    await mount();
    await click(menuItem("transcript.pdf", "Delete"));
    await click(deleteDialogButton("Cancel")!);
    await flush();
    expect(io.deleteDocument).not.toHaveBeenCalled();
    expect(fileNames()).toEqual(["transcript.pdf", "passport.pdf"]);
  });
});

describe("replace", () => {
  it("keeps the original row after a failed replacement and replaces it on retry", async () => {
    io.reuploadDocument
      .mockRejectedValueOnce(new Error("File content does not match an allowed file type."))
      .mockResolvedValueOnce(doc("doc-1", "transcript-v2.pdf"));
    await mount();
    await click(menuItem("transcript.pdf", "Re-upload"));
    await chooseFile(pdf("transcript-v2.pdf"));
    await click(button("Replace"));
    await flush();
    expect(io.toast.error).toHaveBeenCalledWith("File content does not match an allowed file type.");
    expect(fileNames()).toEqual(["transcript.pdf", "passport.pdf"]);
    expect(button("Replace").disabled).toBe(false);

    await click(button("Replace"));
    await flush();
    expect(io.reuploadDocument).toHaveBeenLastCalledWith(expect.objectContaining({ id: "doc-1" }), expect.any(File));
    expect(fileNames()).toEqual(["transcript-v2.pdf", "passport.pdf"]);
    expect(io.toast.success).toHaveBeenCalledWith("Document replaced successfully");
  });
});

describe("view", () => {
  it("opens a signed link for the document", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    io.getDocumentSignedUrl.mockResolvedValueOnce("https://signed.example/transcript");
    await mount();
    await click(menuItem("transcript.pdf", "View"));
    await flush();
    expect(io.getDocumentSignedUrl).toHaveBeenCalledWith("student-1/transcripts/transcript.pdf");
    expect(open).toHaveBeenCalledWith("https://signed.example/transcript", "_blank");
  });

  it("reports a link failure without opening anything", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    io.getDocumentSignedUrl.mockRejectedValueOnce(new Error("Could not generate URL"));
    await mount();
    await click(menuItem("transcript.pdf", "View"));
    await flush();
    expect(io.toast.error).toHaveBeenCalledWith("Could not open document");
    expect(open).not.toHaveBeenCalled();
  });
});

describe("used in applications (PROD-78)", () => {
  it("badges each document with the number of applications it is linked to", async () => {
    io.fetchDocumentUsage.mockResolvedValue({ "doc-1": [usageEntry(),usageEntry("app-2","Beta University",true)], "doc-2": [usageEntry()] });
    await mount();
    expect(row("transcript.pdf").textContent).toContain("Used in 2 applications");
    expect(row("passport.pdf").textContent).toContain("Used in 1 application");
    expect(row("passport.pdf").textContent).not.toContain("1 applications");
    expect(io.fetchDocumentUsage).toHaveBeenCalledTimes(1);
  });

  it("shows no badge for unlinked documents, and none at all when usage cannot be read", async () => {
    io.fetchDocumentUsage.mockResolvedValue({ "doc-1": [usageEntry()] });
    await mount();
    expect(row("passport.pdf").textContent).not.toContain("Used in");
    unmountAll();
    io.fetchDocumentUsage.mockRejectedValue(new Error("offline"));
    await mount();
    expect(row("transcript.pdf").textContent).not.toContain("Used in");
  });

  it("warns in the delete dialog that a linked document must be unlinked first", async () => {
    io.fetchDocumentUsage.mockResolvedValue({ "doc-1": [usageEntry(),usageEntry("app-2","Beta University",true)] });
    await mount();
    await click(menuItem("transcript.pdf", "Delete"));
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain("It is linked to 2 applications. Unlink it from them first; deleting is refused while it is linked.");
  });
});

describe("document application navigation (PROD-164)", () => {
  it("opens named application links with tailoring labels and restores keyboard focus", async () => {
    io.fetchDocumentUsage.mockResolvedValue({"doc-1":[usageEntry(),usageEntry("app-2","Beta University",true)]});
    await mount();
    const opener=button("View application links for transcript.pdf");
    opener.focus();await click(opener);
    const dialog=document.querySelector('[role="dialog"]')!;
    const links=[...dialog.querySelectorAll('a')];
    expect(links.map(a=>a.getAttribute('href'))).toEqual(["/applications/app-1","/applications/app-2"]);
    expect(dialog.textContent).toContain("Alpha University");expect(dialog.textContent).toContain("Beta University");
    expect(dialog.textContent).toContain("Uses library details");expect(dialog.textContent).toContain("Tailored for this application");
    await click(button("Close dialog"));
    // Radix defers unmount auto-focus to the next timer turn.
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
    expect(document.activeElement).toBe(opener);
  });
  it("distinguishes unavailable usage from empty and recovers with retry", async () => {
    io.fetchDocumentUsage.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({});
    await mount();
    expect(row("transcript.pdf").textContent).toContain("Application links unavailable");
    await click(button("View application links for transcript.pdf"));
    expect(document.querySelector('[role="dialog"]')!.textContent).not.toContain("Not linked to an application");
    await click(button("Retry application links"));await flush();
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain("Not linked to an application");
  });
  it("keeps loaded links usable during refresh and ignores an older response", async () => {
    const slow=deferred<Record<string,ReturnType<typeof usageEntry>[]>>();
    io.fetchDocumentUsage.mockResolvedValueOnce({"doc-1":[usageEntry()] }).mockReturnValueOnce(slow.promise).mockResolvedValueOnce({});
    await mount();await click(button("View application links for transcript.pdf"));
    await act(async()=>window.dispatchEvent(new Event("focus")));
    expect(document.querySelector('[role="dialog"] a')?.getAttribute('href')).toBe('/applications/app-1');
    await act(async()=>window.dispatchEvent(new Event("caat:requirement-work-changed")));await flush();
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain("Not linked to an application");
    slow.resolve({"doc-1":[usageEntry()]});await flush();
    expect(document.querySelector('[role="dialog"] a')).toBeNull();
  });
});
