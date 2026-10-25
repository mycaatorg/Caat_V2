'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LibraryDialog } from '@/components/evidence/library-dialog';
import { addTodo } from '@/components/dashboard/api';
import type { HubCourse } from '@/lib/course-data';

/** Personal planning only. Never writes course facts or application progress. */
export function CourseFollowUp({ course, schoolName }: { course: HubCourse; schoolName: string }) {
  const id = useId();
  const opener = useRef<HTMLButtonElement | null>(null);
  const writing = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (writing.current) return;
    const task = text.trim();
    if (!task || task.length > 1000) {
      setError('Write a next step between 1 and 1,000 characters.');
      return;
    }
    if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(Date.parse(`${dueDate}T00:00:00Z`)) || new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) !== dueDate)) {
      setError('Choose a valid due date, or leave it empty.');
      return;
    }
    writing.current = true;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    activeRequest.current = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Bound authentication as well as the insert. An aborted insert can still
      // have committed, so recovery copy asks the student to check Today first.
      await Promise.race([
        addTodo(task, { due_date: dueDate || null, priority: 2 }, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('Save timed out')); }, 30_000);
        }),
      ]);
      setSaved(true);
      setOpen(false);
    } catch {
      setError('Could not confirm the saved task. Your text is still here. Check Today before retrying if your connection was interrupted.');
    } finally {
      clearTimeout(timer);
      activeRequest.current = null;
      writing.current = false;
      setBusy(false);
    }
  }

  return <div className="mt-3 min-w-0">
    <Button ref={opener} variant="outline" size="sm" className="h-auto max-w-full whitespace-normal text-left" aria-label={`Plan a follow-up for ${course.name}`} onClick={() => {
      setText(`Confirm entry requirements for ${course.name} at ${schoolName}`.slice(0, 1000));
      setDueDate(''); setError(null); setSaved(false); setOpen(true);
    }}>Plan a follow-up</Button>
    {saved && <p role="status" className="mt-2 text-xs text-muted-foreground">Saved to your personal to-dos. <Link href="/today?view=todos" className="underline">View on Today</Link></p>}
    {open && <LibraryDialog title="Plan a course follow-up" description={`${course.name} · ${schoolName}`} busy={busy} returnFocusRef={opener} onClose={() => setOpen(false)}>
      <p className="text-sm text-muted-foreground">A personal task for Today. Completing it does not confirm eligibility or submit an application. It won&apos;t update automatically if the provider changes its requirements.</p>
      <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
        <div>
          <label htmlFor={`${id}-text`} className="block text-sm font-medium">Your next step</label>
          <textarea id={`${id}-text`} value={text} onChange={event => setText(event.target.value)} disabled={busy} maxLength={1000} rows={3} required className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor={`${id}-date`} className="block text-sm font-medium">Due date (optional)</label>
          <input id={`${id}-date`} type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} disabled={busy} className="mt-1 min-w-0 max-w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </div>
        {error && <div role="alert" className="text-sm text-destructive"><p>{error}</p><Link href="/today?view=todos" className="underline">Check your to-dos on Today</Link></div>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" aria-disabled={busy} aria-busy={busy}>{busy ? 'Saving…' : 'Save to Today'}</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>
    </LibraryDialog>}
  </div>;
}
