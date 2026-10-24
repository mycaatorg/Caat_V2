"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LibraryDialog } from "@/components/evidence/library-dialog";
import { fetchDocumentUsage, type DocumentUsage } from "@/lib/evidence-links";
import { REQUIREMENT_WORK_CHANGED } from "@/lib/requirement-work-events";

/** Shared once by the vault. Newer refreshes supersede older responses. */
export function useDocumentUsage() {
  const [data, setData] = useState<DocumentUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError(false);
    try {
      const next = await fetchDocumentUsage();
      if (request === sequence.current) setData(next);
    } catch {
      if (request === sequence.current) setError(true);
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const reload = () => { void refresh(); };
    window.addEventListener("focus", reload);
    window.addEventListener(REQUIREMENT_WORK_CHANGED, reload);
    return () => {
      // Invalidate all pending requests, not a DOM ref captured at mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      sequence.current++;
      window.removeEventListener("focus", reload);
      window.removeEventListener(REQUIREMENT_WORK_CHANGED, reload);
    };
  }, [refresh]);
  return { data, loading, error, refresh };
}

type UsageState = ReturnType<typeof useDocumentUsage>;

export function DocumentUsageButton({ documentId, fileName, usage }: {
  documentId: string; fileName: string; usage: UsageState;
}) {
  const [open, setOpen] = useState(false);
  const entries = usage.data?.[documentId] ?? [];
  const known = usage.data !== null;
  const count = entries.length;
  const countLabel = `Used in ${count} application${count === 1 ? "" : "s"}`;
  const label = usage.error ? "Application links unavailable" : !known ? "Checking applications…" : count ? countLabel : "Not linked to an application";
  return <>
    <button type="button" data-used-in={known && count > 0 ? "" : undefined}
      aria-label={`View application links for ${fileName}`} aria-haspopup="dialog"
      onClick={() => setOpen(true)}
      className="mt-0.5 block max-w-full text-left text-xs text-muted-foreground underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring">
      {label}
    </button>
    {open && <LibraryDialog title="Applications using this document" description={fileName} busy={false} onClose={() => setOpen(false)}>
      {usage.loading && <p role="status" className="mb-3 text-sm text-muted-foreground">{known ? "Refreshing application links…" : "Checking application links…"}</p>}
      {usage.error && <div role="alert" className="mb-4 text-sm">
        <p>Could not refresh application links.{known ? " Showing the last loaded links." : " Your links are unavailable, not empty."}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => void usage.refresh()}>Retry application links</Button>
      </div>}
      {known && count > 0 && <ul className="space-y-3">
        {entries.map(entry => <li key={entry.applicationId} className="rounded-lg border p-3">
          <Link className="block break-words text-sm font-medium underline underline-offset-2" href={`/applications/${entry.applicationId}`}>{entry.schoolName}</Link>
          <p className="mt-1 text-xs text-muted-foreground">{entry.tailored ? "Tailored for this application" : "Uses library details"}</p>
        </li>)}
      </ul>}
      {known && count === 0 && !usage.error && !usage.loading && <p className="text-sm text-muted-foreground">Not linked to an application. Link this document from an application&apos;s Documents section.</p>}
      {known && count === 0 && (usage.error || usage.loading) && <p className="text-sm text-muted-foreground">No links in the last loaded results.</p>}
      {!usage.error && <Button variant="outline" size="sm" className="mt-4" disabled={usage.loading} onClick={() => void usage.refresh()}>Refresh application links</Button>}
    </LibraryDialog>}
  </>;
}
