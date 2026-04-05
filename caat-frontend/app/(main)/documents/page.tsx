import { PageHeader } from "@/components/PageHeader";
import DocumentVaultClient from "./client";

export default function DocumentsPage() {
  return (
    <>
      <PageHeader title="Documents" />
      <DocumentVaultClient />
    </>
  );
}
