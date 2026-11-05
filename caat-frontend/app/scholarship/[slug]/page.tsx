import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ExternalLink,
  Calendar,
  Globe,
  GraduationCap,
  BadgeCheck,
  Users,
  RefreshCw,
  FileText,
} from "lucide-react";
import {
  deriveDisplayTags,
  formatAmountDisplay,
  type ScholarshipRow,
} from "@/types/scholarships";
import { safeHref } from "@/lib/safe-href";
import { TAG_COLORS } from "@/constants/scholarships";
import {
  getPublicScholarshipsBySlug,
  getRelatedScholarships,
} from "@/lib/public-scholarships";
import { PublicHeader, PublicFooter } from "@/components/public/PublicChrome";
import { TrackScholarshipCta } from "@/components/public/TrackScholarshipCta";
import { ScholarshipChoices } from "@/components/public/ScholarshipChoices";
import { publicScholarshipPath, selectPublicScholarship } from "@/lib/public-scholarship-identity";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mycaat.com";

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

function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Short, truthful meta description built from catalog fields.
function buildDescription(s: ScholarshipRow): string {
  if (!s.is_active) return `Archived CAAT listing for ${s.title}. Recorded details may be outdated. Check the official provider for current availability.`.slice(0, 300);
  const sentences: string[] = [];
  const amount = formatAmountDisplay(s);
  const hasAmount =
    (s.amount_value != null || s.amount_display) && amount !== "See Details";
  const lead = hasAmount
    ? `Worth ${amount}, offered by ${s.provider_name}`
    : `Offered by ${s.provider_name}`;
  sentences.push(lead);
  const deadline = fmtDate(s.deadline_at);
  if (deadline) sentences.push(`Applications close ${deadline}`);
  const levels = s.study_level.map(titleCase).join(" and ");
  if (levels) sentences.push(`${levels} study`);
  sentences.push("Check eligibility and application details with the official provider");
  return `${s.title}. ${sentences.join(". ")}.`.slice(0, 300);
}

type Props = { params: Promise<{ slug: string }>; searchParams?: Promise<{ award?: string | string[] }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const award = (await searchParams)?.award;
  const rows = await getPublicScholarshipsBySlug(slug);
  if (award === undefined && rows.length > 1) return {
    title: "Choose a scholarship",
    description: "Choose the scholarship listing you want to view and check its official source.",
    alternates: { canonical: publicScholarshipPath(slug) },
  };
  const s = selectPublicScholarship(rows, award);
  if (!s) {
    return { title: "Scholarship not found", robots: { index: false } };
  }
  const description = buildDescription(s);
  const canonical = publicScholarshipPath(slug, rows.length > 1 ? s.id : undefined);
  return {
    title: s.title,
    description,
    ...(!s.is_active ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: `${s.title} | CAAT`,
      description,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: `${s.title} | CAAT`,
      description,
    },
  };
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  if (value == null) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#E5E5E5] last:border-0">
      <Icon className="h-4 w-4 text-[#9a1a27] mt-0.5 shrink-0" />
      <span className="text-sm text-[#525252] w-40 shrink-0">{label}</span>
      <span className="text-sm font-medium text-black">{value}</span>
    </div>
  );
}

// schema.org structured data. A scholarship is modelled as a MonetaryGrant,
// with a BreadcrumbList for the directory trail.
function JsonLd({ s, canonical }: { s: ScholarshipRow; canonical: string }) {
  const url = new URL(canonical, siteUrl).toString();
  const grant: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "MonetaryGrant",
    name: s.title,
    url,
    funder: {
      "@type": "Organization",
      name: s.provider_name,
    },
  };
  if (s.description || s.eligibility_summary) {
    grant.description = (s.description ?? s.eligibility_summary ?? "").slice(0, 5000);
  }
  if (s.amount_value != null) {
    grant.amount = {
      "@type": "MonetaryAmount",
      value: s.amount_value,
      currency: s.amount_currency ?? "AUD",
    };
  }
  if (s.school_name) {
    grant.sponsor = { "@type": "CollegeOrUniversity", name: s.school_name };
  }

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Scholarships", item: `${siteUrl}/scholarship` },
      { "@type": "ListItem", position: 2, name: s.title, item: url },
    ],
  };

  return (
    <>
      {s.is_active && <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(grant).replace(/</g, '\\u003c') }}
      />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, '\\u003c') }}
      />
    </>
  );
}

export default async function PublicScholarshipPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const award = (await searchParams)?.award;
  const rows = await getPublicScholarshipsBySlug(slug);
  if (award === undefined && rows.length > 1) return <div className="min-h-screen flex flex-col bg-white text-black">
    <PublicHeader /><ScholarshipChoices scholarships={rows} /><PublicFooter />
  </div>;
  const s = selectPublicScholarship(rows, award);
  if (!s) notFound();
  const canonical = publicScholarshipPath(slug, rows.length > 1 ? s.id : undefined);

  const displayTags = deriveDisplayTags(s);
  const amountDisplay = formatAmountDisplay(s);
  const hasAmount =
    (s.amount_value != null || s.amount_display) && amountDisplay !== "See Details";
  const officialUrl = safeHref(s.external_url);
  const related = await getRelatedScholarships(s.id, s.school_name, s.field_of_study ?? []);

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <PublicHeader />
      <JsonLd s={s} canonical={canonical} />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 py-10">
          <Link
            href="/scholarship"
            className="inline-flex items-center gap-1 text-sm text-[#525252] hover:text-black hover:underline mb-6 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-2"
          >
            <ChevronLeft className="h-4 w-4" />
            All scholarships
          </Link>

          <p className="text-xs font-semibold uppercase tracking-wide text-[#9a1a27] mb-2">
            {s.provider_name}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4 font-serif">
            {s.title}
          </h1>

          {!s.is_active && (
            <section aria-labelledby="archived-listing-heading" className="rounded-md border border-[#d6c7bb] bg-[#faf5f2] p-5 mb-6">
              <h2 id="archived-listing-heading" className="font-semibold font-serif mb-2">Archived listing</h2>
              <p className="text-sm text-[#404040] leading-relaxed mb-3">
                This listing is no longer active in the CAAT catalogue. Its recorded details may be outdated.
                Check the official provider for current availability.
              </p>
              <Link href="/scholarship?open=1" className="text-sm font-semibold text-[#9a1a27] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
                Browse active listings
              </Link>
            </section>
          )}

          {displayTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {displayTags.map((tag) => (
                <span
                  key={tag}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md uppercase tracking-wide ${
                    TAG_COLORS[tag] ?? "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {hasAmount && (
            <p className="text-4xl font-bold mb-8 font-serif">{amountDisplay}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-10">
            {s.is_active && <TrackScholarshipCta key={`${s.id}:${slug}`} slug={slug} scholarshipId={s.id} />}
            {officialUrl && (
              <a
                href={officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm border border-black rounded-md px-6 py-3 hover:bg-black hover:text-white transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-2"
              >
                <ExternalLink className="h-4 w-4" />
                Visit official site
              </a>
            )}
          </div>

          {(s.description || s.eligibility_summary) && (
            <section className="mb-10">
              <h2 className="text-lg font-semibold mb-3 font-serif">
                About this scholarship
              </h2>
              <p className="text-sm text-[#404040] leading-relaxed whitespace-pre-line">
                {s.description ?? s.eligibility_summary}
              </p>
            </section>
          )}

          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-1 font-serif">Key details</h2>
            <div className="border border-[#E5E5E5] rounded-md px-5 py-1">
              <DetailRow icon={Globe} label="Country" value={s.country ?? "Not specified"} />
              <DetailRow
                icon={GraduationCap}
                label="Study level"
                value={
                  s.study_level.length
                    ? s.study_level.map(titleCase).join(", ")
                    : "Not specified"
                }
              />
              <DetailRow
                icon={BadgeCheck}
                label="Funding type"
                value={
                  s.funding_type.length
                    ? s.funding_type.map((f) => FUNDING_LABELS[f] ?? f).join(", ")
                    : "Not specified"
                }
              />
              <DetailRow
                icon={Users}
                label="Awards available"
                value={s.awards_count != null ? s.awards_count.toLocaleString() : "Not specified"}
              />
              <DetailRow
                icon={RefreshCw}
                label="Frequency"
                value={s.frequency ? FREQ_LABELS[s.frequency] ?? s.frequency : "Not specified"}
              />
              <DetailRow
                icon={Calendar}
                label="Applications open"
                value={fmtDate(s.application_open_at) ?? "Not specified"}
              />
              <DetailRow
                icon={Calendar}
                label={s.is_active ? "Deadline" : "Recorded deadline"}
                value={fmtDate(s.deadline_at) ?? "Not specified"}
              />
              <DetailRow icon={GraduationCap} label="Start term" value={s.start_term ?? "Not specified"} />
              <DetailRow icon={RefreshCw} label="Recurring" value={s.is_recurring ? "Yes" : "No"} />
              <DetailRow
                icon={FileText}
                label="Requires essay"
                value={s.requires_essay == null ? "Not specified" : s.requires_essay ? "Yes" : "No"}
              />
            </div>
          </section>

          {s.is_active && <section className="rounded-md border border-[#9a1a27] bg-[#faf5f2] p-6 md:p-8">
            <h2 className="text-lg font-semibold mb-2 font-serif">
              Applying to an Australian university?
            </h2>
            <p className="text-sm text-[#404040] leading-relaxed mb-5 max-w-xl">
              Create a free CAAT account to save this scholarship, track its
              deadline against your UAC timeline, and match it to your ATAR and
              study goals alongside thousands of other Australian scholarships.
            </p>
            <TrackScholarshipCta key={`${s.id}:${slug}`} slug={slug} scholarshipId={s.id} />
          </section>}

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-lg font-semibold mb-4 font-serif">
                Related scholarships
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={publicScholarshipPath(r.slug!, r.id)}
                      className="flex flex-col border border-[#E5E5E5] rounded-md p-4 hover:border-black transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#9a1a27] focus-visible:outline-offset-2"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9a1a27] mb-1">
                        {r.provider_name}
                      </span>
                      <span className="text-sm font-medium text-black leading-snug">
                        {r.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
