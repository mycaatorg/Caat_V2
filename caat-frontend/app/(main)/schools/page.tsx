import { createServerClient } from "@/lib/supabase/server";
import { PROFILE_COLUMNS } from "@/lib/profile-columns";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Link as LinkIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { safeHref } from "@/lib/safe-href";
import SchoolSearch from "./school-search";
import CountrySelect from "./country-select";
import SortSelect from "./sort-select";
import { BookmarkedSchoolsList } from "./schools-client";
import SchoolFilterBarClient from "./school-filter-bar-client";
import SchoolBookmarkButton from "./school-bookmark-button";
import type { ProfileRow } from "@/types/profile";
import { matchSchool, type MatchResult } from "@/lib/profile-match";

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

async function fetchSchoolsProfile(
  sb: ServerClient,
  userId: string | null,
): Promise<ProfileRow | null> {
  if (!userId) return null;
  const profileRes = await sb
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  return (profileRes.data as unknown as ProfileRow | null) ?? null;
}

// C7: badge the current page's schools with the majors they offer. Fetch only
// the join rows for the page's school ids (was fetching the entire
// school_majors table on every /schools view for any user with target_majors).
async function fetchOfferedMajors(
  sb: ServerClient,
  schoolIds: number[],
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (schoolIds.length === 0) return map;
  const sjRes = await sb
    .from("school_majors")
    .select("school_id, majors(name)")
    .in("school_id", schoolIds);
  for (const row of (sjRes.data ?? []) as unknown as {
    school_id: number;
    majors: { name: string } | null;
  }[]) {
    if (!row.majors) continue;
    const list = map.get(row.school_id) ?? [];
    list.push(row.majors.name);
    map.set(row.school_id, list);
  }
  return map;
}

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; country?: string; sort?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const activeFilter = params.filter === "bookmarked" ? "Bookmarked" : "All";

  // ----- Bookmarked view — client component handles the query -----
  if (activeFilter === "Bookmarked") {
    return (
      <>
        <PageHeader title="Universities" />

        <div className="p-6">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <SchoolFilterBarClient activeFilter="Bookmarked" />
            </div>
            <BookmarkedSchoolsList />
          </div>
        </div>
      </>
    );
  }

  // ----- Normal paginated view -----
  const currentPage = Number(params.page) || 1;
  const searchQuery = params.q || "";
  const selectedCountry = params.country || "";
  const sortParam = params.sort || "name_asc";
  const itemsPerPage = 24;

  const from = (currentPage - 1) * itemsPerPage;
  const to = from + itemsPerPage - 1;

  const sb = await createServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const userId = user?.id ?? null;

  let query = sb
    .from("schools")
    // C12: estimated count avoids a full-table exact count on every view; the
    // leading-wildcard ilike search can't use a btree index, and a pg_trgm GIN
    // index on schools.name (migration 20260704120500) backs the search.
    .select("*", { count: "estimated" })
    // Hide rows explicitly tagged as high_school; null + everything else is visible.
    .or("institution_type.is.null,institution_type.neq.high_school")
    .range(from, to);

  if (selectedCountry) {
    query = query.eq("country", selectedCountry);
  }

  if (searchQuery) {
    // Strip PostgREST filter syntax characters to prevent filter injection (C1).
    // These chars (. , ( )) are used as delimiters in PostgREST's .or() syntax
    // and would allow a crafted ?q= value to inject additional filter clauses.
    const safeQuery = searchQuery.replace(/[.,()]/g, "");
    if (safeQuery) {
      const orQuery = `name.ilike.${safeQuery}%,name.ilike.% ${safeQuery}%,name.ilike.%(${safeQuery})%`;
      query = query.or(orQuery);
    }
  }

  // Apply sort
  if (sortParam === "name_desc") {
    query = query.order("name", { ascending: false });
  } else if (sortParam === "country_asc") {
    query = query.order("country", { ascending: true }).order("name", { ascending: true });
  } else {
    query = query.order("name", { ascending: true });
  }

  const [schoolsRes, profile, bookmarkedRes] = await Promise.all([
    query,
    fetchSchoolsProfile(sb, userId),
    // C2: fetch the whole bookmarked-schools set in ONE query, up front, so
    // each card gets its state as a prop instead of firing its own
    // getUser + bookmark query on mount (~48 requests per /schools load).
    userId
      ? sb
          .from("user_bookmarked_schools")
          .select("school_id")
          .eq("user_id", userId)
      : Promise.resolve({ data: null }),
  ]);
  const { data: schools, count, error } = schoolsRes;

  // C7: only fetch offered majors for the schools on this page (and only when
  // the user has target majors to match against).
  const offeredMajorsBySchool =
    profile?.target_majors?.length && schools?.length
      ? await fetchOfferedMajors(
          sb,
          schools.map((s) => s.id),
        )
      : new Map<number, string[]>();

  const bookmarkedSchoolIds = new Set(
    ((bookmarkedRes.data as { school_id: number }[] | null) ?? []).map(
      (r) => r.school_id,
    ),
  );

  if (error) {
    return <div className="p-10 text-[#9a1a27] dark:text-[#e06b78]">Unable to load schools. Please try again later.</div>;
  }

  // Compute match per school and sort matched ones to the top within this page.
  // TODO(B12/C1): this only reorders the current page's slice, so a strongly
  // matched school on a later page never surfaces on page 1. A correct fix must
  // sort by match at the query level BEFORE pagination, which depends on
  // Phase 3's server-side pagination (finding C1). Deferred until C1 lands —
  // do not half-fix here.
  type SchoolBase = NonNullable<typeof schools>[number];
  type SchoolWithMatch = SchoolBase & { __match: MatchResult };
  const schoolsWithMatch: SchoolWithMatch[] = (schools ?? []).map((sch) => ({
    ...sch,
    __match: matchSchool(
      profile,
      { id: sch.id, name: sch.name, country: sch.country },
      offeredMajorsBySchool.get(sch.id)
    ),
  }));
  schoolsWithMatch.sort((a, b) => b.__match.score - a.__match.score);

  const totalPages = count ? Math.ceil(count / itemsPerPage) : 0;

  const createPageUrl = (page: number) => {
    const urlParams = new URLSearchParams();
    urlParams.set("page", page.toString());
    if (searchQuery) urlParams.set("q", searchQuery);
    if (selectedCountry) urlParams.set("country", selectedCountry);
    if (sortParam && sortParam !== "name_asc") urlParams.set("sort", sortParam);
    return `/schools?${urlParams.toString()}`;
  };

  const countryLabel = selectedCountry || "All Countries";

  return (
    <>
      <PageHeader title="Universities" />

      <div className="p-6">
        <div className="max-w-5xl mx-auto">

          {/* Filter chips */}
          <div className="mb-4">
            <SchoolFilterBarClient activeFilter="All" />
          </div>

          {/* Search + country + sort */}
          <div className="flex flex-col md:flex-row gap-3 mb-6 items-start">
            <div className="flex-1 w-full">
              <SchoolSearch defaultValue={searchQuery} />
            </div>
            <CountrySelect defaultValue={selectedCountry} />
            <SortSelect defaultValue={sortParam} />
          </div>

          <div className="mb-6">
            <p className="text-zinc-500 dark:text-zinc-400">
              Showing {count || 0} results in <strong>{countryLabel}</strong>{" "}
              {totalPages > 0 && `(Page ${currentPage} of ${totalPages})`}
            </p>
          </div>

          {schoolsWithMatch.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {schoolsWithMatch.map((school) => (
                <Card
                  key={school.id}
                  className={`flex flex-col h-full hover:shadow-lg transition-shadow ${school.__match.reason ? "border-l-[3px] border-l-[#9a1a27]" : ""}`}
                >
                  <CardHeader className="gap-2">
                    {school.__match.reason && (
                      <span className="inline-block self-start bg-[#9a1a27] text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-1 leading-tight">
                        ★ {school.__match.reason}
                      </span>
                    )}
                    {/* Title row + bookmark (top right, matches scholarship card) */}
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl line-clamp-2 leading-tight">
                        {school.name}
                      </CardTitle>
                      <SchoolBookmarkButton
                        schoolId={school.id}
                        compact
                        initialBookmarked={bookmarkedSchoolIds.has(school.id)}
                      />
                    </div>
                    <CardDescription className="text-base font-medium text-zinc-600 dark:text-zinc-400">
                      {school.country}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow" />

                  <CardFooter className="pt-0 gap-2">
                    {/* Full-width primary CTA — matches scholarship card */}
                    <Button asChild className="flex-1">
                      <Link href={`/schools/${school.id}`}>View Details</Link>
                    </Button>

                    {safeHref(school.website) ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button asChild size="icon" variant="outline">
                              <a
                                href={safeHref(school.website)!}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <LinkIcon className="h-4 w-4" />
                                <span className="sr-only">Visit Website</span>
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Visit Website</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Button disabled size="icon" variant="secondary">
                        <LinkIcon className="h-4 w-4 opacity-50" />
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <p className="text-lg font-medium">No universities found</p>
              <p className="text-sm mt-1">Try adjusting your search query or country filter.</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              {currentPage > 1 ? (
                <Button variant="outline" asChild>
                  <Link href={createPageUrl(currentPage - 1)}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                </Button>
              )}

              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Page {currentPage} of {totalPages}
              </span>

              {currentPage < totalPages ? (
                <Button variant="outline" asChild>
                  <Link href={createPageUrl(currentPage + 1)}>
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
