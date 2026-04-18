import { supabase } from "@/src/lib/supabaseClient";
import { sanitizeFileName } from "@/lib/document-utils";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

/**
 * Validates a file by checking its magic bytes (file signature) rather than
 * trusting the browser-reported MIME type, which can be spoofed (E1).
 */
async function validateFileMagicBytes(file: File): Promise<boolean> {
  const buffer = await file.slice(0, 8).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // PDF: %PDF (25 50 44 46)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
  return false;
}

const BUCKET = "user-documents";

export type DocCategory = "transcripts" | "identity" | "language" | "letters";

export interface DocumentRow {
  id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  category: string;
  status: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchDocuments(): Promise<DocumentRow[]> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .order("uploaded_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRow[];
}

export async function uploadDocument(
  file: File,
  category: DocCategory
): Promise<DocumentRow> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  // Validate MIME type against allowlist (E1)
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("File type not allowed. Only PDF, JPG, and PNG are accepted.");
  }

  // Validate actual file content via magic bytes — prevents MIME type spoofing (E1)
  const validBytes = await validateFileMagicBytes(file);
  if (!validBytes) {
    throw new Error("File content does not match an allowed file type.");
  }

  const storagePath = `${user.id}/${category}/${Date.now()}_${sanitizeFileName(file.name)}`;

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type });

  if (storageError) throw new Error(storageError.message);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      file_name: file.name,
      storage_path: storagePath,
      category,
      mime_type: file.type,
      file_size: file.size,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }

  return data as DocumentRow;
}

export async function updateDocumentStatus(
  id: string,
  status: string
): Promise<DocumentRow> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("documents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as DocumentRow;
}

export async function deleteDocument(doc: DocumentRow): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  await supabase.storage.from(BUCKET).remove([doc.storage_path]);

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", doc.id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

export async function reuploadDocument(
  doc: DocumentRow,
  newFile: File
): Promise<DocumentRow> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  // Validate MIME type and magic bytes for re-uploads (E1)
  if (!ALLOWED_MIME_TYPES.has(newFile.type)) {
    throw new Error("File type not allowed. Only PDF, JPG, and PNG are accepted.");
  }
  const validBytes = await validateFileMagicBytes(newFile);
  if (!validBytes) {
    throw new Error("File content does not match an allowed file type.");
  }

  const newStoragePath = `${user.id}/${doc.category}/${Date.now()}_${sanitizeFileName(newFile.name)}`;

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(newStoragePath, newFile, { contentType: newFile.type });

  if (storageError) throw new Error(storageError.message);

  const { data, error } = await supabase
    .from("documents")
    .update({
      file_name: newFile.name,
      storage_path: newStoragePath,
      mime_type: newFile.type,
      file_size: newFile.size,
      status: "pending_review",
      updated_at: new Date().toISOString(),
      uploaded_at: new Date().toISOString(),
    })
    .eq("id", doc.id)
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([newStoragePath]);
    throw new Error(error.message);
  }

  // Remove old file after successful DB update
  await supabase.storage.from(BUCKET).remove([doc.storage_path]);

  return data as DocumentRow;
}

export async function getDocumentSignedUrl(
  storagePath: string
): Promise<string> {
  // Verify the path belongs to the authenticated user before issuing a
  // signed URL — prevents accessing other users' documents (B4)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  if (!storagePath.startsWith(`${user.id}/`)) {
    throw new Error("Not authorized");
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error || !data) throw new Error("Could not generate URL");
  return data.signedUrl;
}
