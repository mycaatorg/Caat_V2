"use client";

import React, { useEffect, useRef, useState } from "react";
import { Star, FileText, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileCard } from "./ProfileCard";
import Link from "next/link";
import {
  listResumes,
  loadResumeById,
} from "@/components/resume-builder/api";
import type { ResumeSection } from "@/components/resume-builder/types";
import { ResumePreviewMini } from "@/components/resume-builder/ResumePreviewMini";
import { fetchActivities, updateActivities, setDefaultResumeId } from "@/app/(main)/profile/api";
import { supabase } from "@/src/lib/supabaseClient";
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

interface ResumeSummary {
  id: string;
  title: string;
  created_at: string;
}

export function ExtracurricularsCard() {
  // Resume state
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [defaultResumeId, setDefaultResumeIdState] = useState<string | null>(null);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);
  const [sections, setSections] = useState<ResumeSection[] | null>(null);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);

  // Activities state
  const [activities, setActivities] = useState<string[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all resumes + default resume id + activities on mount
  useEffect(() => {
    async function load() {
      try {
        const [resumeList, { data: profileData }] = await Promise.all([
          listResumes(),
          supabase.auth.getUser().then(({ data: { user } }) =>
            supabase
              .from("profiles")
              .select("default_resume_id")
              .eq("id", user?.id ?? "")
              .maybeSingle()
          ),
        ]);

        setResumes(resumeList.map((r) => ({ ...r, title: r.title ?? "Untitled" })));

        const savedDefault = (profileData as { default_resume_id?: string | null } | null)
          ?.default_resume_id ?? null;

        // Pick which resume to preview: saved default → first in list
        const toShow =
          savedDefault && resumeList.find((r) => r.id === savedDefault)
            ? savedDefault
            : resumeList[0]?.id ?? null;

        setDefaultResumeIdState(savedDefault);
        setActiveResumeId(toShow);

        if (toShow) {
          const state = await loadResumeById(toShow);
          if (state) {
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
            const hasContent = loaded.some((s) => {
              if (s.contentHtml && s.contentHtml.trim().length > 0) return true;
              if (s.type === "personal" && s.structuredData) {
                const p = s.structuredData as { fullName?: string };
                return !!p.fullName?.trim();
              }
              return false;
            });
            setSections(hasContent ? loaded : null);
          }
        }
      } catch {
        setSections(null);
      } finally {
        setResumeLoading(false);
      }
    }

    load();

    fetchActivities()
      .then(setActivities)
      .catch(() => {})
      .finally(() => setActivitiesLoading(false));
  }, []);

  // Switch preview to a different resume
  async function handleSwitchResume(id: string) {
    if (id === activeResumeId) return;
    setActiveResumeId(id);
    setPreviewLoading(true);
    try {
      const state = await loadResumeById(id);
      if (state) {
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
        const hasContent = loaded.some((s) => {
          if (s.contentHtml && s.contentHtml.trim().length > 0) return true;
          if (s.type === "personal" && s.structuredData) {
            const p = s.structuredData as { fullName?: string };
            return !!p.fullName?.trim();
          }
          return false;
        });
        setSections(hasContent ? loaded : null);
      } else {
        setSections(null);
      }
    } catch {
      setSections(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  // Set a resume as the profile default
  async function handleSetDefault(id: string) {
    if (settingDefault) return;
    setSettingDefault(true);
    try {
      await setDefaultResumeId(id);
      setDefaultResumeIdState(id);
      toast.success("Default resume updated.");
    } catch {
      toast.error("Failed to set default resume.");
    } finally {
      setSettingDefault(false);
    }
  }

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

  const activeResume = resumes.find((r) => r.id === activeResumeId);

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

        {/* ── Resume section ─────────────────────────────────────────────── */}
        {resumeLoading ? (
          <Skeleton className="w-full h-90 rounded-lg" />
        ) : (
          <>
            {/* Resume picker — only shown when there are multiple resumes */}
            {resumes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Your Resumes
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      value={activeResumeId ?? ""}
                      onChange={(e) => handleSwitchResume(e.target.value)}
                      className="h-8 rounded-md border border-input bg-background pl-3 pr-8 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer"
                    >
                      {resumes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}{r.id === defaultResumeId ? " ★" : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronRight className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rotate-90 text-muted-foreground" />
                  </div>
                  {activeResume && activeResume.id !== defaultResumeId && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                      disabled={settingDefault}
                      onClick={() => handleSetDefault(activeResume.id)}
                    >
                      Set as default
                    </button>
                  )}
                  {activeResume && activeResume.id === defaultResumeId && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      Default
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Preview */}
            {previewLoading ? (
              <Skeleton className="w-full h-90 rounded-lg" />
            ) : sections && sections.length > 0 ? (
              <Link
                href="/resume-builder"
                className="block rounded-lg border bg-muted/30 overflow-hidden hover:ring-2 hover:ring-primary/20 transition-shadow"
              >
                <ResumePreviewMini sections={sections} />
              </Link>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 rounded-lg border border-dashed gap-2 text-sm text-muted-foreground">
                <span>
                  {resumes.length === 0
                    ? "No resume yet. Click below to get started."
                    : "This resume has no content yet."}
                </span>
                {resumes.length > 1 && activeResumeId !== resumes[0]?.id && (
                  <button
                    type="button"
                    className="text-xs underline underline-offset-2 hover:text-foreground transition-colors"
                    onClick={() => handleSwitchResume(resumes[0].id)}
                  >
                    <ChevronLeft className="inline h-3 w-3" /> Back to first resume
                  </button>
                )}
              </div>
            )}

            {/* Manage resume button */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
                <Link href={`/resume-builder${activeResumeId ? `?id=${activeResumeId}` : ""}`}>
                  <FileText className="h-3.5 w-3.5" />
                  {activeResume ? `Edit "${activeResume.title}"` : "Manage Resume"}
                </Link>
              </Button>
              {resumes.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous resume"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={() => {
                      const idx = resumes.findIndex((r) => r.id === activeResumeId);
                      const prev = resumes[(idx - 1 + resumes.length) % resumes.length];
                      handleSwitchResume(prev.id);
                    }}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {resumes.findIndex((r) => r.id === activeResumeId) + 1} / {resumes.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Next resume"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={() => {
                      const idx = resumes.findIndex((r) => r.id === activeResumeId);
                      const next = resumes[(idx + 1) % resumes.length];
                      handleSwitchResume(next.id);
                    }}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Divider */}
        <div className="border-t" />

        {/* ── Activities section ──────────────────────────────────────────── */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Activities & Hobbies</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add interests and activities outside of school.
            </p>
          </div>

          {activitiesLoading ? (
            <Skeleton className="h-8 w-48 rounded-full" />
          ) : (
            <>
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
                  className="h-8 text-sm max-w-55"
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
