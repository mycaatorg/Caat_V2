"use client";

import React, { useEffect, useRef, useState } from "react";
import { Star, FileText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileCard } from "./ProfileCard";
import Link from "next/link";
import { loadOrCreateResumeState } from "@/components/resume-builder/api";
import type { ResumeSection } from "@/components/resume-builder/types";
import { ResumePreviewMini } from "@/components/resume-builder/ResumePreviewMini";
import { fetchActivities, updateActivities } from "@/app/(main)/profile/api";
import { toast } from "sonner";

const ACTIVITY_EXAMPLES = [
  "Bouldering",
  "Photography",
  "Painting",
  "Art",
  "Chess",
  "Debate",
  "Volunteering",
  "Music",
  "Reading",
  "Coding",
  "Sports",
  "Theatre",
];

export function ExtracurricularsCard() {
  const [sections, setSections] = useState<ResumeSection[] | null>(null);
  const [resumeLoading, setResumeLoading] = useState(true);

  // Activities state
  const [activities, setActivities] = useState<string[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      .catch(() => setSections(null))
      .finally(() => setResumeLoading(false));

    fetchActivities()
      .then(setActivities)
      .catch(() => {})
      .finally(() => setActivitiesLoading(false));
  }, []);

  async function saveActivities(next: string[]) {
    setSaving(true);
    try {
      await updateActivities(next);
    } catch {
      toast.error("Failed to save activities.");
    } finally {
      setSaving(false);
    }
  }

  function addActivity(value: string) {
    const trimmed = value.trim();
    if (!trimmed || activities.map((a) => a.toLowerCase()).includes(trimmed.toLowerCase())) return;
    const next = [...activities, trimmed];
    setActivities(next);
    saveActivities(next);
    setInput("");
  }

  function removeActivity(index: number) {
    const next = activities.filter((_, i) => i !== index);
    setActivities(next);
    saveActivities(next);
  }

  const suggestions = ACTIVITY_EXAMPLES.filter(
    (e) => !activities.map((a) => a.toLowerCase()).includes(e.toLowerCase())
  );

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
      <div className="flex flex-col gap-5">
        {/* Resume preview */}
        {resumeLoading ? (
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

        {/* Manage resume button */}
        <Button variant="outline" size="sm" className="h-8 gap-1.5 self-start" asChild>
          <Link href="/resume-builder">
            <FileText className="h-3.5 w-3.5" />
            Manage Resume
          </Link>
        </Button>

        {/* Divider */}
        <div className="border-t" />

        {/* Activities section */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Activities & Hobbies</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add interests and activities outside of school.
            </p>
          </div>

          {activitiesLoading ? (
            <Skeleton className="h-8 w-48 rounded-full" />
          ) : (
            <>
              {/* Existing tags */}
              {activities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activities.map((activity, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium"
                    >
                      {activity}
                      <button
                        type="button"
                        onClick={() => removeActivity(i)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={`Remove ${activity}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add input */}
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addActivity(input);
                    }
                  }}
                  placeholder="Add an activity…"
                  className="h-8 text-sm max-w-[220px]"
                  disabled={saving}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2"
                  onClick={() => addActivity(input)}
                  disabled={!input.trim() || saving}
                  aria-label="Add activity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Suggestions:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.slice(0, 8).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => addActivity(s)}
                        className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ProfileCard>
  );
}
