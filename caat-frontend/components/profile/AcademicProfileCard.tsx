"use client";

import React, { useState } from "react";
import { GraduationCap } from "lucide-react";
import { ProfileCard, InfoRow } from "./ProfileCard";
import { SCHOOL_CURRICULUM_OPTIONS } from "@/types/profile";

interface AcademicInfo {
  schoolName: string;
  curriculum: string;
  graduationYear: string;
}

interface AcademicProfileCardProps {
  data: AcademicInfo;
  onSave: (data: AcademicInfo) => Promise<void>;
}

function EditField({
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
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

export function AcademicProfileCard({ data, onSave }: AcademicProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState(data);

  const currentYear = new Date().getFullYear();
  const minYear = currentYear;
  const maxYear = currentYear + 8;

  function handleEdit() {
    setDraft(data);
    setIsEditing(true);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(draft);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setDraft(data);
    setIsEditing(false);
  }

  return (
    <ProfileCard
      title="Academic Profile"
      icon={<GraduationCap className="h-4 w-4" />}
      isEditing={isEditing}
      isSaving={isSaving}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      {isEditing ? (
        <div className="flex flex-col">
          <EditField
            label="School Name"
            value={draft.schoolName}
            onChange={(v) => setDraft((d) => ({ ...d, schoolName: v }))}
          />
          <div className="flex flex-col gap-1 py-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Curriculum
            </label>
            <select
              value={draft.curriculum}
              onChange={(e) => setDraft((d) => ({ ...d, curriculum: e.target.value }))}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="" disabled>Select curriculum…</option>
              {SCHOOL_CURRICULUM_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 py-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Graduation Year
            </label>
            <input
              type="number"
              min={minYear}
              max={maxYear}
              value={draft.graduationYear}
              onChange={(e) => setDraft((d) => ({ ...d, graduationYear: e.target.value }))}
              placeholder={String(currentYear + 1)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">
              Between {minYear} and {maxYear}
            </span>
          </div>
        </div>
      ) : (
        <>
          <InfoRow label="School Name" value={data.schoolName} />
          <InfoRow label="Curriculum" value={data.curriculum} />
          <InfoRow label="Graduation Year" value={data.graduationYear} />
        </>
      )}
    </ProfileCard>
  );
}
