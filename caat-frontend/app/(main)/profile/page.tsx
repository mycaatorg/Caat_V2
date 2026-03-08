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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Award,
  Camera,
  Check,
  Code2,
  Download,
  Eye,
  FileText,
  GraduationCap,
  MapPin,
  Pencil,
  Star,
  Target,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK = {
  firstName: "Alex",
  lastName: "Johnson",
  birthDate: "May 14, 2007",
  nationality: "South Korean",
  currentLocation: "Toronto, Canada",
  visaStatus: "F-1 Processed",
  schoolName: "International Academy of Toronto",
  curriculum: "IB Diploma (IBDP)",
  currentGPA: "3.9 / 4.0",
  graduationYear: "2025",
  classRank: "Top 5%",
  satScore: "1540",
  ieltsScore: "8.5",
  targetMajors: ["Computer Science", "Data Science", "AI & Ethics"],
  preferredCountries: ["USA", "Canada", "UK"],
  completionPercent: 65,
};

const ACTIVITIES = [
  {
    Icon: Code2,
    name: "App Development Club",
    role: "Founder & President",
    description:
      "Led a team of 15 students to build a community service tracking app used by 500+ peers.",
  },
  {
    Icon: Users,
    name: "Local Senior Center",
    role: "Volunteer Tech Tutor",
    description:
      "Spent 150+ hours teaching digital literacy to local seniors twice a week.",
  },
  {
    Icon: Trophy,
    name: "Varsity Soccer",
    role: "Team Captain",
    description:
      'Led the varsity team to regional championships. Awarded "Player of the Season" in 2023.',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function EditRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 py-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm"
      />
    </div>
  );
}

function SectionEditActions({
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: {
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Button size="sm" onClick={onSave} className="h-7 text-xs px-2.5">
          <Check className="h-3 w-3" />
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-7 w-7 p-0"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onEdit}
      className="h-7 text-xs px-2.5 text-muted-foreground"
    >
      <Pencil className="h-3 w-3" />
      Edit
    </Button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [activeEdit, setActiveEdit] = useState<string | null>(null);

  const [personal, setPersonal] = useState({
    firstName: MOCK.firstName,
    lastName: MOCK.lastName,
    birthDate: MOCK.birthDate,
    nationality: MOCK.nationality,
    currentLocation: MOCK.currentLocation,
    visaStatus: MOCK.visaStatus,
  });
  const [personalDraft, setPersonalDraft] = useState(personal);

  const [academic, setAcademic] = useState({
    schoolName: MOCK.schoolName,
    curriculum: MOCK.curriculum,
    currentGPA: MOCK.currentGPA,
    graduationYear: MOCK.graduationYear,
    classRank: MOCK.classRank,
  });
  const [academicDraft, setAcademicDraft] = useState(academic);

  const [testing, setTesting] = useState({
    satScore: MOCK.satScore,
    ieltsScore: MOCK.ieltsScore,
  });
  const [testingDraft, setTestingDraft] = useState(testing);

  const [interests] = useState({
    targetMajors: MOCK.targetMajors,
    preferredCountries: MOCK.preferredCountries,
  });

  function startEdit(section: string, resetDraft: () => void) {
    resetDraft();
    setActiveEdit(section);
  }
  function commitEdit(section: string, save: () => void) {
    save();
    setActiveEdit(null);
  }
  function cancelEdit(section: string, reset: () => void) {
    reset();
    setActiveEdit(null);
  }

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

        {/* ── Profile hero ─────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="flex flex-col md:flex-row items-start md:items-center gap-5 py-2">
            {/* Avatar */}
            <div className="relative group shrink-0 cursor-pointer">
              <Avatar className="size-20 text-xl">
                <AvatarFallback className="text-lg font-semibold">
                  {personal.firstName[0]}{personal.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </div>

            {/* Name + subtitle */}
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

            {/* Progress */}
            <div className="w-full md:w-64 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Application Progress
                </span>
                <span className="text-xs font-semibold">
                  {MOCK.completionPercent}%
                </span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full"
                  style={{ width: `${MOCK.completionPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Add test scores to reach 80%
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── 2-column grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <User className="h-4 w-4" />
                Personal Information
              </CardTitle>
              <CardAction>
                <SectionEditActions
                  isEditing={activeEdit === "personal"}
                  onEdit={() =>
                    startEdit("personal", () => setPersonalDraft({ ...personal }))
                  }
                  onSave={() =>
                    commitEdit("personal", () => setPersonal({ ...personalDraft }))
                  }
                  onCancel={() =>
                    cancelEdit("personal", () => setPersonalDraft({ ...personal }))
                  }
                />
              </CardAction>
            </CardHeader>
            <CardContent>
              {activeEdit === "personal" ? (
                <div className="grid grid-cols-2 gap-x-3">
                  <EditRow
                    label="First Name"
                    value={personalDraft.firstName}
                    onChange={(v) =>
                      setPersonalDraft((d) => ({ ...d, firstName: v }))
                    }
                  />
                  <EditRow
                    label="Last Name"
                    value={personalDraft.lastName}
                    onChange={(v) =>
                      setPersonalDraft((d) => ({ ...d, lastName: v }))
                    }
                  />
                  <div className="col-span-2">
                    <EditRow
                      label="Date of Birth"
                      value={personalDraft.birthDate}
                      onChange={(v) =>
                        setPersonalDraft((d) => ({ ...d, birthDate: v }))
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <EditRow
                      label="Nationality"
                      value={personalDraft.nationality}
                      onChange={(v) =>
                        setPersonalDraft((d) => ({ ...d, nationality: v }))
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <EditRow
                      label="Current Location"
                      value={personalDraft.currentLocation}
                      onChange={(v) =>
                        setPersonalDraft((d) => ({ ...d, currentLocation: v }))
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <EditRow
                      label="Visa Status"
                      value={personalDraft.visaStatus}
                      onChange={(v) =>
                        setPersonalDraft((d) => ({ ...d, visaStatus: v }))
                      }
                    />
                  </div>
                </div>
              ) : (
                <>
                  <InfoRow
                    label="Full Name"
                    value={`${personal.firstName} ${personal.lastName}`}
                  />
                  <InfoRow label="Date of Birth" value={personal.birthDate} />
                  <InfoRow label="Nationality" value={personal.nationality} />
                  <InfoRow label="Current Location" value={personal.currentLocation} />
                  <InfoRow label="Visa Status" value={personal.visaStatus} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Academic Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <GraduationCap className="h-4 w-4" />
                Academic Profile
              </CardTitle>
              <CardAction>
                <SectionEditActions
                  isEditing={activeEdit === "academic"}
                  onEdit={() =>
                    startEdit("academic", () => setAcademicDraft({ ...academic }))
                  }
                  onSave={() =>
                    commitEdit("academic", () => setAcademic({ ...academicDraft }))
                  }
                  onCancel={() =>
                    cancelEdit("academic", () => setAcademicDraft({ ...academic }))
                  }
                />
              </CardAction>
            </CardHeader>
            <CardContent>
              {activeEdit === "academic" ? (
                <div className="flex flex-col">
                  <EditRow
                    label="School Name"
                    value={academicDraft.schoolName}
                    onChange={(v) =>
                      setAcademicDraft((d) => ({ ...d, schoolName: v }))
                    }
                  />
                  <EditRow
                    label="Curriculum"
                    value={academicDraft.curriculum}
                    onChange={(v) =>
                      setAcademicDraft((d) => ({ ...d, curriculum: v }))
                    }
                  />
                  <EditRow
                    label="Current GPA"
                    value={academicDraft.currentGPA}
                    onChange={(v) =>
                      setAcademicDraft((d) => ({ ...d, currentGPA: v }))
                    }
                  />
                  <EditRow
                    label="Graduation Year"
                    value={academicDraft.graduationYear}
                    onChange={(v) =>
                      setAcademicDraft((d) => ({ ...d, graduationYear: v }))
                    }
                  />
                  <EditRow
                    label="Class Rank"
                    value={academicDraft.classRank}
                    onChange={(v) =>
                      setAcademicDraft((d) => ({ ...d, classRank: v }))
                    }
                  />
                </div>
              ) : (
                <>
                  <InfoRow label="School Name" value={academic.schoolName} />
                  <InfoRow label="Curriculum" value={academic.curriculum} />
                  <InfoRow label="Current GPA" value={academic.currentGPA} />
                  <InfoRow label="Graduation Year" value={academic.graduationYear} />
                  <InfoRow label="Class Rank" value={academic.classRank} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Standardized Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Award className="h-4 w-4" />
                Standardized Testing
              </CardTitle>
              <CardAction>
                <SectionEditActions
                  isEditing={activeEdit === "testing"}
                  onEdit={() =>
                    startEdit("testing", () => setTestingDraft({ ...testing }))
                  }
                  onSave={() =>
                    commitEdit("testing", () => setTesting({ ...testingDraft }))
                  }
                  onCancel={() =>
                    cancelEdit("testing", () => setTestingDraft({ ...testing }))
                  }
                />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {activeEdit === "testing" ? (
                <div className="grid grid-cols-2 gap-x-3">
                  <EditRow
                    label="SAT Score (/ 1600)"
                    value={testingDraft.satScore}
                    onChange={(v) =>
                      setTestingDraft((d) => ({ ...d, satScore: v }))
                    }
                  />
                  <EditRow
                    label="IELTS Overall (/ 9.0)"
                    value={testingDraft.ieltsScore}
                    onChange={(v) =>
                      setTestingDraft((d) => ({ ...d, ieltsScore: v }))
                    }
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">SAT Score</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold tabular-nums">
                          {testing.satScore}
                        </span>
                        <span className="text-sm text-muted-foreground">/ 1600</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">IELTS Overall</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold tabular-nums">
                          {testing.ieltsScore}
                        </span>
                        <span className="text-sm text-muted-foreground">/ 9.0</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">official_report_sat.pdf</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Interests & Goals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Target className="h-4 w-4" />
                Interests & Goals
              </CardTitle>
              <CardAction>
                <SectionEditActions
                  isEditing={activeEdit === "interests"}
                  onEdit={() => startEdit("interests", () => {})}
                  onSave={() => commitEdit("interests", () => {})}
                  onCancel={() => cancelEdit("interests", () => {})}
                />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Target Majors
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {interests.targetMajors.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1 text-xs font-medium bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full"
                    >
                      {activeEdit === "interests" && (
                        <button className="hover:text-destructive transition-colors">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                      {m}
                    </span>
                  ))}
                  {activeEdit === "interests" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full text-xs px-2.5 border-dashed"
                    >
                      + Add
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Preferred Countries
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {interests.preferredCountries.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 text-xs font-medium bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full"
                    >
                      {activeEdit === "interests" && (
                        <button className="hover:text-destructive transition-colors">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                      {c}
                    </span>
                  ))}
                  {activeEdit === "interests" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full text-xs px-2.5 border-dashed"
                    >
                      + Add
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Extracurriculars (full width) ─────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Star className="h-4 w-4" />
              Extracurriculars & Resume
            </CardTitle>
            <CardAction>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Manage Resume
                </Button>
                <Button size="sm" className="h-7 text-xs gap-1.5">
                  <Pencil className="h-3 w-3" />
                  Edit Activities
                </Button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ACTIVITIES.map(({ Icon, name, role, description }) => (
                <div
                  key={name}
                  className="flex flex-col gap-2 p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 bg-secondary rounded-md shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{role}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  );
}
