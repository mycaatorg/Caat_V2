import { supabase } from "@/src/lib/supabaseClient";
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
        <PageHeader title="Schools" />

        <div className="p-6">
          <main className="max-w-5xl mx-auto">
            <div className="mb-6">
              <SchoolFilterBarClient activeFilter="Bookmarked" />
            </div>
            <BookmarkedSchoolsList />
          </main>
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

  let query = supabase
    .from("schools")
    .select("*", { count: "exact" })
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

  const { data: schools, count, error } = await query;

  if (error) {
    return <div className="p-10 text-red-500">Unable to load schools. Please try again later.</div>;
  }

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
      <PageHeader title="Schools" />

      <div className="p-6">
        <main className="max-w-5xl mx-auto">

          {/* Filter chips */}
          <div className="mb-4">
            <SchoolFilterBarClient activeFilter="All" />
          </div>

          {/* Search + country + sort */}
          <div className="flex flex-col md:flex-row gap-3 mb-6 items-start">
            <div className="flex-1 w-full max-w-md">
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

          {schools && schools.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {schools.map((school) => (
                <Card
                  key={school.id}
                  className="flex flex-col h-full hover:shadow-lg transition-shadow"
                >
                  <CardHeader>
                    <CardTitle className="text-xl line-clamp-2 leading-tight">
                      {school.name}
                    </CardTitle>
                    <CardDescription className="text-base font-medium text-zinc-600 dark:text-zinc-400">
                      {school.country}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow" />

                  <CardFooter className="justify-end flex gap-2">
                    {/* Inline bookmark button */}
                    <SchoolBookmarkButton schoolId={school.id} compact />

                    <Button asChild size="sm" variant="default">
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
              <p className="text-lg font-medium">No schools found</p>
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
        </main>
      </div>
    </>
  );
}
