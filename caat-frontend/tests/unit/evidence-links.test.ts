import { beforeEach, describe, expect, it, vi } from "vitest";

type Ctx = { table: string; op: string; calls: { method: string; args: unknown[] }[] };
type Result = { data?: unknown; error?: { message: string; code?: string } | null };
const state = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  queries: [] as Ctx[],
  resolver: (() => ({ data: null, error: null })) as (ctx: Ctx) => Result,
}));

vi.mock("@/lib/current-user", () => ({ getClientUserId: () => Promise.resolve(state.userId) }));
vi.mock("@/lib/supabase/client", () => {
  const build = (table: string) => {
    const ctx: Ctx = { table, op: "select", calls: [] };
    state.queries.push(ctx);
    const b: Record<string, unknown> = {};
    const pass = (method: string, op?: string) => (...args: unknown[]) => {
      ctx.calls.push({ method, args });
      if (op) ctx.op = op;
      return b;
    };
    for (const m of ["select", "eq", "in", "order", "limit", "is", "not", "range"]) b[m] = pass(m);
    for (const m of ["insert", "update", "upsert", "delete"]) b[m] = pass(m, m);
    b.then = (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) => Promise.resolve(state.resolver(ctx)).then(f, r);
    return b;
  };
  const client = { from: (t: string) => build(t) };
  return { supabase: client, getBrowserClient: () => client };
});

import {
  fetchDocumentUsage,
  fetchEvidenceLinksForApplication,
  fetchLibraryDocuments,
  keepTailoring,
  libraryUpdatedSince,
  linkDocument,
  linkTitle,
  readEvidenceLinks,
  saveTailoring,
  unlinkDocument,
  resetToLibrary,
  type EvidenceLink,
} from "@/lib/evidence-links";

const LINKS = "application_evidence_links";
const calls = (ctx: Ctx, method: string) => ctx.calls.filter((c) => c.method === method).map((c) => c.args);
const last = () => state.queries[state.queries.length - 1];

const row = (patch: Record<string, unknown> = {}) => ({
  id: "link-1",
  application_id: "app-1",
  document_id: "doc-1",
  tailored_title: null,
  tailored_body: null,
  tailored_at: null,
  created_at: "2026-10-20T00:00:00.000Z",
  documents: { id: "doc-1", file_name: "portfolio.pdf", category: "letters", status: "pending_review", uploaded_at: "2026-10-01T00:00:00.000Z" },
  ...patch,
});
const link = (patch: Partial<EvidenceLink> = {}): EvidenceLink => ({
  id: "link-1",
  applicationId: "app-1",
  documentId: "doc-1",
  tailoredTitle: null,
  tailoredBody: null,
  tailoredAt: null,
  sourceUploadedAt: null,
  createdAt: "2026-10-20T00:00:00.000Z",
  document: { id: "doc-1", fileName: "portfolio.pdf", category: "letters", status: "pending_review", uploadedAt: "2026-10-01T00:00:00.000Z" },
  ...patch,
});

beforeEach(() => {
  state.userId = "user-1";
  state.queries = [];
  state.resolver = () => ({ data: null, error: null });
});

describe("reading links", () => {
  it("reads one application's links for the owner only, with the linked document", async () => {
    state.resolver = () => ({ data: [row({ tailored_title: "Portfolio", tailored_at: "2026-10-21T00:00:00.000Z" })], error: null });
    const links = await readEvidenceLinks("user-1", "app-1");
    expect(last().table).toBe(LINKS);
    expect(calls(last(), "eq")).toEqual([["user_id", "user-1"], ["application_id", "app-1"], ["kind", "document"]]);
    expect(links).toEqual([link({ tailoredTitle: "Portfolio", tailoredAt: "2026-10-21T00:00:00.000Z" })]);
  });

  it("keeps a link whose document row is not readable, with no document", async () => {
    state.resolver = () => ({ data: [row({ documents: null })], error: null });
    expect((await readEvidenceLinks("user-1", "app-1"))[0].document).toBeNull();
  });

  it("throws on a read error instead of returning no links", async () => {
    state.resolver = () => ({ data: null, error: { message: "boom" } });
    await expect(readEvidenceLinks("user-1", "app-1")).rejects.toThrow("Could not load your linked documents");
  });

  it("the card's own fetcher needs a signed-in student", async () => {
    state.userId = null;
    await expect(fetchEvidenceLinksForApplication("app-1")).rejects.toThrow("Not authenticated");
    expect(state.queries).toHaveLength(0);
  });

  it("lists the owner's library documents, newest first", async () => {
    state.resolver = () => ({ data: [{ id: "doc-1", file_name: "portfolio.pdf", category: "letters", status: "verified", uploaded_at: "2026-10-01T00:00:00.000Z" }], error: null });
    const docs = await fetchLibraryDocuments();
    expect(last().table).toBe("documents");
    expect(calls(last(), "eq")).toEqual([["user_id", "user-1"]]);
    expect(calls(last(), "order")).toEqual([["uploaded_at", { ascending: false }]]);
    expect(docs).toEqual([{ id: "doc-1", fileName: "portfolio.pdf", category: "letters", status: "verified", uploadedAt: "2026-10-01T00:00:00.000Z" }]);
  });

  it("counts the applications each document is used in with one owner-filtered query", async () => {
    state.resolver = () => ({
      data: [
        { document_id: "doc-1", application_id: "app-1" },
        { document_id: "doc-1", application_id: "app-2" },
        { document_id: "doc-2", application_id: "app-1" },
      ],
      error: null,
    });
    expect(await fetchDocumentUsage()).toEqual({ "doc-1": [{applicationId:"app-1",schoolName:"Application",tailored:false},{applicationId:"app-2",schoolName:"Application",tailored:false}], "doc-2": [{applicationId:"app-1",schoolName:"Application",tailored:false}] });
    expect(state.queries).toHaveLength(1);
    expect(last().table).toBe(LINKS);
    expect(calls(last(), "eq")).toContainEqual(["user_id", "user-1"]);
    expect(calls(last(), "eq")).toContainEqual(["kind", "document"]);
    expect(calls(last(), "order")).toEqual([["id"]]);
    expect(calls(last(), "range")).toEqual([[0,199]]);
  });

  it("throws when usage cannot be read, so the page never shows a wrong zero", async () => {
    state.resolver = () => ({ data: null, error: { message: "boom" } });
    await expect(fetchDocumentUsage()).rejects.toThrow();
  });
});

describe("writing links (never the document)", () => {
  it("links with the link columns only and reads the row back", async () => {
    state.resolver = () => ({ data: [row()], error: null });
    expect(await linkDocument("app-1", "doc-1")).toEqual(link());
    expect(last().op).toBe("insert");
    expect(calls(last(), "insert")).toEqual([[{ user_id: "user-1", application_id: "app-1", kind: "document", document_id: "doc-1" }]]);
  });

  it("treats a duplicate from another tab as already linked and returns that link", async () => {
    state.resolver = (ctx) => (ctx.op === "insert"
      ? { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } }
      : { data: [row({ tailored_title: "Mine", tailored_at: "2026-10-21T00:00:00.000Z" })], error: null });
    const existing = await linkDocument("app-1", "doc-1");
    expect(existing.tailoredTitle).toBe("Mine");
    const read = last();
    expect(read.op).toBe("select");
    expect(calls(read, "eq")).toEqual([["user_id", "user-1"], ["application_id", "app-1"], ["document_id", "doc-1"]]);
  });

  it("fails without a returned row, and on other errors, with a safe message", async () => {
    state.resolver = () => ({ data: [], error: null });
    await expect(linkDocument("app-1", "doc-1")).rejects.toThrow("Couldn't link this document");
    state.resolver = () => ({ data: null, error: { message: "insert or update on table violates foreign key constraint", code: "23503" } });
    await expect(linkDocument("app-1", "doc-1")).rejects.toThrow("Couldn't link this document");
  });

  it("unlinks the owner's link row only and treats zero rows as a failure", async () => {
    state.resolver = () => ({ data: [{ id: "link-1" }], error: null });
    await unlinkDocument("link-1");
    expect(last().op).toBe("delete");
    expect(calls(last(), "eq")).toEqual([["id", "link-1"], ["user_id", "user-1"]]);
    state.resolver = () => ({ data: [], error: null });
    await expect(unlinkDocument("link-1")).rejects.toThrow("Couldn't unlink this document");
  });

  it("saves trimmed tailoring on the link, guarded by the tailoring it started from", async () => {
    state.resolver = () => ({ data: [row({ tailored_title: "Portfolio for Arts", tailored_body: null, tailored_at: "2026-10-22T00:00:00.000Z" })], error: null });
    const saved = await saveTailoring(link(), { title: "  Portfolio for Arts  ", body: "   " });
    expect(saved.tailoredTitle).toBe("Portfolio for Arts");
    const [payload] = calls(last(), "update")[0] as [Record<string, unknown>];
    expect(Object.keys(payload).sort()).toEqual(["source_uploaded_at", "tailored_at", "tailored_body", "tailored_title"]);
    expect(payload).toMatchObject({ tailored_title: "Portfolio for Arts", tailored_body: null });
    expect(typeof payload.tailored_at).toBe("string");
    expect(calls(last(), "eq")).toEqual([["id", "link-1"], ["user_id", "user-1"]]);
    expect(calls(last(), "is")).toEqual([["tailored_at", null]]);
  });

  it("guards a re-tailor on the previous tailored_at and reports a change elsewhere", async () => {
    state.resolver = () => ({ data: [], error: null });
    await expect(saveTailoring(link({ tailoredTitle: "Old", tailoredAt: "2026-10-21T00:00:00.000Z" }), { title: "New", body: "" }))
      .rejects.toThrow("changed in another tab");
    expect(calls(last(), "eq")).toContainEqual(["tailored_at", "2026-10-21T00:00:00.000Z"]);
  });

  it("refuses empty or oversized tailoring before writing", async () => {
    await expect(saveTailoring(link(), { title: " ", body: "" })).rejects.toThrow("Add a title or a note");
    await expect(saveTailoring(link(), { title: "x".repeat(201), body: "" })).rejects.toThrow("200");
    await expect(saveTailoring(link(), { title: "", body: "x".repeat(10_001) })).rejects.toThrow("10,000");
    expect(state.queries).toHaveLength(0);
  });

  it("Keep mine acknowledges only the file version it saw", async () => {
    const before = "2026-10-21T00:00:00.000Z";
    state.resolver = () => ({ data: [row({ tailored_title: "Mine", tailored_at: "2026-10-23T00:00:00.000Z" })], error: null });
    const kept = await keepTailoring(link({ tailoredTitle: "Mine", tailoredAt: before }));
    expect(kept.tailoredTitle).toBe("Mine");
    const [payload] = calls(last(), "update")[0] as [Record<string, unknown>];
    expect(payload.source_uploaded_at).toBe("2026-10-01T00:00:00.000Z");
    expect(Object.keys(payload).sort()).toEqual(["source_uploaded_at", "tailored_at"]);
    expect(calls(last(), "eq")).toEqual([["id", "link-1"], ["user_id", "user-1"], ["tailored_at", before]]);
  });

  it("Use library version clears the tailoring on the link only", async () => {
    state.resolver = () => ({ data: [row()], error: null });
    const reset = await resetToLibrary(link({ tailoredTitle: "Mine", tailoredAt: "2026-10-21T00:00:00.000Z" }));
    expect(reset.tailoredAt).toBeNull();
    expect(calls(last(), "update")).toEqual([[{ tailored_title: null, tailored_body: null, tailored_at: null, source_uploaded_at: null }]]);
  });

  it("no write path ever touches the documents table", async () => {
    state.resolver = (ctx) => (ctx.op === "delete" ? { data: [{ id: "link-1" }], error: null } : { data: [row({ tailored_title: "T", tailored_at: "2026-10-22T00:00:00.000Z" })], error: null });
    await linkDocument("app-1", "doc-1");
    await saveTailoring(link(), { title: "T", body: "" });
    await keepTailoring(link({ tailoredTitle: "T", tailoredAt: "2026-10-22T00:00:00.000Z" }));
    await resetToLibrary(link({ tailoredTitle: "T", tailoredAt: "2026-10-22T00:00:00.000Z" }));
    await unlinkDocument("link-1");
    expect(new Set(state.queries.map((q) => q.table))).toEqual(new Set([LINKS]));
  });
});

describe("library updated since tailoring", () => {
  it("is true only for a tailored link with a different acknowledged file version", () => {
    const tailored = link({ tailoredTitle: "Mine", tailoredAt: "2026-10-21T00:00:00.000Z", sourceUploadedAt: "2026-10-01T00:00:00.000Z" });
    expect(libraryUpdatedSince({ ...tailored, document: { ...tailored.document!, uploadedAt: "2026-10-22T00:00:00.000Z" } })).toBe(true);
    expect(libraryUpdatedSince({ ...tailored, document: { ...tailored.document!, uploadedAt: "2026-10-01T00:00:00.000Z" } })).toBe(false);
    expect(libraryUpdatedSince(tailored)).toBe(false);
    expect(libraryUpdatedSince(link({ document: { ...link().document!, uploadedAt: "2026-10-30T00:00:00.000Z" } }))).toBe(false);
    expect(libraryUpdatedSince({ ...tailored, document: null })).toBe(false);
  });

  it("compares the acknowledged file version independently of either device clock", () => {
    const seen = link({ tailoredTitle: "Mine", tailoredAt: "2026-10-01T00:00:00.000Z" });
    const uploaded = "2026-10-22T00:00:00.000Z";
    const acknowledged = { ...seen, sourceUploadedAt: uploaded, document: { ...seen.document!, uploadedAt: uploaded } };
    expect(libraryUpdatedSince(acknowledged)).toBe(false);
    expect(libraryUpdatedSince({ ...acknowledged, document: { ...seen.document!, uploadedAt: "2026-09-01T00:00:00.000Z" } })).toBe(true);
  });

  it("shows the tailored title, else the library file name", () => {
    expect(linkTitle(link())).toBe("portfolio.pdf");
    expect(linkTitle(link({ tailoredTitle: "Arts portfolio", tailoredAt: "2026-10-21T00:00:00.000Z" }))).toBe("Arts portfolio");
    expect(linkTitle(link({ document: null }))).toBe("Document unavailable");
  });
});

it("reads all document usage pages with names and tailoring, failing on a later page", async () => {
  state.resolver = q => ({data:calls(q,"range")[0]?.[0] === 200 ? [{document_id:"doc-1",application_id:"last",tailored_at:"2026-10-25",user_school_applications:{schools:{name:"Last University"}}}] : Array.from({length:200},(_,i)=>({document_id:"doc-1",application_id:`app-${i}`,tailored_at:null})),error:null});
  const usage = await fetchDocumentUsage();
  expect(usage["doc-1"]).toHaveLength(201);
  expect(usage["doc-1"][200]).toEqual({applicationId:"last",schoolName:"Last University",tailored:true});
  expect(state.queries.every(q=>calls(q,"eq").some(args=>args[0] === "user_id" && args[1] === "user-1"))).toBe(true);
  state.resolver = q => calls(q,"range")[0]?.[0] === 200 ? {data:null,error:{message:"private failure"}} : {data:Array.from({length:200},(_,i)=>({document_id:"doc-1",application_id:`app-${i}`})),error:null};
  await expect(fetchDocumentUsage()).rejects.toThrow("Could not load where your documents are used");
});
