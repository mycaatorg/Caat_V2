"use client";

import React, { useEffect, useState } from "react";
import { Star, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileCard } from "./ProfileCard";
import Link from "next/link";
import { loadOrCreateResumeState } from "@/components/resume-builder/api";
import type { ResumeSection } from "@/components/resume-builder/types";
import { ResumePreviewMini } from "@/components/resume-builder/ResumePreviewMini";

export function ExtracurricularsCard() {
  const [sections, setSections] = useState<ResumeSection[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrCreateResumeState()
      .then((state) => {
        const loaded: ResumeSection[] = state.sections
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => ({
            id: s.id,
            type: s.type,
            label: s.label,
            mode: s.mode,
            contentHtml: s.contentHtml,
            structuredData: s.structuredData,
          }));
        setSections(loaded);
      })
      .catch(() => {
        setSections(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <ProfileCard
      title="Extracurriculars & Resume"
      icon={<Star className="h-4 w-4" />}
      isEditing={false}
      onEdit={() => {}}
      onSave={() => Promise.resolve()}
      onCancel={() => {}}
      hideEditButton
    >
      <div className="flex flex-col gap-4">
        {/* Resume preview */}
        {loading ? (
          <Skeleton className="w-full h-[360px] rounded-lg" />
        ) : sections && sections.length > 0 ? (
          <Link
            href="/resume-builder"
            className="block rounded-lg border bg-muted/30 overflow-hidden hover:ring-2 hover:ring-primary/20 transition-shadow"
          >
            <ResumePreviewMini sections={sections} />
          </Link>
        ) : (
          <div className="flex items-center justify-center h-32 rounded-lg border border-dashed text-sm text-muted-foreground">
            No resume yet. Click below to get started.
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
            <Link href="/resume-builder">
              <FileText className="h-3.5 w-3.5" />
              Manage Resume
            </Link>
          </Button>
          <Button size="sm" className="h-8 gap-1.5" asChild>
            <Link href="/resume-builder?tab=activities">
              <Pencil className="h-3 w-3" />
              Edit Activities
            </Link>
          </Button>
        </div>
      </div>
    </ProfileCard>
  );
}
