"use client";

import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHECKLIST_NOTICE, type ChecklistItem, type RequirementsChecklist } from "@/lib/requirements-checklist";
import { SCHOLARSHIP_STATUS_LABELS, type SavedScholarshipForHub } from "@/lib/scholarship-tracking";

import { RequirementSupportingWork, RemovedRequirementWork } from "@/components/applications/requirement-supporting-work";

const MAROON = "text-[#9a1a27] dark:text-[#e06b78]";

/**
 * PROD-77: one attached scholarship's requirements checklist on the hub. Every
 * item says where it comes from, and its tick is preparation only.
 */
export function ScholarshipRequirementsCard({
  scholarship,
  checklist,
  schoolName,
  ticked,
  pendingKeys,
  ticksAvailable,
  onToggle,
  detaching,
  onDetach,
}: {
  scholarship: SavedScholarshipForHub;
  checklist: RequirementsChecklist;
  schoolName: string;
  ticked: Set<string>;
  pendingKeys: Set<string>;
  ticksAvailable: boolean;
  onToggle: (item: ChecklistItem, checked: boolean) => void;
  detaching: boolean;
  onDetach: () => void;
}) {
  const institution = checklist.recordedInstitution;
  const showInstitution = !!institution && institution.trim().toLowerCase().replace(/^the\s+/, "") !== schoolName.trim().toLowerCase().replace(/^the\s+/, "");
  return (
    <li className="rounded-lg border bg-muted/20 px-4 py-3 min-w-0" data-attached-scholarship={scholarship.id}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <Link href={`/scholarships/${encodeURIComponent(scholarship.id)}`} className="font-medium text-sm hover:underline break-words">
            {scholarship.title}
          </Link>
          <div className="text-xs text-muted-foreground break-words">{scholarship.provider}</div>
        </div>
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
          {SCHOLARSHIP_STATUS_LABELS[scholarship.status]}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="rounded-none shrink-0"
          disabled={detaching}
          aria-label={`Detach ${scholarship.title}`}
          onClick={onDetach}
        >
          {detaching ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          Detach
        </Button>
      </div>

      {checklist.inactive ? (
        <p className="text-xs text-muted-foreground mt-2">No longer active in CAAT&apos;s catalogue.</p>
      ) : null}
      <p className="text-xs text-muted-foreground mt-2" data-source-note>
        {checklist.staleLabel ? <strong className="font-medium">{checklist.staleLabel}. </strong> : null}
        {checklist.staleLabel ? "Details may have changed." : checklist.sourceNote}
      </p>
      {showInstitution ? <p className="text-xs text-muted-foreground">Recorded institution: {institution}.</p> : null}

      <ul className="mt-3 space-y-2.5">
        {checklist.items.map((item) => {
          const id = `prep-${scholarship.id}-${item.key}`;
          return (
            <li key={item.key} className="flex items-start gap-2.5" data-checklist-item={item.key} data-recorded-state={item.state}>
              <input
                id={id}
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#9a1a27]"
                // A rule's tick records the student's own check with the provider,
                // never that they meet it; requirement items are preparation.
                aria-label={`${item.kind === "rule" ? "I've checked this with the provider" : "I've prepared this"}: ${item.label}`}
                checked={ticked.has(item.key)}
                disabled={!ticksAvailable || pendingKeys.has(item.key)}
                onChange={(e) => onToggle(item, e.target.checked)}
              />
              <div className="min-w-0 flex-1 text-sm">
                <label htmlFor={id} className="break-words">
                  {item.href ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className={`${MAROON} hover:underline inline-flex items-center gap-1`}>
                      {item.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ) : (
                    item.label
                  )}
                </label>
                {item.detail ? <p className="text-xs text-muted-foreground break-words">{item.detail}</p> : null}
                <p className="text-xs text-muted-foreground">
                  <span data-item-source>{item.source}</span> · {item.sourceSuffix}
                </p>
                <RequirementSupportingWork scholarshipId={scholarship.id} item={item} />
              </div>
            </li>
          );
        })}
      </ul>
      <RemovedRequirementWork scholarshipId={scholarship.id} items={checklist.items} />
      <Link href={`/scholarships/${encodeURIComponent(scholarship.id)}`} className={`mt-3 inline-block text-xs ${MAROON} hover:underline`}>
        See how this compares with your profile
      </Link>
      <p className="text-xs text-muted-foreground mt-2">{CHECKLIST_NOTICE}</p>
    </li>
  );
}
