import { PageHeader } from "@/components/PageHeader";
import DocumentVaultClient from "./client";
import { createServerClient } from "@/lib/supabase/server";
import { readOwnedDocuments } from "@/lib/document-reader";
import type { DocumentRow } from "./api";

// C8: resolve the documents list on the server for an instant first paint.
async function fetchDocumentsServer(): Promise<DocumentRow[] | null> {
  const sb = await createServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  try { return await readOwnedDocuments(sb, user.id); }
  catch { return null; }
}

export default async function DocumentsPage() {
  const initialDocs = await fetchDocumentsServer();
  return (
    <>
      <PageHeader title="Documents" />
      <DocumentVaultClient initialDocs={initialDocs} />
    </>
  );
}
