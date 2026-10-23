'use client';

import { useId } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STATUS_CONFIG, type ApplicationStatus } from '@/types/applications';

const MAROON = 'text-[#9a1a27] dark:text-[#e06b78]';

/**
 * PROD-148: what a saved course offers for the application at its university.
 * A pure view: the parent owns the applications state and the busy key
 * `apply-<schoolId>`, so every row for one university stays in sync. Only the
 * labelled button click calls `onStart`; a failed read offers Retry, never a
 * create button, and a course with no linked university never guesses one.
 */
export function CourseApplicationAction({ institutionName, schoolId, application, busy, unavailable, onStart, onRetry }: {
  institutionName: string;
  schoolId: number | null;
  application: { id: string; status: ApplicationStatus } | null;
  busy: boolean;
  unavailable: boolean;
  onStart: () => void;
  onRetry: () => void;
}) {
  const helpId = useId();
  if (schoolId === null) {
    return <p className="text-xs text-muted-foreground">This course isn&apos;t linked to a university in CAAT yet.</p>;
  }
  if (unavailable) {
    return <p role="status" className="text-xs text-muted-foreground">
      Couldn&apos;t check your applications.{' '}
      <button type="button" onClick={onRetry} aria-label="Retry checking your applications" className={`${MAROON} underline underline-offset-4`}>Retry</button>
    </p>;
  }
  if (application) {
    return <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-code text-[10px] uppercase tracking-[0.08em] bg-muted text-muted-foreground px-2 py-0.5">{STATUS_CONFIG[application.status].label}</span>
      <Link href={`/applications/${application.id}`} className={`text-sm ${MAROON} hover:underline inline-flex items-center gap-1`}>
        Open your {institutionName} application <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </span>;
  }
  return <span className="inline-flex max-w-full flex-col items-start gap-1">
    <Button size="sm" type="button" className="rounded-none bg-[#9a1a27] hover:bg-[#7d141f] text-white whitespace-normal h-auto min-h-8 py-1.5 text-left" disabled={busy} aria-describedby={helpId} onClick={onStart}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
      Track an application at {institutionName}
    </Button>
    <span id={helpId} className="text-xs text-muted-foreground">Adds {institutionName} to My applications so you can prepare. It does not apply to the university.</span>
  </span>;
}
