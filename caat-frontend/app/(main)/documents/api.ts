import { supabase } from "@/src/lib/supabaseClient";

const BUCKET = "user-documents";

function sanitizeFileName(name: string): string {
  return name.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "_");
}

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
  const { data, error } = await supabase
    .from("documents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as DocumentRow;
}

export async function deleteDocument(doc: DocumentRow): Promise<void> {
  await supabase.storage.from(BUCKET).remove([doc.storage_path]);

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", doc.id);

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
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error || !data) throw new Error("Could not generate URL");
  return data.signedUrl;
}
