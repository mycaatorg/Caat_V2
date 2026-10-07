import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = {
  data?: unknown;
  error?: { message: string; name?: string; status?: number } | null;
  count?: number | null;
};
type QueryCall = {
  table: string;
  op: string;
  filters: Array<[string, unknown]>;
  payload: unknown;
  selects: unknown[][];
  orders: unknown[][];
  terminal: string;
};
type StorageResult = { error?: { message: string } | null };
type StorageCall = { method: "upload" | "remove" | "createSignedUrl"; args: unknown[] };

const io = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  authError: null as { message: string } | null,
  queryResults: [] as Array<QueryResult | Promise<QueryResult>>,
  queryCalls: [] as QueryCall[],
  storageCalls: [] as StorageCall[],
  timeline: [] as string[],
  uploadResults: [] as StorageResult[],
  removeResults: [] as StorageResult[],
  signedResult: { data: { signedUrl: "https://signed.example/file" }, error: null } as {
    data: { signedUrl: string } | null;
    error: { message: string } | null;
  },
  getUser: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: { getUser: io.getUser },
    from: io.from,
    storage: { from: io.storageFrom },
  },
}));

import {
  deleteDocument,
  fetchDocuments,
  getDocumentSignedUrl,
  reuploadDocument,
  uploadDocument,
  type DocumentRow,
} from "@/app/(main)/documents/api";

function queryResult(data: unknown, extra: Pick<QueryResult, "count"> = {}): QueryResult {
  return { data, error: null, ...extra };
}

function fileWithBytes(name: string, type: string, bytes: number[]): File {
  return new File([Uint8Array.from(bytes)], name, { type });
}

function pdfFile(name = "official transcript.pdf"): File {
  return fileWithBytes(name, "application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
}

function documentRow(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: "document-1",
    user_id: "user-1",
    file_name: "official transcript.pdf",
    storage_path: "user-1/transcripts/old_transcript.pdf",
    category: "transcripts",
    status: "pending_review",
    mime_type: "application/pdf",
    file_size: 8,
    uploaded_at: "2026-01-01T00:00:00.000Z",
    review_notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function latestQuery(table: string, op: string): QueryCall {
  const query = [...io.queryCalls].reverse().find((item) => item.table === table && item.op === op);
  if (!query) throw new Error(`Query not captured: ${table}.${op}`);
  return query;
}

function storagePaths(method: StorageCall["method"]): string[][] {
  return io.storageCalls.filter((call) => call.method === method).map((call) => {
    if (method === "remove") return call.args[0] as string[];
    return [call.args[0] as string];
  });
}

async function waitUntil(predicate: () => boolean, message: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${message}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  io.userId = "user-1";
  io.authError = null;
  io.queryResults.length = 0;
  io.queryCalls.length = 0;
  io.storageCalls.length = 0;
  io.timeline.length = 0;
  io.uploadResults.length = 0;
  io.removeResults.length = 0;
  io.signedResult = { data: { signedUrl: "https://signed.example/file" }, error: null };
  vi.spyOn(console, "error").mockImplementation(() => {});

  io.getUser.mockImplementation(async () => ({
    data: { user: io.userId ? { id: io.userId } : null },
    error: io.authError,
  }));
  io.from.mockImplementation((table: string) => {
    const context = {
      table,
      op: "select",
      filters: [] as Array<[string, unknown]>,
      payload: undefined as unknown,
      selects: [] as unknown[][],
      orders: [] as unknown[][],
    };
    const builder: Record<string, unknown> = {};
    const terminal = (method: string) => {
      io.queryCalls.push({ ...context, filters: [...context.filters], selects: [...context.selects], orders: [...context.orders], terminal: method });
      io.timeline.push(`db-start:${table}:${context.op}:${method}`);
      const result = io.queryResults.shift() ?? { data: null, error: null, count: 0 };
      return Promise.resolve(result).then((value) => {
        io.timeline.push(`db-done:${table}:${context.op}:${method}`);
        return value;
      });
    };
    builder.select = (...args: unknown[]) => { context.selects.push(args); return builder; };
    builder.eq = (column: string, value: unknown) => { context.filters.push([column, value]); return builder; };
    builder.order = (...args: unknown[]) => { context.orders.push(args); return builder; };
    builder.insert = (payload: unknown) => { context.op = "insert"; context.payload = payload; return builder; };
    builder.update = (payload: unknown) => { context.op = "update"; context.payload = payload; return builder; };
    builder.delete = () => { context.op = "delete"; return builder; };
    builder.single = () => terminal("single");
    builder.maybeSingle = () => terminal("maybeSingle");
    builder.then = (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => terminal("then").then(onFulfilled, onRejected);
    return builder;
  });
  io.storageFrom.mockImplementation((bucket: string) => {
    if (bucket !== "user-documents") throw new Error(`Unexpected bucket: ${bucket}`);
    return { upload: io.upload, remove: io.remove, createSignedUrl: io.createSignedUrl };
  });
  io.upload.mockImplementation(async (path: string, file: File, options: { contentType: string }) => {
    io.storageCalls.push({ method: "upload", args: [path, file, options] });
    io.timeline.push(`storage-upload:${path}`);
    return io.uploadResults.shift() ?? { error: null };
  });
  io.remove.mockImplementation(async (paths: string[]) => {
    io.storageCalls.push({ method: "remove", args: [paths] });
    io.timeline.push(`storage-remove:${paths.join(",")}`);
    return io.removeResults.shift() ?? { error: null };
  });
  io.createSignedUrl.mockImplementation(async (path: string, expiresIn: number) => {
    io.storageCalls.push({ method: "createSignedUrl", args: [path, expiresIn] });
    return io.signedResult;
  });
});

afterEach(() => vi.restoreAllMocks());

describe("document ownership and signed links", () => {
  it("issues a one-hour signed URL only for the current user's path", async () => {
    await expect(getDocumentSignedUrl("user-1/identity/passport.pdf")).resolves.toBe("https://signed.example/file");
    expect(io.createSignedUrl).toHaveBeenCalledWith("user-1/identity/passport.pdf", 3600);

    await expect(getDocumentSignedUrl("user-2/identity/passport.pdf")).rejects.toThrow("Not authorized");
    expect(io.createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("removes the storage object named by the deleted row, scoped to the current user", async () => {
    const suppliedRow = documentRow({ storage_path: "another-user/private.pdf" });
    io.queryResults.push(queryResult([{ storage_path: "user-1/transcripts/server-owned.pdf" }]));

    await deleteDocument(suppliedRow);

    expect(storagePaths("remove")).toEqual([["user-1/transcripts/server-owned.pdf"]]);
    const deletes = io.queryCalls.filter((call) => call.op === "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].filters).toEqual([["id", "document-1"], ["user_id", "user-1"]]);
    // The path comes from the row actually deleted, not a separate lookup.
    expect(deletes[0].selects).toEqual([["storage_path"]]);
  });
});

describe("uploadDocument", () => {
  it("uploads valid PDF bytes under the caller/category path and persists the matching metadata", async () => {
    const file = pdfFile();
    const saved = documentRow({ storage_path: "user-1/transcripts/123456_official_transcript.pdf" });
    vi.spyOn(Date, "now").mockReturnValue(123456);
    io.queryResults.push(queryResult(null, { count: 3 }), queryResult(saved));

    await expect(uploadDocument(file, "transcripts", 42)).resolves.toEqual(saved);

    expect(storagePaths("upload")).toEqual([["user-1/transcripts/123456_official_transcript.pdf"]]);
    expect(io.upload).toHaveBeenCalledWith(
      "user-1/transcripts/123456_official_transcript.pdf",
      file,
      { contentType: "application/pdf" },
    );
    const insert = latestQuery("documents", "insert");
    expect(insert.filters).toEqual([]);
    expect(insert.payload).toEqual({
      user_id: "user-1",
      file_name: "official transcript.pdf",
      storage_path: "user-1/transcripts/123456_official_transcript.pdf",
      category: "transcripts",
      mime_type: "application/pdf",
      file_size: file.size,
      school_id: 42,
    });
  });

  it("rejects spoofed file content before storing or inserting it", async () => {
    io.queryResults.push(queryResult(null, { count: 0 }));
    const fakePdf = fileWithBytes("image.pdf", "application/pdf", [0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);

    await expect(uploadDocument(fakePdf, "identity")).rejects.toThrow("File content does not match");

    expect(io.upload).not.toHaveBeenCalled();
    expect(io.queryCalls.some((call) => call.op === "insert")).toBe(false);
  });

  it("removes the newly uploaded object when document-row persistence fails", async () => {
    vi.spyOn(Date, "now").mockReturnValue(987);
    io.queryResults.push(
      queryResult(null, { count: 0 }),
      { data: null, error: { message: "documents_internal_constraint" } },
    );

    await expect(uploadDocument(pdfFile(), "letters")).rejects.toThrow("Something went wrong");

    const newPath = "user-1/letters/987_official_transcript.pdf";
    expect(storagePaths("upload")).toEqual([[newPath]]);
    expect(storagePaths("remove")).toEqual([[newPath]]);
    expect(io.timeline.indexOf(`db-done:documents:insert:single`)).toBeLessThan(
      io.timeline.indexOf(`storage-remove:${newPath}`),
    );
  });
});

describe("reuploadDocument", () => {
  it("updates only the owner-scoped row and removes the DB-verified old object after the update commits", async () => {
    vi.spyOn(Date, "now").mockReturnValue(555);
    const write = deferred<QueryResult>();
    const storedRow = documentRow({
      storage_path: "user-1/identity/555_replacement.pdf",
      file_name: "replacement.pdf",
      category: "identity",
      status: "pending_review",
    });
    io.queryResults.push(
      queryResult({ storage_path: "user-1/identity/verified-original.pdf", category: "identity" }),
      write.promise,
    );
    const pending = reuploadDocument(
      documentRow({ storage_path: "attacker/path.pdf", category: "letters" }),
      pdfFile("replacement.pdf"),
    );

    await waitUntil(() => io.queryCalls.some((call) => call.op === "update"), "reupload row update");
    const update = latestQuery("documents", "update");
    expect(update.filters).toEqual([["id", "document-1"], ["user_id", "user-1"]]);
    expect(update.payload).toMatchObject({
      file_name: "replacement.pdf",
      storage_path: "user-1/identity/555_replacement.pdf",
      status: "pending_review",
    });
    expect(storagePaths("upload")).toEqual([["user-1/identity/555_replacement.pdf"]]);
    expect(storagePaths("remove")).toEqual([]);

    write.resolve(queryResult(storedRow));
    await expect(pending).resolves.toEqual(storedRow);

    expect(storagePaths("remove")).toEqual([["user-1/identity/verified-original.pdf"]]);
    const commitIndex = io.timeline.indexOf("db-done:documents:update:single");
    const removalIndex = io.timeline.indexOf("storage-remove:user-1/identity/verified-original.pdf");
    expect(commitIndex).toBeGreaterThanOrEqual(0);
    expect(removalIndex).toBeGreaterThan(commitIndex);
  });

  it("cleans up the staged replacement on row-update failure but keeps the old object", async () => {
    vi.spyOn(Date, "now").mockReturnValue(888);
    io.queryResults.push(
      queryResult({ storage_path: "user-1/identity/keep-this.pdf", category: "identity" }),
      { data: null, error: { message: "documents_internal_constraint" } },
    );

    await expect(reuploadDocument(documentRow(), pdfFile("replacement.pdf"))).rejects.toThrow("Something went wrong");

    expect(storagePaths("upload")).toEqual([["user-1/identity/888_replacement.pdf"]]);
    expect(storagePaths("remove")).toEqual([["user-1/identity/888_replacement.pdf"]]);
    expect(storagePaths("remove")).not.toContainEqual(["user-1/identity/keep-this.pdf"]);
  });

  it("does not upload a replacement if the owner-scoped document lookup finds no row", async () => {
    io.queryResults.push(queryResult(null));

    await expect(
      reuploadDocument(documentRow({ storage_path: "victim/private.pdf" }), pdfFile("replacement.pdf")),
    ).rejects.toThrow("Document not found");

    expect(latestQuery("documents", "select").filters).toEqual([
      ["id", "document-1"],
      ["user_id", "user-1"],
    ]);
    expect(io.upload).not.toHaveBeenCalled();
    expect(io.remove).not.toHaveBeenCalled();
  });
});

describe("upload validation and failures", () => {
  const noWrites = () => {
    expect(io.upload).not.toHaveBeenCalled();
    expect(io.queryCalls.some((call) => call.op === "insert")).toBe(false);
  };

  it("refuses a signed-out caller before touching storage or the database", async () => {
    io.userId = null;
    await expect(uploadDocument(pdfFile(), "transcripts")).rejects.toThrow("Not authenticated");
    expect(io.queryCalls).toHaveLength(0);
    noWrites();
  });

  it("rejects an unsupported file type", async () => {
    io.queryResults.push(queryResult(null, { count: 0 }));
    const doc = fileWithBytes("essay.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", [0x50, 0x4b, 3, 4]);
    await expect(uploadDocument(doc, "letters")).rejects.toThrow("File type not allowed");
    noWrites();
  });

  it("rejects a file over 10 MB", async () => {
    io.queryResults.push(queryResult(null, { count: 0 }));
    const big = pdfFile("scan.pdf");
    Object.defineProperty(big, "size", { value: 10 * 1024 * 1024 + 1 });
    await expect(uploadDocument(big, "identity")).rejects.toThrow("File too large (10.0 MB). Max 10 MB.");
    noWrites();
  });

  it.each([
    ["PNG", fileWithBytes("photo.png", "image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["JPEG", fileWithBytes("photo.jpg", "image/jpeg", [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])],
  ])("accepts a genuine %s", async (_label, file) => {
    io.queryResults.push(queryResult(null, { count: 0 }), queryResult(documentRow()));
    await expect(uploadDocument(file, "identity")).resolves.toBeTruthy();
    expect(io.upload).toHaveBeenCalledWith(expect.stringMatching(/^user-1\/identity\//), file, { contentType: file.type });
  });

  it("stops at the per-student limit without uploading", async () => {
    io.queryResults.push(queryResult(null, { count: 50 }));
    await expect(uploadDocument(pdfFile(), "transcripts")).rejects.toThrow("Document limit reached (50 max)");
    noWrites();
  });

  it("does not upload when the limit check itself fails", async () => {
    io.queryResults.push({ data: null, error: { message: "count timed out" }, count: null });
    await expect(uploadDocument(pdfFile(), "transcripts")).rejects.toThrow("Something went wrong");
    noWrites();
  });

  it("does not create a row when the storage upload fails", async () => {
    io.queryResults.push(queryResult(null, { count: 0 }));
    io.uploadResults.push({ error: { message: "storage unavailable" } });
    await expect(uploadDocument(pdfFile(), "transcripts")).rejects.toThrow("Something went wrong");
    expect(io.queryCalls.some((call) => call.op === "insert")).toBe(false);
    expect(io.remove).not.toHaveBeenCalled();
  });

  it("still reports the original failure when cleanup of the staged object also fails", async () => {
    vi.spyOn(Date, "now").mockReturnValue(321);
    io.queryResults.push(queryResult(null, { count: 0 }), { data: null, error: { message: "insert failed" } });
    io.removeResults.push({ error: { message: "remove failed" } });
    await expect(uploadDocument(pdfFile(), "transcripts")).rejects.toThrow("Something went wrong");
    expect(storagePaths("remove")).toEqual([["user-1/transcripts/321_official_transcript.pdf"]]);
  });
});

describe("delete failures", () => {
  it("keeps the stored file when the row delete fails", async () => {
    io.queryResults.push({ data: null, error: { message: "delete failed" } });
    await expect(deleteDocument(documentRow())).rejects.toThrow("Something went wrong");
    // The row still exists, so its file must too; otherwise it points at nothing.
    expect(io.remove).not.toHaveBeenCalled();
  });

  it("removes the stored file only after the row delete commits", async () => {
    io.queryResults.push(queryResult([{ storage_path: "user-1/transcripts/gone.pdf" }]));
    await deleteDocument(documentRow());
    expect(io.timeline.indexOf("db-done:documents:delete:then")).toBeGreaterThanOrEqual(0);
    expect(io.timeline.indexOf("storage-remove:user-1/transcripts/gone.pdf")).toBeGreaterThan(
      io.timeline.indexOf("db-done:documents:delete:then"),
    );
  });

  it("finishes removing the file when a retry finds the row already deleted", async () => {
    // First attempt's row delete committed but its response was lost; the
    // student retries and the row is gone. The file must not be left behind.
    io.queryResults.push(queryResult([]));
    await expect(deleteDocument(documentRow({ storage_path: "user-1/identity/passport.pdf" }))).resolves.toBeUndefined();
    expect(storagePaths("remove")).toEqual([["user-1/identity/passport.pdf"]]);
  });

  it("never removes a file outside the caller's folder when the row is already gone", async () => {
    io.queryResults.push(queryResult([]));
    await expect(deleteDocument(documentRow({ storage_path: "user-2/identity/passport.pdf" }))).resolves.toBeUndefined();
    expect(io.remove).not.toHaveBeenCalled();
  });

  it("succeeds once the row is gone even if the file removal fails", async () => {
    io.queryResults.push(queryResult([{ storage_path: "user-1/transcripts/orphan.pdf" }]));
    io.removeResults.push({ error: { message: "remove failed" } });
    await expect(deleteDocument(documentRow())).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("Failed to remove document from storage:", "remove failed");
  });

  it("refuses a signed-out caller", async () => {
    io.userId = null;
    await expect(deleteDocument(documentRow())).rejects.toThrow("Not authenticated");
    expect(io.queryCalls).toHaveLength(0);
    expect(io.remove).not.toHaveBeenCalled();
  });
});

describe("replacement failures", () => {
  it("does not touch the row or the old file when the new upload fails", async () => {
    io.queryResults.push(queryResult({ storage_path: "user-1/identity/keep.pdf", category: "identity" }));
    io.uploadResults.push({ error: { message: "storage unavailable" } });
    await expect(reuploadDocument(documentRow(), pdfFile("new.pdf"))).rejects.toThrow("Something went wrong");
    expect(io.queryCalls.some((call) => call.op === "update")).toBe(false);
    expect(io.remove).not.toHaveBeenCalled();
  });

  it("rejects invalid replacement content before looking anything up", async () => {
    const fake = fileWithBytes("fake.png", "image/png", [0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0]);
    await expect(reuploadDocument(documentRow(), fake)).rejects.toThrow("File content does not match");
    expect(io.queryCalls).toHaveLength(0);
    expect(io.upload).not.toHaveBeenCalled();
  });

  it("keeps the replacement when only the old file removal fails", async () => {
    vi.spyOn(Date, "now").mockReturnValue(42);
    const saved = documentRow({ storage_path: "user-1/identity/42_new.pdf" });
    io.queryResults.push(queryResult({ storage_path: "user-1/identity/old.pdf", category: "identity" }), queryResult(saved));
    io.removeResults.push({ error: { message: "remove failed" } });
    await expect(reuploadDocument(documentRow(), pdfFile("new.pdf"))).resolves.toEqual(saved);
    expect(console.error).toHaveBeenCalledWith("Failed to remove replaced document from storage:", "remove failed");
  });

  it("reports a lookup failure as a failure, not as a missing document", async () => {
    io.queryResults.push({ data: null, error: { message: "lookup timed out" } });
    await expect(reuploadDocument(documentRow(), pdfFile("new.pdf"))).rejects.toThrow("Something went wrong");
    expect(io.upload).not.toHaveBeenCalled();
  });
});

describe("listing and access failures", () => {
  it("lists only the caller's documents, newest first", async () => {
    io.queryResults.push(queryResult([documentRow()]));
    await expect(fetchDocuments()).resolves.toHaveLength(1);
    expect(latestQuery("documents", "select").filters).toEqual([["user_id", "user-1"]]);
    expect(latestQuery("documents", "select").orders).toEqual([["uploaded_at", { ascending: false }]]);
  });

  it("surfaces a sanitized list failure", async () => {
    io.queryResults.push({ data: null, error: { message: "relation documents does not exist" } });
    await expect(fetchDocuments()).rejects.toThrow("Something went wrong");
  });

  it("refuses signed links for signed-out callers and reports storage failures", async () => {
    io.userId = null;
    await expect(getDocumentSignedUrl("user-1/identity/passport.pdf")).rejects.toThrow("Not authenticated");
    io.userId = "user-1";
    io.signedResult = { data: null, error: { message: "object not found" } };
    await expect(getDocumentSignedUrl("user-1/identity/passport.pdf")).rejects.toThrow("Could not generate URL");
  });
});
