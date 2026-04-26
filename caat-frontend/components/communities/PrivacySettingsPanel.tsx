"use client";

import { useState, useTransition } from "react";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { updatePrivacySettingsAction } from "@/app/(main)/communities/actions";
import type { PrivacySettings } from "@/types/community";

interface PrivacySettingsPanelProps {
  initialSettings: PrivacySettings;
}

const SETTINGS: { key: keyof PrivacySettings; label: string }[] = [
  { key: "show_graduation_year",     label: "Show graduation year" },
  { key: "show_school_name",         label: "Show school name" },
  { key: "show_preferred_countries", label: "Show preferred countries" },
  { key: "show_target_majors",       label: "Show target majors" },
];

export function PrivacySettingsPanel({ initialSettings }: PrivacySettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings>(initialSettings);
  const [isPending, startTransition] = useTransition();

  function toggle(key: keyof PrivacySettings) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    startTransition(async () => {
      const { error } = await updatePrivacySettingsAction(settings);
      if (error) {
        toast.error("Failed to save settings.");
      } else {
        toast.success("Privacy settings saved.");
        setIsOpen(false);
      }
    });
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setIsOpen((v) => !v)}
      >
        <Settings className="size-3.5" />
        Privacy Settings
      </Button>

      {isOpen && (
        <div className="mt-3 rounded-lg border p-4 space-y-3 bg-card">
          <p className="text-xs text-muted-foreground">
            Choose what others can see on your community profile.
          </p>
          {SETTINGS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2.5">
              <Checkbox
                id={key}
                checked={settings[key]}
                onCheckedChange={() => toggle(key)}
              />
              <Label htmlFor={key} className="text-sm cursor-pointer">
                {label}
              </Label>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSettings(initialSettings); setIsOpen(false); }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
