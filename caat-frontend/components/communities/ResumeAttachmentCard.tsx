"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchResumeForViewAction } from "@/app/(main)/communities/actions";
import type { ResumeSection } from "@/components/resume-builder/types";

const ResumePreviewMini = dynamic(
  () => import("@/components/resume-builder/ResumePreviewMini").then((m) => m.ResumePreviewMini),
  { ssr: false }
);

interface ResumeAttachmentCardProps {
  resumeId: string;
  resumeTitle: string | null;
}

export function ResumeAttachmentCard({ resumeId, resumeTitle }: ResumeAttachmentCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sections, setSections] = useState<ResumeSection[] | null>(null);
  const [title, setTitle] = useState<string | null>(resumeTitle);
  const [, startTransition] = useTransition();

  function handleOpen() {
    setIsOpen(true);
    if (sections) return;
    startTransition(async () => {
      const result = await fetchResumeForViewAction(resumeId);
      if (result.sections) {
        setSections(result.sections as ResumeSection[]);
        if (result.title) setTitle(result.title);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center gap-3 rounded-md border px-3 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{title ?? "CAAT Resume"}</p>
          <p className="text-[11px] text-muted-foreground">Attached resume · click to view</p>
        </div>
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>{title ?? "CAAT Resume"}</SheetTitle>
          </SheetHeader>

          {sections === null ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-64 w-full mt-4" />
            </div>
          ) : sections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              This resume has no content yet.
            </p>
          ) : (
            <div className="flex justify-center">
              <ResumePreviewMini sections={sections} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
