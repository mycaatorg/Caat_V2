import { PageHeader } from "@/components/PageHeader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <DashboardShell />
    </>
  );
}
