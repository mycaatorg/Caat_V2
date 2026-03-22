"use client";

import React from "react";
import { Star, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "./ProfileCard";
import Link from "next/link";

export function ExtracurricularsCard() {
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
    </ProfileCard>
  );
}
