"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, BookOpen, GraduationCap, Loader2, School, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { getClientUserId } from "@/lib/current-user";
import { addApplication } from "@/app/(main)/applications/api";
import { SCHOLARSHIP_STATUS_LABELS } from "@/lib/scholarship-tracking";
import { removeFromShortlist, type Shortlist, type ShortlistKind } from "@/lib/shortlist";
import { STATUS_CONFIG } from "@/types/applications";

const MAROON = "text-[#9a1a27] dark:text-[#e06b78]";
type Filter = "all" | ShortlistKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "scholarship", label: "Scholarships" },
  { key: "school", label: "Universities" },
  { key: "major", label: "Courses" },
];

function closes(deadlineAt: string | null) {
  if (!deadlineAt) return "No closing date listed";
  return `Closes ${new Date(deadlineAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" })}`;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-code text-[10px] uppercase tracking-[0.08em] bg-muted text-muted-foreground px-2 py-0.5">
      {children}
    </span>
  );
}

function Section({
  title,
  count,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  count: number;
  icon: typeof School;
  empty: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="font-code text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{count} saved</span>
      </div>
      {count ? <ul className="border divide-y bg-card">{children}</ul> : <div className="border border-dashed px-4 py-5 text-sm text-muted-foreground">{empty}</div>}
    </section>
  );
}

function RemoveButton({ label, onRemove, busy }: { label: string; onRemove: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={busy}
      aria-label={`Remove ${label} from shortlist`}
      className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 shrink-0"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

export function ShortlistView({ initial }: { initial: Shortlist | null }) {
  const router = useRouter();
  const [list, setList] = useState<Shortlist | null>(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);

  if (!list) {
    return (
      <div className="p-6 pt-0 max-w-5xl">
        <div role="alert" className="border px-6 py-10 text-center">
          <p className="font-medium">Couldn&apos;t load your shortlist.</p>
          <Button variant="outline" className="mt-3 rounded-none" onClick={() => router.refresh()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const total = list.scholarships.length + list.schools.length + list.majors.length;
  const show = (kind: ShortlistKind) => filter === "all" || filter === kind;

  async function remove(kind: ShortlistKind, id: string | number, label: string) {
    const key = `${kind}-${id}`;
    const previous = list!;
    setBusy(key);
    setList({
      scholarships: kind === "scholarship" ? previous.scholarships.filter((s) => s.id !== id) : previous.scholarships,
      schools: kind === "school" ? previous.schools.filter((s) => s.id !== id) : previous.schools,
      majors: kind === "major" ? previous.majors.filter((m) => m.id !== id) : previous.majors,
    });
    try {
      const userId = await getClientUserId();
      if (!userId) throw new Error("Not authenticated");
      await removeFromShortlist(supabase, userId, kind, id);
      toast.success(`Removed ${label}.`);
    } catch {
      setList(previous);
      toast.error(`Could not remove ${label}. Please try again.`);
    } finally {
      setBusy(null);
    }
  }

  async function startApplication(schoolId: number, name: string) {
    const key = `apply-${schoolId}`;
    if (busy) return;
    setBusy(key);
    try {
      const row = await addApplication(schoolId);
      setList((cur) =>
        cur && {
          ...cur,
          schools: cur.schools.map((s) => (s.id === schoolId ? { ...s, application: { id: row.id, status: row.status } } : s)),
        },
      );
      toast.success(`Started tracking your application to ${name}.`);
    } catch {
      toast.error("Could not start the application. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-6 pt-0 max-w-5xl">
      <header>
        <p className="font-code text-[10px] uppercase tracking-[0.15em] text-muted-foreground">My shortlist</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">
          Everything you have <span className={`italic ${MAROON}`}>saved</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Scholarships, universities and courses you are considering, each with what to do next.
        </p>
      </header>

      {total === 0 ? (
        <div className="border px-6 py-12 text-center">
          <p className="font-display text-xl">Nothing saved yet</p>
          <p className="text-sm text-muted-foreground mt-2">Save anything that looks promising while you explore. It all collects here.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {[
              ["/scholarships", "Browse scholarships"],
              ["/schools", "Browse universities"],
              ["/majors", "Browse courses"],
            ].map(([href, label]) => (
              <Button key={href} asChild variant="outline" className="rounded-none">
                <Link href={href}>{label}</Link>
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Filter shortlist" className="inline-flex flex-wrap border self-start">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 font-code text-[11px] uppercase tracking-[0.12em] ${
                  filter === f.key ? "bg-[#9a1a27] text-white" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {show("scholarship") ? (
            <Section
              title="Scholarships"
              count={list.scholarships.length}
              icon={GraduationCap}
              empty={
                <>
                  No saved scholarships.{" "}
                  <Link href="/scholarships" className={`${MAROON} hover:underline`}>Browse scholarships</Link>
                </>
              }
            >
              {list.scholarships.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="flex-1 min-w-[14rem]">
                    <Link href={`/scholarships/${s.id}`} className="font-medium text-sm hover:underline">{s.title}</Link>
                    <p className="text-xs text-muted-foreground">
                      {[s.provider, s.amount].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{closes(s.deadlineAt)}</span>
                  <Pill>{SCHOLARSHIP_STATUS_LABELS[s.status]}</Pill>
                  <Link href={`/scholarships/${s.id}`} className={`text-sm ${MAROON} hover:underline inline-flex items-center gap-1`}>
                    {s.status === "interested" ? "Check eligibility" : "Open"} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <RemoveButton label={s.title} busy={busy === `scholarship-${s.id}`} onRemove={() => remove("scholarship", s.id, s.title)} />
                </li>
              ))}
            </Section>
          ) : null}

          {show("school") ? (
            <Section
              title="Universities"
              count={list.schools.length}
              icon={School}
              empty={
                <>
                  No saved universities.{" "}
                  <Link href="/schools" className={`${MAROON} hover:underline`}>Browse universities</Link>
                </>
              }
            >
              {list.schools.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="flex-1 min-w-[14rem]">
                    <Link href={`/schools/${s.id}`} className="font-medium text-sm hover:underline">{s.name}</Link>
                    {s.country ? <p className="text-xs text-muted-foreground">{s.country}</p> : null}
                  </div>
                  {s.application ? (
                    <>
                      <Pill>{STATUS_CONFIG[s.application.status].label}</Pill>
                      <Link href={`/applications/${s.application.id}`} className={`text-sm ${MAROON} hover:underline inline-flex items-center gap-1`}>
                        Open application <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="rounded-none bg-[#9a1a27] hover:bg-[#7d141f] text-white"
                      disabled={busy === `apply-${s.id}`}
                      onClick={() => startApplication(s.id, s.name)}
                    >
                      {busy === `apply-${s.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Start application
                    </Button>
                  )}
                  <RemoveButton label={s.name} busy={busy === `school-${s.id}`} onRemove={() => remove("school", s.id, s.name)} />
                </li>
              ))}
            </Section>
          ) : null}

          {show("major") ? (
            <Section
              title="Courses"
              count={list.majors.length}
              icon={BookOpen}
              empty={
                <>
                  No saved courses.{" "}
                  <Link href="/majors" className={`${MAROON} hover:underline`}>Browse courses</Link>
                </>
              }
            >
              {list.majors.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="flex-1 min-w-[14rem]">
                    <Link href={`/majors/${m.id}`} className="font-medium text-sm hover:underline">{m.name}</Link>
                    {m.category ? <p className="text-xs text-muted-foreground">{m.category}</p> : null}
                  </div>
                  <Link href={`/majors/${m.id}`} className={`text-sm ${MAROON} hover:underline inline-flex items-center gap-1`}>
                    See where to study it <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <RemoveButton label={m.name} busy={busy === `major-${m.id}`} onRemove={() => remove("major", m.id, m.name)} />
                </li>
              ))}
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}
