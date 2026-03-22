"use client";

import React, { useState } from "react";
import { User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProfileCard, InfoRow } from "./ProfileCard";

interface PersonalInfo {
  firstName: string;
  lastName: string;
  birthDate: string;
  nationality: string;
  currentLocation: string;
}

interface PersonalInfoCardProps {
  data: PersonalInfo;
  onSave: (data: PersonalInfo) => Promise<void>;
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

export function PersonalInfoCard({ data, onSave }: PersonalInfoCardProps) {
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
      title="Personal Information"
      icon={<User className="h-4 w-4" />}
      isEditing={isEditing}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      {isEditing ? (
        <div className="grid grid-cols-2 gap-x-3">
          <EditField
            label="First Name"
            value={draft.firstName}
            onChange={(v) => setDraft((d) => ({ ...d, firstName: v }))}
          />
          <EditField
            label="Last Name"
            value={draft.lastName}
            onChange={(v) => setDraft((d) => ({ ...d, lastName: v }))}
          />
          <div className="col-span-2">
            <EditField
              label="Date of Birth"
              value={draft.birthDate}
              onChange={(v) => setDraft((d) => ({ ...d, birthDate: v }))}
            />
          </div>
          <div className="col-span-2">
            <EditField
              label="Nationality"
              value={draft.nationality}
              onChange={(v) => setDraft((d) => ({ ...d, nationality: v }))}
            />
          </div>
          <div className="col-span-2">
            <EditField
              label="Current Location"
              value={draft.currentLocation}
              onChange={(v) => setDraft((d) => ({ ...d, currentLocation: v }))}
            />
          </div>
        </div>
      ) : (
        <>
          <InfoRow label="Full Name" value={`${data.firstName} ${data.lastName}`.trim() || null} />
          <InfoRow label="Date of Birth" value={data.birthDate} />
          <InfoRow label="Nationality" value={data.nationality} />
          <InfoRow label="Current Location" value={data.currentLocation} />
        </>
      )}
    </ProfileCard>
  );
}
