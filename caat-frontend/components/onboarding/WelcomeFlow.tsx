"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import {
  completeOnboarding,
  dismissOnboarding,
  fetchTrackedIds,
  graduationYearFor,
  mayDeriveGraduationYear,
  mergeUnique,
  rankOnboardingMatches,
  saveOnboardingAnswers,
  saveScholarshipIfNew,
  type OnboardingAnswers,
  type OnboardingProfile,
  type RankedScholarship,
} from "@/lib/onboarding";
import type { JourneyStage, StudentStatus, YearLevel } from "@/types/profile";
import type { ScholarshipRow } from "@/types/scholarships";

const MAROON = "text-[#9a1a27] dark:text-[#e06b78]";

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

const YEAR_LEVELS: Option<YearLevel>[] = [
  { value: "year_10", label: "Year 10" },
  { value: "year_11", label: "Year 11" },
  { value: "year_12", label: "Year 12" },
  { value: "finished", label: "Finished school", hint: "Gap year or already graduated" },
  { value: "not_sure", label: "Not sure / other" },
];

const STATUSES: Option<StudentStatus>[] = [
  { value: "domestic", label: "Domestic student", hint: "Australian or New Zealand citizen, or Australian permanent resident" },
  { value: "international", label: "International student", hint: "On, or planning to get, a student visa" },
  { value: "not_sure", label: "Not sure" },
];

const COUNTRIES = ["Australia", "New Zealand", "United Kingdom", "United States", "Canada", "Singapore"];

// Plain field names: they match words used in scholarship titles and tags.
const INTERESTS = [
  "Engineering", "Medicine", "Nursing", "Health", "Law", "Business", "Commerce", "Science",
  "Computer Science", "Information Technology", "Mathematics", "Education", "Arts", "Design",
  "Architecture", "Psychology", "Music", "Agriculture", "Environment",
];

const STAGES: Option<JourneyStage>[] = [
  { value: "exploring", label: "Just exploring", hint: "Working out what is out there" },
  { value: "shortlisting", label: "Building a shortlist", hint: "Comparing universities, courses and scholarships" },
  { value: "applying", label: "Preparing applications", hint: "Essays, documents and deadlines" },
  { value: "waiting", label: "Applied and waiting", hint: "Tracking offers and outcomes" },
];

const TOTAL_STEPS = 5;

function OptionCard<T extends string>({
  option,
  selected,
  onSelect,
  multi = false,
  tabIndex,
}: {
  option: Option<T>;
  selected: boolean;
  onSelect: () => void;
  multi?: boolean;
  tabIndex?: number;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      tabIndex={tabIndex}
      data-value={option.value}
      onClick={onSelect}
      className={`w-full text-left border px-4 py-3 flex items-start gap-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#9a1a27] ${
        selected ? "border-[#9a1a27] bg-[#9a1a27]/5 dark:border-[#e06b78]" : "hover:bg-muted/60"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 h-4 w-4 shrink-0 border flex items-center justify-center ${
          selected ? "bg-[#9a1a27] border-[#9a1a27] text-white" : "border-muted-foreground/40"
        }`}
      >
        {selected ? <Check className="h-3 w-3" /> : null}
      </span>
      <span>
        <span className="block text-sm font-medium">{option.label}</span>
        {option.hint ? <span className="block text-xs text-muted-foreground mt-0.5">{option.hint}</span> : null}
      </span>
    </button>
  );
}

function Chip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={`border px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#9a1a27] ${
        selected ? "bg-[#9a1a27] border-[#9a1a27] text-white" : "hover:bg-muted/60"
      }`}
    >
      {label}
    </button>
  );
}

/** WAI-ARIA radio group: one tab stop; arrow keys move and select. */
function RadioOptions<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const current = Math.max(0, options.findIndex((o) => o.value === value));
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = options[(current + delta + options.length) % options.length];
    onChange(next.value);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
  }
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2" onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <OptionCard key={o.value} option={o} selected={value === o.value} onSelect={() => onChange(o.value)} tabIndex={i === current ? 0 : -1} />
      ))}
    </div>
  );
}

export function SkipOnboardingLink() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        track("onboarding_dismissed");
        try {
          await dismissOnboarding();
        } catch {
          // Leaving is still fine; Today may offer the questions again later.
        }
        router.push("/today");
      }}
      className="font-code text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
    >
      Skip for now
    </button>
  );
}

/** First unanswered step, so a returning student resumes where they left. */
function resumeStep(p: OnboardingProfile): number {
  if (!p.year_level) return 0;
  if (!p.student_status) return 1;
  if (!p.preferred_countries.length) return 2;
  if (!p.target_majors.length) return 3;
  if (!p.journey_stage) return 4;
  return TOTAL_STEPS;
}

export function WelcomeFlow({ initial }: { initial: OnboardingProfile }) {
  const [step, setStep] = useState(() => resumeStep(initial));
  const [profile, setProfile] = useState(initial);
  const [yearLevel, setYearLevel] = useState<YearLevel | null>(initial.year_level);
  const [status, setStatus] = useState<StudentStatus | null>(initial.student_status);
  const [countries, setCountries] = useState<string[]>(
    initial.preferred_countries.length ? initial.preferred_countries : ["Australia"],
  );
  const [interests, setInterests] = useState<string[]>(initial.target_majors);
  const [stage, setStage] = useState<JourneyStage | null>(initial.journey_stage);
  const [saving, setSaving] = useState(false);
  const started = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      track("onboarding_started", { resumedAt: step });
    }
    // Move focus to each new question for keyboard and screen-reader users.
    headingRef.current?.focus();
  }, [step]);

  async function next(answers: OnboardingAnswers | null) {
    const skipped = answers === null;
    if (!skipped) {
      setSaving(true);
      try {
        await saveOnboardingAnswers(answers);
        setProfile((p) => ({ ...p, ...answers }) as OnboardingProfile);
      } catch {
        toast.error("Could not save that answer. Please try again.");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    track("onboarding_step_completed", { step: step + 1, skipped });
    setStep((s) => s + 1);
  }

  const toggle = (list: string[], value: string) =>
    list.some((v) => v.toLowerCase() === value.toLowerCase()) ? list.filter((v) => v.toLowerCase() !== value.toLowerCase()) : [...list, value];

  if (step >= TOTAL_STEPS) {
    return <Results profile={profile} />;
  }

  const questions: { eyebrow: string; title: React.ReactNode; why: string; body: React.ReactNode; answer: () => OnboardingAnswers | null; ready: boolean }[] = [
    {
      eyebrow: "Year level",
      title: <>Which year are you in <span className={`italic ${MAROON}`}>now</span>?</>,
      why: "Scholarships and application dates depend on when you finish school.",
      body: (
        <RadioOptions label="Year level" options={YEAR_LEVELS} value={yearLevel} onChange={setYearLevel} />
      ),
      // Only derive the final year when the student had none before onboarding,
      // and re-derive it if they go back and change their year level.
      answer: () =>
        yearLevel
          ? { year_level: yearLevel, ...(mayDeriveGraduationYear(initial) ? { graduation_year: graduationYearFor(yearLevel) } : {}) }
          : null,
      ready: yearLevel !== null,
    },
    {
      eyebrow: "Study status",
      title: <>Will you study as a <span className={`italic ${MAROON}`}>domestic</span> student?</>,
      why: "Many Australian scholarships are only open to domestic students, and fees differ.",
      body: (
        <RadioOptions label="Study status" options={STATUSES} value={status} onChange={setStatus} />
      ),
      answer: () => (status ? { student_status: status } : null),
      ready: status !== null,
    },
    {
      eyebrow: "Where to study",
      title: <>Where would you like to <span className={`italic ${MAROON}`}>study</span>?</>,
      why: "Pick any that apply. We show scholarships and universities in these places first.",
      body: (
        <div role="group" aria-label="Where to study" className="flex flex-wrap gap-2">
          {COUNTRIES.map((c) => (
            <Chip key={c} label={c} selected={countries.some((v) => v.toLowerCase() === c.toLowerCase())} onToggle={() => setCountries((l) => toggle(l, c))} />
          ))}
        </div>
      ),
      answer: () => (countries.length ? { preferred_countries: mergeUnique(profile.preferred_countries, countries) } : null),
      ready: countries.length > 0,
    },
    {
      eyebrow: "Interests",
      title: <>What would you like to <span className={`italic ${MAROON}`}>study</span>?</>,
      why: "Choose a few, or skip if you are not sure yet. You can change these any time in your profile.",
      body: (
        <div role="group" aria-label="Interests" className="flex flex-wrap gap-2">
          {INTERESTS.map((c) => (
            <Chip key={c} label={c} selected={interests.some((v) => v.toLowerCase() === c.toLowerCase())} onToggle={() => setInterests((l) => toggle(l, c))} />
          ))}
        </div>
      ),
      answer: () => (interests.length ? { target_majors: mergeUnique(profile.target_majors, interests) } : null),
      ready: interests.length > 0,
    },
    {
      eyebrow: "Where you are up to",
      title: <>Where are you in the <span className={`italic ${MAROON}`}>process</span>?</>,
      why: "This decides what we put first on your Today page.",
      body: (
        <RadioOptions label="Where you are up to" options={STAGES} value={stage} onChange={setStage} />
      ),
      answer: () => (stage ? { journey_stage: stage } : null),
      ready: stage !== null,
    },
  ];
  const q = questions[step];

  return (
    <div className="w-full max-w-xl">
      <div className="flex items-center justify-between">
        <p className="font-code text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Step {step + 1} of {TOTAL_STEPS} · {q.eyebrow}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1" aria-hidden>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <span key={i} className={`h-1 ${i <= step ? "bg-[#9a1a27]" : "bg-muted"}`} />
        ))}
      </div>

      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold tracking-tight mt-8 outline-none">
        {q.title}
      </h1>
      <p className="text-sm text-muted-foreground mt-2">{q.why}</p>

      <div className="mt-6">{q.body}</div>

      <div className="mt-8 flex items-center gap-3">
        {step > 0 ? (
          <Button variant="ghost" className="rounded-none gap-1" onClick={() => setStep((s) => s - 1)} disabled={saving}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        ) : null}
        <span className="flex-1" />
        <Button variant="ghost" className="rounded-none text-muted-foreground" onClick={() => next(null)} disabled={saving}>
          Skip
        </Button>
        <Button
          className="rounded-none bg-[#9a1a27] hover:bg-[#7d141f] text-white gap-1"
          disabled={!q.ready || saving}
          onClick={() => next(q.answer())}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Results({ profile }: { profile: OnboardingProfile }) {
  const router = useRouter();
  const [matches, setMatches] = useState<RankedScholarship[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const completed = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const countries = useMemo(() => (profile.preferred_countries.length ? profile.preferred_countries : ["Australia"]), [profile.preferred_countries]);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      // Candidates: open, active awards in the chosen places that mention the
      // student's interests, plus a general set so a narrow interest list
      // still gets results. Ranking happens on the combined set.
      const open = `deadline_at.is.null,deadline_at.gte.${new Date().toISOString()}`;
      const base = () =>
        supabase.from("scholarships").select("*").eq("is_active", true).in("country", countries).or(open);
      const terms = profile.target_majors.map((m) => m.replace(/[^\p{L}\p{N} ]/gu, "").trim()).filter(Boolean).slice(0, 8);
      const [byInterest, general] = await Promise.all([
        terms.length
          ? base().or(terms.map((t) => `title.ilike.%${t}%`).join(",")).limit(200)
          : Promise.resolve({ data: [], error: null }),
        base().order("deadline_at", { ascending: true, nullsFirst: false }).limit(200),
      ]);
      if (!active) return;
      if (byInterest.error || general.error) {
        setFailed(true);
        return;
      }
      const seen = new Set<string>();
      const candidates = [...(byInterest.data ?? []), ...(general.data ?? [])].filter((s) => {
        const id = (s as { id: string }).id;
        return seen.has(id) ? false : (seen.add(id), true);
      });
      const ranked = rankOnboardingMatches(profile, candidates as unknown as ScholarshipRow[]);
      setMatches(ranked);
      try {
        const tracked = await fetchTrackedIds(ranked.map((m) => m.scholarship.id));
        if (active) setSavedIds(tracked);
      } catch {
        // Unknown saved state only means a Save button may show for an award
        // already saved; saving again never changes its status.
      }
    })();
    return () => {
      active = false;
    };
  }, [countries, profile]);

  async function save(s: ScholarshipRow) {
    if (savingId) return;
    setSavingId(s.id);
    try {
      await saveScholarshipIfNew(s.id);
      setSavedIds((cur) => new Set(cur).add(s.id));
      setLastSaved(s.id);
      if (!completed.current) {
        completed.current = true;
        await completeOnboarding().catch(() => {});
        track("first_item_saved", { kind: "scholarship" });
        track("onboarding_completed");
      }
    } catch {
      toast.error("Could not save that scholarship. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function finish() {
    await completeOnboarding().catch(() => {});
    track("onboarding_completed");
    router.push("/today");
  }

  const savedScholarship = matches?.find((m) => m.scholarship.id === lastSaved)?.scholarship;

  return (
    <div className="w-full max-w-3xl">
      <p className="font-code text-[10px] uppercase tracking-[0.15em] text-muted-foreground">All set</p>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold tracking-tight mt-2 outline-none">
        Scholarships that could <span className={`italic ${MAROON}`}>fit</span>
      </h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
        Ranked from your answers. Save one to start your shortlist; always check the official eligibility before applying.
      </p>

      {savedScholarship ? (
        <div role="status" className="mt-6 border border-l-4 border-l-[#9a1a27] bg-card p-5">
          <p className="font-code text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Saved to your shortlist</p>
          <p className="font-display text-xl mt-1">{savedScholarship.title}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Next: open it, check you meet the eligibility, then add its closing date so it shows on your Today page.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild className="rounded-none bg-[#9a1a27] hover:bg-[#7d141f] text-white gap-1">
              <Link href={`/scholarships/${savedScholarship.id}`}>
                Check eligibility <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="rounded-none" onClick={finish}>
              Go to Today
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        {failed ? (
          <div role="alert" className="border px-5 py-6 text-sm">
            We could not load scholarships just now.{" "}
            <Link href="/scholarships" className={`${MAROON} hover:underline`}>Browse all scholarships</Link>
          </div>
        ) : matches === null ? (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Finding scholarships…
          </p>
        ) : matches.length === 0 ? (
          <div className="border px-5 py-6 text-sm">
            No scholarships in those places yet.{" "}
            <Link href="/scholarships" className={`${MAROON} hover:underline`}>Browse everything</Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {matches.map(({ scholarship: s, reason }) => {
              const isSaved = savedIds.has(s.id);
              return (
                <li key={s.id} className="border bg-card p-4 flex flex-col gap-2">
                  <p className="font-code text-[10px] uppercase tracking-[0.12em] text-muted-foreground truncate">{s.provider_name}</p>
                  <Link href={`/scholarships/${s.id}`} className="font-medium hover:underline">{s.title}</Link>
                  {s.amount_display ? <p className="font-display text-lg leading-tight">{s.amount_display}</p> : null}
                  {reason ? <p className="text-xs text-muted-foreground">{reason}</p> : null}
                  <div className="mt-auto pt-2">
                    <Button
                      size="sm"
                      variant={isSaved ? "outline" : "default"}
                      className={`rounded-none gap-1 ${isSaved ? "" : "bg-[#9a1a27] hover:bg-[#7d141f] text-white"}`}
                      disabled={isSaved || savingId === s.id}
                      onClick={() => save(s)}
                    >
                      {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                      {isSaved ? "Saved" : "Save"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!savedScholarship ? (
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button variant="outline" className="rounded-none" onClick={finish}>
            Finish and go to Today
          </Button>
          <Link href="/scholarships" className={`text-sm ${MAROON} hover:underline`}>Browse all scholarships</Link>
        </div>
      ) : null}
    </div>
  );
}
