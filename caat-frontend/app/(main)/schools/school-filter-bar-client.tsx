"use client";

import { SchoolFilterBar, useBookmarkedSchoolCount } from "./schools-client";
import type { SchoolFilterView } from "./schools-client";

export default function SchoolFilterBarClient({
  activeFilter,
}: {
  activeFilter: SchoolFilterView;
}) {
  const bookmarkedCount = useBookmarkedSchoolCount();
  return <SchoolFilterBar activeFilter={activeFilter} bookmarkedCount={bookmarkedCount} />;
}
