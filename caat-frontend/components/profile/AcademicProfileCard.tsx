"use client";

import React, { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProfileCard, InfoRow } from "./ProfileCard";

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
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm"
      />
    </div>
  );
}

export function AcademicProfileCard({ data, onSave }: AcademicProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(data);

  function handleEdit() {
    setDraft(data);
    setIsEditing(true);
  }

  async function handleSave() {
    await onSave(draft);
    setIsEditing(false);
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
          <EditField
            label="Curriculum"
            value={draft.curriculum}
            onChange={(v) => setDraft((d) => ({ ...d, curriculum: v }))}
          />
          <EditField
            label="Graduation Year"
            value={draft.graduationYear}
            onChange={(v) => setDraft((d) => ({ ...d, graduationYear: v }))}
          />
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
