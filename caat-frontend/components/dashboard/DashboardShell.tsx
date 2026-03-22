"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ApplicationReadiness } from "./ApplicationReadiness";
import { WidgetGrid } from "./WidgetGrid";
import { WidgetStoreTrigger } from "./WidgetStore";
import {
  fetchDashboardWidgets,
  addDashboardWidget,
  removeDashboardWidget,
  saveDashboardWidgets,
  type PlacedWidget,
} from "./api";
import { supabase } from "@/src/lib/supabaseClient";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardShell() {
  const [placedWidgets, setPlacedWidgets] = useState<PlacedWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeOpen, setStoreOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  // Load saved layout and user name on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          null;
        setUserName(name);
      }
    });

    fetchDashboardWidgets()
      .then(setPlacedWidgets)
      .catch(() => {
        // User may not be logged in yet; silently ignore
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(widgetId: string) {
    setAdding(widgetId);
    try {
      const newWidget = await addDashboardWidget(widgetId);
      setPlacedWidgets((prev) => [...prev, newWidget]);
      toast.success("Widget added");
    } catch (err) {
      toast.error("Failed to add widget");
      console.error(err);
    } finally {
      setAdding(null);
    }
  }

  async function handleRemove(instanceId: string) {
    // Optimistic update
    setPlacedWidgets((prev) => prev.filter((w) => w.instanceId !== instanceId));
    try {
      await removeDashboardWidget(instanceId);
    } catch {
      toast.error("Failed to remove widget");
      // Reload from DB to restore
      fetchDashboardWidgets().then(setPlacedWidgets).catch(() => {});
    }
  }

  async function handleReorder(reordered: PlacedWidget[]) {
    setPlacedWidgets(reordered);
    try {
      await saveDashboardWidgets(reordered);
    } catch {
      toast.error("Failed to save layout");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 pt-0 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="h-40 rounded-xl bg-muted" />
        <div className="h-8 w-36 rounded bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-56 rounded-xl bg-muted" />
          <div className="h-56 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Personalised greeting */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {getGreeting()}{userName ? `, ${userName}` : ""}!
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here&apos;s an overview of your admissions journey.
        </p>
      </div>

      {/* Application Readiness */}
      <ApplicationReadiness />

      {/* Your Dashboard header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Your Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Drag to reorder. Open the Widget Store to add more.
          </p>
        </div>
        <WidgetStoreTrigger
          open={storeOpen}
          onOpenChange={setStoreOpen}
          placedWidgets={placedWidgets}
          onAdd={handleAdd}
          adding={adding}
        />
      </div>

      {/* Widget Grid */}
      <WidgetGrid
        widgets={placedWidgets}
        onReorder={handleReorder}
        onRemove={handleRemove}
        onOpenStore={() => setStoreOpen(true)}
      />
    </div>
  );
}
