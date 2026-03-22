"use client";

import React from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Pencil, X } from "lucide-react";

interface ProfileCardProps {
  title: string;
  icon: React.ReactNode;
  isEditing: boolean;
  isSaving?: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  hideEditButton?: boolean;
  children: React.ReactNode;
}

export function ProfileCard({
  title,
  icon,
  isEditing,
  isSaving = false,
  onEdit,
  onSave,
  onCancel,
  hideEditButton = false,
  children,
}: ProfileCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </CardTitle>
        {!hideEditButton && (
          <CardAction>
            {isEditing ? (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  onClick={onSave}
                  disabled={isSaving}
                  className="h-7 text-xs px-2.5"
                >
                  {isSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  {isSaving ? "Saving…" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCancel}
                  disabled={isSaving}
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                className="h-7 text-xs px-2.5 text-muted-foreground"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            )}
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}
