"use client";

import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SCHOLARSHIP_STATUS_LABELS, mentionsSchool, type SavedScholarshipForHub } from "@/lib/scholarship-tracking";

const MAROON = "text-[#9a1a27] dark:text-[#e06b78]";

export function attachCopy(schoolName: string) {
  return `Attaching a scholarship organises your preparation for ${schoolName}. It does not mean you are eligible, and it does not apply for you.`;
}

/**
 * PROD-77: every saved scholarship, with where it is attached now. Attaching
 * one already attached elsewhere is a move and needs a second, explicit click.
 * Saving new scholarships happens on /scholarships, not here.
 */
export function AttachScholarshipDialog({
  open,
  onOpenChange,
  schoolId,
  schoolName,
  saved,
  busyId,
  onAttach,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: number;
  schoolName: string;
  saved: SavedScholarshipForHub[];
  busyId: string | null;
  onAttach: (scholarship: SavedScholarshipForHub) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  // Name-matched first (a suggestion only), then the rest, each in loaded order.
  const ordered = [
    ...saved.filter((s) => mentionsSchool(s.scholarshipSchoolName, schoolName)),
    ...saved.filter((s) => !mentionsSchool(s.scholarshipSchoolName, schoolName)),
  ];
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirming(null);
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 max-h-[85vh] overflow-y-auto bg-background border border-foreground/70 p-5">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-base font-semibold">Attach a saved scholarship</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-xs text-muted-foreground mt-2">
            {attachCopy(schoolName)} A scholarship can be attached to one application at a time.
          </Dialog.Description>
          {ordered.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">
              You haven&apos;t saved any scholarships yet.{" "}
              <Link href="/scholarships" className={`${MAROON} hover:underline`}>Browse scholarships</Link>
            </p>
          ) : (
            <ul className="mt-4 divide-y">
              {ordered.map((s) => {
                const here = s.schoolId === schoolId;
                const elsewhere = s.schoolId !== null && !here;
                const where = here
                  ? "Attached here"
                  : elsewhere
                    ? `Attached to ${s.attachedSchoolName ?? "another application"}`
                    : "Not attached";
                const busy = busyId === s.id;
                return (
                  <li key={s.id} className="py-3 min-w-0" data-dialog-scholarship={s.id}>
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm break-words">{s.title}</div>
                        <div className="text-xs text-muted-foreground break-words">
                          {s.provider} · {SCHOLARSHIP_STATUS_LABELS[s.status]} · {where}
                        </div>
                      </div>
                      {here ? null : elsewhere ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-none"
                          disabled={busy || confirming === s.id}
                          aria-label={`Move ${s.title} here`}
                          onClick={() => setConfirming(s.id)}
                        >
                          Move here
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-none"
                          disabled={busy}
                          aria-label={`Attach ${s.title}`}
                          onClick={() => onAttach(s)}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                          Attach
                        </Button>
                      )}
                    </div>
                    {confirming === s.id ? (
                      <div role="group" aria-label={`Move ${s.title}`} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span>Currently attached to {s.attachedSchoolName ?? "another application"}. Move it here?</span>
                        <Button
                          size="sm"
                          className="rounded-none"
                          disabled={busy}
                          aria-label="Confirm move"
                          onClick={() => {
                            setConfirming(null);
                            onAttach(s);
                          }}
                        >
                          Move
                        </Button>
                        <Button variant="ghost" size="sm" className="rounded-none" onClick={() => setConfirming(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Looking for another scholarship?{" "}
            <Link href="/scholarships" className={`${MAROON} hover:underline`}>Save it on Scholarships</Link> first.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
