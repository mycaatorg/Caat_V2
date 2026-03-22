"use client";

import React, { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { PersonalInfoCard } from "@/components/profile/PersonalInfoCard";
import { AcademicProfileCard } from "@/components/profile/AcademicProfileCard";
import { StandardisedTestingCard } from "@/components/profile/StandardisedTestingCard";
import { InterestsGoalsCard } from "@/components/profile/InterestsGoalsCard";
import { ExtracurricularsCard } from "@/components/profile/ExtracurricularsCard";
import type { StandardisedTestScore } from "@/types/profile";

// ── Mock data (replace with Supabase fetch in Phase 4) ─────────────────────────

const MOCK_USER_ID = "mock-user-id";

const MOCK_PERSONAL = {
  firstName: "Alex",
  lastName: "Johnson",
  birthDate: "May 14, 2007",
  nationality: "South Korean",
  currentLocation: "Toronto, Canada",
};

const MOCK_ACADEMIC = {
  schoolName: "International Academy of Toronto",
  curriculum: "IB Diploma (IBDP)",
  graduationYear: "2025",
};

const MOCK_SCORES: StandardisedTestScore[] = [
  {
    id: "1",
    profile_id: MOCK_USER_ID,
    curriculum: "IB",
    cumulative_score: "42",
    score_scale: null,
    subjects: [
      { id: "s1", test_score_id: "1", subject_name: "Mathematics AA HL", grade: "7", created_at: "" },
      { id: "s2", test_score_id: "1", subject_name: "Physics HL", grade: "6", created_at: "" },
      { id: "s3", test_score_id: "1", subject_name: "English A HL", grade: "7", created_at: "" },
    ],
    created_at: "",
    updated_at: "",
  },
  {
    id: "2",
    profile_id: MOCK_USER_ID,
    curriculum: "English Proficiency",
    cumulative_score: "8.5",
    score_scale: "IELTS",
    subjects: [],
    created_at: "",
    updated_at: "",
  },
];

const MOCK_INTERESTS = {
  targetMajors: ["Computer Science", "Data Science", "AI & Ethics"],
  preferredCountries: ["USA", "Canada", "UK"],
};

const COMPLETION_PERCENT = 65;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [personal, setPersonal] = useState(MOCK_PERSONAL);
  const [academic, setAcademic] = useState(MOCK_ACADEMIC);
  const [scores, setScores] = useState<StandardisedTestScore[]>(MOCK_SCORES);
  const [interests, setInterests] = useState(MOCK_INTERESTS);

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
              userId={MOCK_USER_ID}
              avatarUrl={avatarUrl}
              fallbackInitials={`${personal.firstName[0]}${personal.lastName[0]}`}
              onUploaded={setAvatarUrl}
            />

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold">
                {personal.firstName} {personal.lastName}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Class of {academic.graduationYear} · International Applicant
              </p>
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {personal.currentLocation}
              </div>
            </div>

            <div className="w-full md:w-64 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Application Progress
                </span>
                <span className="text-xs font-semibold">{COMPLETION_PERCENT}%</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full"
                  style={{ width: `${COMPLETION_PERCENT}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Add test scores to reach 80%
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── 2-column grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PersonalInfoCard
            data={personal}
            onSave={async (updated) => setPersonal(updated)}
          />
          <AcademicProfileCard
            data={academic}
            onSave={async (updated) => setAcademic(updated)}
          />
          <StandardisedTestingCard
            scores={scores}
            onSave={async (updated) => setScores(updated)}
          />
          <InterestsGoalsCard
            data={interests}
            onSave={async (updated) => setInterests(updated)}
          />
        </div>

        {/* ── Extracurriculars (full width) ──────────────────────────────────── */}
        <ExtracurricularsCard />

      </div>
    </>
  );
}
