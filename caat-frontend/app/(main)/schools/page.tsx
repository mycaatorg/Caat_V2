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
import { ChevronLeft, ChevronRight, Link as LinkIcon } from "lucide-react";import { SidebarTrigger } from "@/components/ui/sidebar";

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // 1. Resolve Search Params (Next.js 15/16 requires awaiting this)
  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const itemsPerPage = 24; // 24 is nice because it divides by 2 and 3 (grid layout)

  // 2. Calculate the Range for Supabase
  // Page 1: 0 to 23
  // Page 2: 24 to 47
  const from = (currentPage - 1) * itemsPerPage;
  const to = from + itemsPerPage - 1;

  // 3. Fetch Data with Filter AND Pagination
  // We also get 'count' to know when to disable the "Next" button
  const { data: schools, count, error } = await supabase
    .from("schools")
    .select("*", { count: "exact" }) // Request the total count of matching rows
    .eq("country", "United States") // <--- FILTER: Only US Schools
    .range(from, to); // <--- PAGINATION: Only fetch this slice

  if (error) {
    return <div className="p-10 text-red-500">Error: {error.message}</div>;
  }

  // Calculate total pages for UI
  const totalPages = count ? Math.ceil(count / itemsPerPage) : 0;

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

          {/* Results Info */}
          <div className="mb-10 flex flex-col gap-2">
            <p className="text-zinc-500 dark:text-zinc-400">
              Showing {schools?.length} results (Page {currentPage} of {totalPages})
            </p>
          </div>

          {/* Main school cards section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {schools?.map((school) => (
              
              // Each school card
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
                <CardContent className="flex-grow"/>

                {/* Footer buttons */}
                <CardFooter className="justify-end flex gap-2"> {/* Align icon to the right */}
                  <Button asChild size="sm" variant="default">
                    <Link href={`/schools/${school.id}`}>
                        Bookmark
                    </Link>
                  </Button>

                  {school.website ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button asChild size="icon" variant="outline">
                          <a
                            href={school.website}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <LinkIcon className="h-4 w-4" />
                            {/* Screen readers still need to know what this is */}
                            <span className="sr-only">Visit Website</span>
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Visit Website</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button disabled size="icon" variant="secondary">
                      <LinkIcon className="h-4 w-4 opacity-50" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              disabled={currentPage <= 1}
              asChild={currentPage > 1}
            >
              {currentPage > 1 ? (
                <Link href={`/schools?page=${currentPage - 1}`}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                </Link>
              ) : (
                <ChevronLeft className="mr-2 h-4 w-4" />
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
                <Link href={`/schools?page=${currentPage + 1}`}>
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              ) : (
                <ChevronRight className="ml-2 h-4 w-4" />
              )}
            </Button>
          </div>
        </main>
      </div>
    </>
  );
}