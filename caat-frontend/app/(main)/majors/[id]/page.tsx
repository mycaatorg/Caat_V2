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
import { ChevronLeft, ExternalLink } from "lucide-react";
import BookmarkButton from "./bookmark-button";

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

      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-8">
        {/* Back link */}
        <Link
          href="/majors"
          className="inline-flex items-center gap-1.5 text-xs font-code tracking-wide text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Majors
        </Link>

        {/* Title block */}
        <div className="border-b border-border pb-6 mb-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <span className="inline-block border border-border text-[10px] font-code tracking-[0.15em] uppercase px-2.5 py-1 text-muted-foreground">
                {major.category}
              </span>
              <h1 className="text-3xl md:text-4xl font-bold font-display tracking-tight leading-tight">
                {major.name}
              </h1>
            </div>
            <BookmarkButton majorId={major.id} />
          </div>
          {major.description && (
            <p className="text-muted-foreground leading-relaxed mt-4 max-w-2xl font-serif">
              {major.description}
            </p>
          )}
        </div>

        {/* Career Paths */}
        {major.career_paths?.length > 0 && (
          <section className="border-b border-border py-6">
            <h2 className="text-[10px] font-code tracking-[0.18em] uppercase text-muted-foreground mb-4">
              Career Paths
            </h2>
            <div className="flex flex-wrap gap-2">
              {major.career_paths.map((path: string) => (
                <span
                  key={path}
                  className="inline-block border border-border px-3 py-1.5 text-sm font-serif"
                >
                  {path}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Typical Coursework */}
        {major.typical_coursework?.length > 0 && (
          <section className="border-b border-border py-6">
            <h2 className="text-[10px] font-code tracking-[0.18em] uppercase text-muted-foreground mb-4">
              Typical Coursework
            </h2>
            <div className="border border-border">
              {major.typical_coursework.map((course: string, i: number) => (
                <div
                  key={course}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-serif ${
                    i < major.typical_coursework.length - 1
                      ? "border-b border-border"
                      : ""
                  }`}
                >
                  <div className="w-1.5 h-1.5 bg-foreground flex-shrink-0" />
                  {course}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* World Rankings */}
        {major.qs_ranking_url && (
          <section className="py-6">
            <h2 className="text-[10px] font-code tracking-[0.18em] uppercase text-muted-foreground mb-4">
              World Rankings
            </h2>
            <a
              href={major.qs_ranking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-serif border border-border px-4 py-2.5 hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
              View QS World University Rankings for {major.name}
            </a>
          </section>
        )}
      </div>
    </>
  );
}
