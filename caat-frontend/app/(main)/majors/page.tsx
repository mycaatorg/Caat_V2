import { Suspense } from "react";
import { fetchProfileServer } from "@/lib/profile-server";
import { getMajorsList } from "@/lib/majors-catalog";
import { PageHeader } from "@/components/PageHeader";
import MajorsClient from "./client";
import type { FilterView } from "@/types/majors";

export default async function MajorsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const initialFilter = (params.category ?? "All") as FilterView;

  // C13: cached global majors list (list columns only) + per-user profile.
  const [majors, profile] = await Promise.all([
    getMajorsList(),
    fetchProfileServer(),
  ]);

  return (
    <>
      <PageHeader title="Courses" />
      <Suspense>
        <MajorsClient majors={majors} initialFilter={initialFilter} profile={profile} />
      </Suspense>
    </>
  );
}
