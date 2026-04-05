import { PageHeader } from "@/components/PageHeader";
import ApplicationsClient from "./client";

export default function ApplicationsPage() {
  return (
    <>
      <PageHeader title="Applications" />
      <ApplicationsClient />
    </>
  );
}
