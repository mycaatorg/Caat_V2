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
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from "@/components/ui/breadcrumb";
import { ChevronLeft, ChevronRight, Link as LinkIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import SchoolSearch from "./school-search";
import CountrySelect from "./country-select";
import { BookmarkedSchoolsList } from "./schools-client";
import SchoolFilterBarClient from "./school-filter-bar-client";

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; country?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const activeFilter = params.filter === "bookmarked" ? "Bookmarked" : "All";

  // ----- Bookmarked view — no DB query needed here, client component handles it -----
  if (activeFilter === "Bookmarked") {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink>Schools</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="min-h-screen p-8">
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
  const selectedCountry = params.country || "Australia";
  const itemsPerPage = 24;

  const from = (currentPage - 1) * itemsPerPage;
  const to = from + itemsPerPage - 1;

  let query = supabase
    .from("schools")
    .select("*", { count: "exact" })
    .eq("country", selectedCountry)
    .range(from, to);

  if (searchQuery) {
    const orQuery = `name.ilike.${searchQuery}%,name.ilike.% ${searchQuery}%,name.ilike.%(${searchQuery})%`;
    query = query.or(orQuery);
  }

  query = query.order("name", { ascending: true });

  const { data: schools, count, error } = await query;

  if (error) {
    return <div className="p-10 text-red-500">Error: {error.message}</div>;
  }

  const totalPages = count ? Math.ceil(count / itemsPerPage) : 0;

  const createPageUrl = (page: number) => {
    const urlParams = new URLSearchParams();
    urlParams.set("page", page.toString());
    if (searchQuery) urlParams.set("q", searchQuery);
    if (selectedCountry) urlParams.set("country", selectedCountry);
    return `/schools?${urlParams.toString()}`;
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink>Schools</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="min-h-screen p-8">
        <main className="max-w-5xl mx-auto">

          {/* Filter chips */}
          <div className="mb-4">
            <SchoolFilterBarClient activeFilter="All" />
          </div>

          {/* Search + country */}
          <div className="flex flex-col md:flex-row gap-4 mb-6 items-start">
            <div className="flex-1 w-full max-w-md">
              <SchoolSearch defaultValue={searchQuery} />
            </div>
            <CountrySelect defaultValue={selectedCountry} />
          </div>

          <div className="mb-10 flex flex-col gap-2">
            <p className="text-zinc-500 dark:text-zinc-400">
              Showing {count || 0} results in <strong>{selectedCountry}</strong>{" "}
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
                    <Button asChild size="sm" variant="default">
                      <Link href={`/schools/${school.id}`}>View Details</Link>
                    </Button>

                    {school.website ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button asChild size="icon" variant="outline">
                              <a
                                href={school.website}
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
              <Button
                variant="outline"
                disabled={currentPage <= 1}
                asChild={currentPage > 1}
              >
                {currentPage > 1 ? (
                  <Link href={createPageUrl(currentPage - 1)}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                  </Link>
                ) : (
                  <button aria-disabled="true" disabled>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                  </button>
                )}
              </Button>

              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                disabled={currentPage >= totalPages}
                asChild={currentPage < totalPages}
              >
                {currentPage < totalPages ? (
                  <Link href={createPageUrl(currentPage + 1)}>
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                ) : (
                  <button aria-disabled="true" disabled>
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </button>
                )}
              </Button>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
