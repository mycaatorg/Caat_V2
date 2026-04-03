"use client";

import React, { useEffect, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { PersonalInfoCard } from "@/components/profile/PersonalInfoCard";
import { AcademicProfileCard } from "@/components/profile/AcademicProfileCard";
import { StandardisedTestingCard } from "@/components/profile/StandardisedTestingCard";
import { InterestsGoalsCard } from "@/components/profile/InterestsGoalsCard";
import { ExtracurricularsCard } from "@/components/profile/ExtracurricularsCard";
import type { ProfileRow, StandardisedTestScore } from "@/types/profile";
import {
  fetchProfile,
  fetchMajorNames,
  updateProfile,
  fetchTestScores,
  saveTestScores,
} from "./api";

// Maps academic curriculum → standardised test curriculum key
const CURRICULUM_TO_TEST: Record<string, string> = {
  "A-Levels": "A-Levels",
  "IB Diploma (IBDP)": "IB",
  "ATAR": "ATAR",
  "AP (Advanced Placement)": "AP",
  "CBSE": "CBSE",
  "CISCE (ICSE/ISC)": "CISCE",
  "IGCSE": "IGCSE",
  "French Baccalauréat": "French Baccalauréat",
  "German Abitur": "German Abitur",
  "Gaokao": "Gaokao",
  "Other": "Other",
};

// ── Completion scoring ─────────────────────────────────────────────────────────

function calcCompletion(
  profile: ProfileRow,
  scores: StandardisedTestScore[]
): number {
  const fields: unknown[] = [
    profile.first_name,
    profile.last_name,
    profile.birth_date,
    profile.nationality,
    profile.current_location,
    profile.school_name,
    profile.curriculum,
    profile.graduation_year,
    profile.avatar_url,
    profile.target_majors?.length,
    profile.preferred_countries?.length,
    scores.length,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function completionHint(pct: number): string {
  if (pct < 50) return "Fill in your personal and academic info to get started.";
  if (pct < 80) return "Add test scores to reach 80%.";
  if (pct < 100) return "Almost there — add your interests and goals.";
  return "Your profile is complete!";
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink>My Profile</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* Hero */}
        <Card>
          <CardContent className="flex flex-col md:flex-row items-start md:items-center gap-5 py-2">
            <Skeleton className="size-20 rounded-full shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="w-full md:w-64 flex flex-col gap-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-3 w-48" />
            </div>
          </CardContent>
        </Card>
        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[180, 160, 220, 200].map((h, i) => (
            <Skeleton key={i} className="rounded-xl" style={{ height: h }} />
          ))}
        </div>
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [scores, setScores] = useState<StandardisedTestScore[]>([]);
  const [majorOptions, setMajorOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoadError(false);
        const [p, majors] = await Promise.all([fetchProfile(), fetchMajorNames()]);
        const s = await fetchTestScores(p.id);
        setProfile(p);
        setScores(s);
        setMajorOptions(majors);
      } catch (err) {
        console.error(err);
        setLoadError(true);
        toast.error("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handlePersonalSave(data: {
    firstName: string;
    lastName: string;
    birthDate: string;
    nationality: string;
    currentLocation: string;
  }) {
    if (!profile) return;
    try {
      await updateProfile(profile.id, {
        first_name: data.firstName,
        last_name: data.lastName,
        birth_date: data.birthDate,
        nationality: data.nationality,
        current_location: data.currentLocation,
      });
      setProfile((p) =>
        p ? {
          ...p,
          first_name: data.firstName,
          last_name: data.lastName,
          birth_date: data.birthDate,
          nationality: data.nationality,
          current_location: data.currentLocation,
        } : p
      );
      toast.success("Personal info saved.");
    } catch {
      toast.error("Failed to save personal info.");
      throw new Error("save failed");
    }
  }

  async function handleAcademicSave(data: {
    schoolName: string;
    curriculum: string;
    graduationYear: string;
  }) {
    if (!profile) return;
    try {
      await updateProfile(profile.id, {
        school_name: data.schoolName,
        curriculum: data.curriculum,
        graduation_year: data.graduationYear ? Number(data.graduationYear) : null,
      });
      setProfile((p) =>
        p ? {
          ...p,
          school_name: data.schoolName,
          curriculum: data.curriculum,
          graduation_year: data.graduationYear ? Number(data.graduationYear) : null,
        } : p
      );

      // Auto-add matching test score entry if not already present
      const testCurriculum = CURRICULUM_TO_TEST[data.curriculum];
      if (testCurriculum) {
        setScores((prev) => {
          if (prev.some((s) => s.curriculum === testCurriculum)) return prev;
          return [
            ...prev,
            {
              id: crypto.randomUUID(),
              profile_id: profile.id,
              curriculum: testCurriculum,
              cumulative_score: null,
              score_scale: null,
              subjects: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
        });
      }

      toast.success("Academic profile saved.");
    } catch {
      toast.error("Failed to save academic profile.");
      throw new Error("save failed");
    }
  }

  async function handleTestScoresSave(updated: StandardisedTestScore[]) {
    if (!profile) return;
    try {
      await saveTestScores(profile.id, updated);
      setScores(updated);
      toast.success("Test scores saved.");
    } catch {
      toast.error("Failed to save test scores.");
      throw new Error("save failed");
    }
  }

  async function handleInterestsSave(data: {
    targetMajors: string[];
    preferredCountries: string[];
  }) {
    if (!profile) return;
    try {
      await updateProfile(profile.id, {
        target_majors: data.targetMajors,
        preferred_countries: data.preferredCountries,
      });
      setProfile((p) =>
        p ? {
          ...p,
          target_majors: data.targetMajors,
          preferred_countries: data.preferredCountries,
        } : p
      );
      toast.success("Interests saved.");
    } catch {
      toast.error("Failed to save interests.");
      throw new Error("save failed");
    }
  }

  if (loading) return <ProfileSkeleton />;
  if (!profile) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink>My Profile</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            {loadError
              ? "We couldn\u2019t load your profile. Please check your connection and try again."
              : "No profile found."}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              setLoadError(false);
              Promise.all([fetchProfile(), fetchMajorNames()])
                .then(async ([p, majors]) => {
                  const s = await fetchTestScores(p.id);
                  setProfile(p);
                  setScores(s);
                  setMajorOptions(majors);
                })
                .catch(() => {
                  setLoadError(true);
                  toast.error("Failed to load profile.");
                })
                .finally(() => setLoading(false));
            }}
          >
            Retry
          </Button>
        </div>
      </>
    );
  }

  const firstName = profile.first_name ?? "";
  const lastName = profile.last_name ?? "";
  const completionPercent = calcCompletion(profile, scores);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink>My Profile</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">

        {/* ── Profile hero ──────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="flex flex-col md:flex-row items-start md:items-center gap-5 py-2">
            <AvatarUpload
              userId={profile.id}
              avatarUrl={profile.avatar_url}
              fallbackInitials={`${firstName[0] ?? "?"}${lastName[0] ?? "?"}`}
              onUploaded={(url) =>
                setProfile((p) => (p ? { ...p, avatar_url: url } : p))
              }
            />

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : "Your Name"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {profile.graduation_year ? `Class of ${profile.graduation_year} · ` : ""}
                International Applicant
              </p>
              {profile.current_location && (
                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {profile.current_location}
                </div>
              )}
            </div>

            <div className="w-full md:w-64 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Profile Progress
                </span>
                <span className="text-xs font-semibold">{completionPercent}%</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {completionHint(completionPercent)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── 2-column grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PersonalInfoCard
            data={{
              firstName,
              lastName,
              birthDate: profile.birth_date ?? "",
              nationality: profile.nationality ?? "",
              currentLocation: profile.current_location ?? "",
            }}
            onSave={handlePersonalSave}
          />
          <AcademicProfileCard
            data={{
              schoolName: profile.school_name ?? "",
              curriculum: profile.curriculum ?? "",
              graduationYear: profile.graduation_year?.toString() ?? "",
            }}
            onSave={handleAcademicSave}
          />
          <StandardisedTestingCard
            scores={scores}
            onSave={handleTestScoresSave}
          />
          <InterestsGoalsCard
            data={{
              targetMajors: profile.target_majors ?? [],
              preferredCountries: profile.preferred_countries ?? [],
            }}
            majorOptions={majorOptions}
            onSave={handleInterestsSave}
          />
        </div>

        {/* ── Extracurriculars (full width) ──────────────────────────────────── */}
        <ExtracurricularsCard />

      </div>
    </>
  );
}
