import { supabase } from "@/src/lib/supabaseClient";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, CheckCircle2, ExternalLink } from "lucide-react";
import BookmarkButton from "./bookmark-button";

const CATEGORY_COLORS: Record<string, string> = {
  Engineering:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Business:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "Health Sciences":
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "Arts & Humanities":
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "Social Sciences":
    "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  "Natural Sciences":
    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  Education:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

export default async function MajorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: major, error } = await supabase
    .from("majors")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !major) {
    notFound();
  }

  const categoryColor =
    CATEGORY_COLORS[major.category] ??
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

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
              <BreadcrumbLink href="/majors">Majors</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbLink>{major.name}</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="p-8 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-6">
          <Link href="/majors">
            <ChevronLeft className="h-4 w-4" />
            Back to Majors
          </Link>
        </Button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="space-y-2">
            <span
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${categoryColor}`}
            >
              {major.category}
            </span>
            <h1 className="text-3xl font-bold">{major.name}</h1>
          </div>
          <BookmarkButton majorId={major.id} />
        </div>

        {major.description && (
          <p className="text-muted-foreground leading-relaxed mb-8">
            {major.description}
          </p>
        )}

        {major.career_paths?.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Career Paths</h2>
            <div className="flex flex-wrap gap-2">
              {major.career_paths.map((path: string) => (
                <span
                  key={path}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-secondary text-secondary-foreground"
                >
                  {path}
                </span>
              ))}
            </div>
          </section>
        )}

        {major.typical_coursework?.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Typical Coursework</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {major.typical_coursework.map((course: string) => (
                <div key={course} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  {course}
                </div>
              ))}
            </div>
          </section>
        )}

        {major.qs_ranking_url && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">World Rankings</h2>
            <a
              href={major.qs_ranking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline underline-offset-4"
            >
              <ExternalLink className="h-4 w-4" />
              View QS World University Rankings for {major.name}
            </a>
          </section>
        )}
      </div>
    </>
  );
}
