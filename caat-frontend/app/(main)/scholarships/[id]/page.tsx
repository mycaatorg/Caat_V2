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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronLeft,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Globe,
  GraduationCap,
  BadgeCheck,
  Users,
  RefreshCw,
  FileText,
} from "lucide-react";
import ScholarshipBookmarkButton from "./bookmark-button";
import { ScholarshipRow, deriveDisplayTags, formatAmountDisplay } from "@/types/scholarships";
import { safeHref } from "@/lib/safe-href";
import { TAG_COLORS } from "@/constants/scholarships";

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------
const NONE = (
  <span className="text-muted-foreground italic">No information yet</span>
);

function val(v: string | number | null | undefined) {
  if (v == null || v === "") return NONE;
  return <span>{String(v)}</span>;
}

function arrVal(arr: string[] | null | undefined, formatter?: (s: string) => string) {
  if (!arr || arr.length === 0) return NONE;
  const items = formatter ? arr.map(formatter) : arr;
  return <span>{items.join(", ")}</span>;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const FREQ_LABELS: Record<string, string> = {
  one_time: "One-time",
  yearly: "Yearly",
  semester: "Per Semester",
  monthly: "Monthly",
  custom: "Custom",
};

const FUNDING_LABELS: Record<string, string> = {
  merit: "Merit-Based",
  need: "Need-Based",
  full_ride: "Full Ride",
  tuition: "Tuition Remission",
};

// ---------------------------------------------------------------------------
// Detail row used in the Key Details grid
// ---------------------------------------------------------------------------
function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function ScholarshipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("scholarships")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const scholarship = data as ScholarshipRow;
  const displayTags = deriveDisplayTags(scholarship);
  const amountDisplay = formatAmountDisplay(scholarship);

  // Parse known fields from application_requirements JSONB
  const appReqs = scholarship.application_requirements as {
    application_mode?: string;
    separate_application_required?: boolean;
    must_meet?: string[];
  } | null;

  return (
    <>
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/scholarships">Scholarships</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbLink className="max-w-xs truncate">
                {scholarship.title}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="p-8 max-w-3xl mx-auto">
        {/* Back button */}
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-6">
          <Link href="/scholarships">
            <ChevronLeft className="h-4 w-4" />
            Back to Scholarships
          </Link>
        </Button>

        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                              */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
            {scholarship.provider_name}
          </span>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <ScholarshipBookmarkButton scholarshipId={scholarship.id} />
            {safeHref(scholarship.external_url) && (
              <Button asChild variant="default" size="sm" className="gap-1.5">
                <a
                  href={safeHref(scholarship.external_url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Visit Official Site
                </a>
              </Button>
            )}
          </div>
        </div>

        <h1 className="text-3xl font-bold leading-tight mb-3">
          {scholarship.title}
        </h1>

        {/* Tags */}
        {displayTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {displayTags.map((tag) => {
              const color =
                TAG_COLORS[tag] ?? "bg-zinc-100 text-zinc-700";
              return (
                <span
                  key={tag}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${color}`}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        {/* Amount */}
        <p className="text-4xl font-bold mb-8">{amountDisplay}</p>

        {/* ---------------------------------------------------------------- */}
        {/* About                                                             */}
        {/* ---------------------------------------------------------------- */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">About this Scholarship</CardTitle>
          </CardHeader>
          <CardContent>
            {scholarship.description || scholarship.eligibility_summary ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {scholarship.description ?? scholarship.eligibility_summary}
              </p>
            ) : (
              NONE
            )}
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Key Details                                                       */}
        {/* ---------------------------------------------------------------- */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Key Details</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-0 pb-2">
            <DetailRow
              icon={Globe}
              label="Country"
              value={val(scholarship.country)}
            />
            <DetailRow
              icon={GraduationCap}
              label="Study Level"
              value={arrVal(scholarship.study_level, (s) =>
                s.charAt(0).toUpperCase() + s.slice(1)
              )}
            />
            <DetailRow
              icon={BadgeCheck}
              label="Funding Type"
              value={arrVal(scholarship.funding_type, (f) =>
                FUNDING_LABELS[f] ?? f
              )}
            />
            <DetailRow
              icon={Users}
              label="Awards Available"
              value={
                scholarship.awards_count != null
                  ? <span>{scholarship.awards_count.toLocaleString()}</span>
                  : NONE
              }
            />
            <DetailRow
              icon={RefreshCw}
              label="Frequency"
              value={
                scholarship.frequency
                  ? <span>{FREQ_LABELS[scholarship.frequency] ?? scholarship.frequency}</span>
                  : NONE
              }
            />
            <DetailRow
              icon={Calendar}
              label="Application Opens"
              value={val(fmtDate(scholarship.application_open_at))}
            />
            <DetailRow
              icon={Calendar}
              label="Deadline"
              value={val(fmtDate(scholarship.deadline_at))}
            />
            <DetailRow
              icon={GraduationCap}
              label="Start Term"
              value={val(scholarship.start_term)}
            />
            <DetailRow
              icon={RefreshCw}
              label="Recurring"
              value={<span>{scholarship.is_recurring ? "Yes" : "No"}</span>}
            />
            <DetailRow
              icon={FileText}
              label="Requires Essay"
              value={
                scholarship.requires_essay == null
                  ? NONE
                  : <span>{scholarship.requires_essay ? "Yes" : "No"}</span>
              }
            />
            <DetailRow
              icon={BadgeCheck}
              label="Minimum GPA"
              value={
                scholarship.minimum_gpa != null
                  ? <span>{scholarship.minimum_gpa.toFixed(2)}</span>
                  : NONE
              }
            />
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Eligibility                                                       */}
        {/* ---------------------------------------------------------------- */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Eligibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Eligible countries */}
            {scholarship.eligible_countries.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Open to citizens of
                </p>
                <p className="text-sm">{scholarship.eligible_countries.join(", ")}</p>
              </div>
            )}

            {/* Excluded countries */}
            {scholarship.excluded_countries.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Not available to citizens of
                </p>
                <p className="text-sm">{scholarship.excluded_countries.join(", ")}</p>
              </div>
            )}

            {/* Eligibility summary */}
            {scholarship.eligibility_summary ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {scholarship.eligibility_summary}
              </p>
            ) : (
              scholarship.eligible_countries.length === 0 &&
              scholarship.excluded_countries.length === 0 &&
              NONE
            )}
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Application Requirements                                          */}
        {/* ---------------------------------------------------------------- */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Application Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            {appReqs ? (
              <div className="space-y-4">
                {/* Mode */}
                {appReqs.application_mode && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Application mode:</span>
                    <span className="font-medium capitalize">
                      {appReqs.application_mode.replace(/_/g, " ")}
                    </span>
                    {appReqs.separate_application_required === false && (
                      <span className="text-xs text-muted-foreground">
                        (no separate application needed)
                      </span>
                    )}
                  </div>
                )}

                {/* Must-meet checklist */}
                {appReqs.must_meet && appReqs.must_meet.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      You must meet all of the following
                    </p>
                    <ul className="space-y-2">
                      {appReqs.must_meet.map((req, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              NONE
            )}
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Bottom CTA — visit official site                                  */}
        {/* ---------------------------------------------------------------- */}
        {scholarship.external_url && (
          <div className="flex justify-center">
            <Button asChild size="lg" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <a
                href={scholarship.external_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                Apply on Official Site
              </a>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
