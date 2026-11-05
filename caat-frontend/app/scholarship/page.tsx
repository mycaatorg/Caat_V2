import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  deriveDisplayTags,
  formatAmountDisplay,
  type ScholarshipRow,
} from "@/types/scholarships";
import { TAG_COLORS } from "@/constants/scholarships";
import {
  getPublicScholarshipsPage,
  PUBLIC_FUNDING_OPTIONS,
  PUBLIC_LEVEL_OPTIONS,
  type PublicSearchParams,
} from "@/lib/public-scholarships";
import { PublicHeader, PublicFooter } from "@/components/public/PublicChrome";
import { publicScholarshipPath } from "@/lib/public-scholarship-identity";

const description =
  "Browse thousands of scholarships for Australian university students. Filter by study level, funding type, and location, then track deadlines and eligibility with a free CAAT account.";

export const metadata: Metadata = {
  title: "Scholarships",
  description,
  alternates: { canonical: "/scholarship" },
  openGraph: {
    type: "website",
    title: "Scholarships | CAAT",
    description,
    url: "/scholarship",
  },
  twitter: {
    card: "summary_large_image",
    title: "Scholarships | CAAT",
    description,
  },
};

function fmtDeadline(d: string | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ScholarshipCard({ s }: { s: ScholarshipRow }) {
  const tags = deriveDisplayTags(s).slice(0, 3);
  const amount = formatAmountDisplay(s);
  const hasAmount =
    (s.amount_value != null || s.amount_display) && amount !== "See Details";
  const deadline = fmtDeadline(s.deadline_at);

  return (
    <Link
      href={publicScholarshipPath(s.slug!, s.id)}
      className="flex flex-col border border-black rounded-md bg-white p-5 hover:shadow-[4px_4px_0_0_#9a1a27] hover:-translate-y-0.5 transition-all duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#9a1a27] focus-visible:outline-offset-2"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9a1a27] mb-1.5">
        {s.provider_name}
      </span>
      <h2 className="text-base font-semibold leading-snug text-black mb-2 font-serif">
        {s.title}
      </h2>
      {!s.is_active && <p className="text-xs font-semibold text-[#525252] mb-2">Archived listing</p>}
      {hasAmount && <p className="text-lg font-bold text-black mb-2">{amount}</p>}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide ${
                TAG_COLORS[tag] ?? "bg-zinc-100 text-zinc-700"
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto text-xs text-[#525252]">
        {!s.is_active ? (deadline ? `Recorded deadline ${deadline}` : "Deadline not recorded") : (deadline ? `Closes ${deadline}` : "Rolling / see details")}
      </div>
    </Link>
  );
}

function buildQuery(base: PublicSearchParams, overrides: Record<string, string | undefined>) {
  const merged: Record<string, string | undefined> = { ...base, ...overrides };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v && v !== "" && !(k === "open" && v !== "1")) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/scholarship?${qs}` : "/scholarship";
}

export default async function PublicScholarshipsIndex({
  searchParams,
}: {
  searchParams: Promise<PublicSearchParams>;
}) {
  const params = await searchParams;
  const { rows, totalCount, currentPage, pageSize } =
    await getPublicScholarshipsPage(params);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-black bg-[#faf5f2]">
          <div className="max-w-6xl mx-auto px-6 lg:px-12 py-14 md:py-20">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#9a1a27] mb-3">
              For Australian students
            </p>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl font-serif">
              Find scholarships for your Australian university journey
            </h1>
            <p className="mt-4 text-base md:text-lg text-[#404040] max-w-2xl">
              Search {totalCount.toLocaleString()} scholarships from Australian
              universities and providers. Create a free CAAT account to save the
              ones you want and track their deadlines against your UAC timeline.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center bg-[#9a1a27] text-white text-xs tracking-widest uppercase px-8 py-3.5 border border-[#9a1a27] rounded-md hover:bg-white hover:text-[#9a1a27] transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#9a1a27] focus-visible:outline-offset-2 font-code"
              >
                Create free account
              </Link>
              <Link
                href="/scholarships"
                className="text-sm text-[#525252] hover:text-black hover:underline"
              >
                Already have an account? Go to your tracker
              </Link>
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-10">
          {/* Filters */}
          <form
            method="get"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-8"
          >
            <div className="lg:col-span-2 flex items-center border border-black rounded-md px-3">
              <Search className="h-4 w-4 text-[#525252] shrink-0" />
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Search by name or provider"
                aria-label="Search scholarships"
                className="w-full px-2 py-2.5 text-sm bg-transparent focus:outline-none"
              />
            </div>
            <input
              type="text"
              name="location"
              defaultValue={params.location ?? ""}
              placeholder="University or state"
              aria-label="Location"
              className="border border-black rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#9a1a27] focus-visible:outline-offset-2"
            />
            <select
              name="level"
              defaultValue={params.level ?? ""}
              aria-label="Study level"
              className="border border-black rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none"
            >
              <option value="">Any study level</option>
              {PUBLIC_LEVEL_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select
              name="funding"
              defaultValue={params.funding ?? ""}
              aria-label="Funding type"
              className="border border-black rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none"
            >
              <option value="">Any funding type</option>
              {PUBLIC_FUNDING_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-[#404040]">
                <input
                  type="checkbox"
                  name="open"
                  value="1"
                  defaultChecked={params.open === "1"}
                  className="h-4 w-4 accent-[#9a1a27]"
                />
                Active listings only
              </label>
              <button
                type="submit"
                className="bg-black text-white text-xs tracking-widest uppercase px-6 py-2.5 rounded-md hover:bg-[#9a1a27] transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-2 font-code"
              >
                Apply filters
              </button>
              <Link
                href="/scholarship"
                className="text-sm text-[#525252] hover:text-black hover:underline"
              >
                Clear
              </Link>
            </div>
          </form>

          {/* Results */}
          <p className="text-sm text-[#525252] mb-4">
            {totalCount > 0
              ? `Showing ${start}-${end} of ${totalCount.toLocaleString()} scholarships`
              : "No scholarships match those filters"}
          </p>

          {rows.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rows.map((s) => (
                <ScholarshipCard key={s.id} s={s} />
              ))}
            </div>
          ) : (
            <div className="border border-[#E5E5E5] rounded-md p-10 text-center text-[#525252]">
              Try widening your filters, or{" "}
              <Link href="/scholarship" className="text-[#9a1a27] hover:underline">
                clear them
              </Link>
              .
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-10 flex items-center justify-between"
            >
              {currentPage > 1 ? (
                <Link
                  href={buildQuery(params, { page: String(currentPage - 1) })}
                  rel="prev"
                  className="text-sm border border-black rounded-md px-5 py-2.5 hover:bg-black hover:text-white transition-colors duration-100"
                >
                  Previous
                </Link>
              ) : (
                <span className="text-sm border border-[#E5E5E5] text-[#a3a3a3] rounded-md px-5 py-2.5">
                  Previous
                </span>
              )}
              <span className="text-sm text-[#525252]">
                Page {currentPage} of {totalPages.toLocaleString()}
              </span>
              {currentPage < totalPages ? (
                <Link
                  href={buildQuery(params, { page: String(currentPage + 1) })}
                  rel="next"
                  className="text-sm border border-black rounded-md px-5 py-2.5 hover:bg-black hover:text-white transition-colors duration-100"
                >
                  Next
                </Link>
              ) : (
                <span className="text-sm border border-[#E5E5E5] text-[#a3a3a3] rounded-md px-5 py-2.5">
                  Next
                </span>
              )}
            </nav>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
