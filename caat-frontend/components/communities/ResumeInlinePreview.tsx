"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useInView } from "react-intersection-observer";
import { FileText } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchResumeForViewAction } from "@/app/(main)/communities/actions";
import type { ResumeSection } from "@/components/resume-builder/types";

const ResumePreviewMini = dynamic(
  () => import("@/components/resume-builder/ResumePreviewMini").then((m) => m.ResumePreviewMini),
  { ssr: false }
);

interface ResumeInlinePreviewProps {
  resumeId: string;
  resumeTitle: string | null;
}

export function ResumeInlinePreview({ resumeId, resumeTitle }: ResumeInlinePreviewProps) {
  const [sections, setSections] = useState<ResumeSection[] | null>(null);
  const [title, setTitle] = useState<string | null>(resumeTitle);
  const [isOpen, setIsOpen] = useState(false);

  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 });

  useEffect(() => {
    if (!inView || sections !== null) return;
    fetchResumeForViewAction(resumeId).then((result) => {
      setSections((result.sections as ResumeSection[] | null) ?? []);
      if (result.title) setTitle(result.title);
    });
  }, [inView, resumeId, sections]);

  return (
    <>
      <div ref={ref} className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="size-3.5" />
          <span className="font-medium">{title ?? "CAAT Resume"}</span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full rounded-md border overflow-hidden bg-white cursor-pointer hover:ring-2 hover:ring-ring transition-all"
          aria-label="View resume"
        >
          {sections === null ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-1/2 mx-auto" />
              <Skeleton className="h-3 w-2/3 mx-auto" />
              <div className="mt-4 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ) : sections.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
              Empty resume
            </div>
          ) : (
            <ResumePreviewMini sections={sections} />
          )}
        </button>

        <p className="text-[11px] text-muted-foreground text-right">Click to expand</p>
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{title ?? "CAAT Resume"}</SheetTitle>
          </SheetHeader>
          {sections && sections.length > 0 && (
            <div className="flex justify-center">
              <ResumePreviewMini sections={sections} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
