import { CourseNavigation } from "@/components/courses/course-navigation";
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
      <div className="px-4 sm:px-6 pt-6 max-w-6xl mx-auto w-full"><CourseNavigation current="majors" /></div>
      <Suspense>
        <MajorsClient majors={majors} initialFilter={initialFilter} profile={profile} />
      </Suspense>
    </>
  );
}
