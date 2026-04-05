"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  fetchApplicationForSchool,
  addApplication,
} from "@/app/(main)/applications/api";
import { STATUS_CONFIG } from "@/types/applications";
import type { ApplicationRow } from "@/types/applications";

export default function ApplicationButton({
  schoolId,
}: {
  schoolId: number;
}) {
  const [app, setApp] = useState<ApplicationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchApplicationForSchool(schoolId)
      .then(setApp)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [schoolId]);

  async function handleTrack() {
    setAdding(true);
    try {
      const row = await addApplication(schoolId);
      setApp(row);
      toast.success("School added to your applications.");
    } catch {
      toast.error("Failed to track application.");
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </Button>
    );
  }

  if (app) {
    const cfg = STATUS_CONFIG[app.status];
    return (
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <Link href="/applications">
          <span
            className={`inline-block h-2 w-2 rounded-full mr-1 ${cfg.className.includes("bg-zinc") ? "bg-zinc-400" : cfg.className.includes("bg-blue") ? "bg-blue-500" : cfg.className.includes("bg-indigo") ? "bg-indigo-500" : cfg.className.includes("bg-amber") ? "bg-amber-500" : cfg.className.includes("bg-green") ? "bg-green-500" : cfg.className.includes("bg-red") ? "bg-red-500" : cfg.className.includes("bg-orange") ? "bg-orange-500" : "bg-zinc-400"}`}
          />
          {cfg.label}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleTrack}
      disabled={adding}
      className="gap-1.5"
    >
      {adding ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ClipboardList className="h-3.5 w-3.5" />
      )}
      Track Application
    </Button>
  );
}
