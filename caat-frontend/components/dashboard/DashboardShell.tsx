"use client";

import { useEffect, useRef, useState } from "react";
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
import { useAuth } from "@/src/context/AuthContext";
import {
  autoLayout,
  findFirstFit,
  getDefaultSize,
  type PartialRect,
} from "@/lib/grid";
import { getWidgetById } from "./widget-registry";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Ensure every widget in the list has valid grid coordinates.
 * Widgets that are missing positions are auto-placed in the first available
 * free space, respecting all already-positioned widgets.
 */
function resolveLayout(widgets: PlacedWidget[]): PlacedWidget[] {
  const partials: PartialRect[] = widgets.map((w) => {
    const def = getWidgetById(w.widgetId);
    const { w: defW, h: defH } = getDefaultSize(w.widgetId);
    const positioned =
      w.gridX !== undefined &&
      w.gridY !== undefined &&
      w.gridW !== undefined &&
      w.gridH !== undefined;

    // Enforce the registry's current minW/minH against saved layouts. If the
    // registry tightens minimums later (because a widget needs more room than
    // before), grow saved instances to match instead of leaving them too small.
    const minW = def?.minW ?? 1;
    const minH = def?.minH ?? 1;
    const savedW = positioned ? w.gridW! : (def?.defaultW ?? defW);
    const savedH = positioned ? w.gridH! : (def?.defaultH ?? defH);

    return {
      id: w.instanceId,
      widgetId: w.widgetId,
      positioned,
      x: positioned ? w.gridX! : 0,
      y: positioned ? w.gridY! : 0,
      w: Math.max(savedW, minW),
      h: Math.max(savedH, minH),
    };
  });

  const resolved = autoLayout(partials);

  return widgets.map((w) => {
    const r = resolved.find((r) => r.id === w.instanceId)!;
    return { ...w, gridX: r.x, gridY: r.y, gridW: r.w, gridH: r.h };
  });
}

export function DashboardShell() {
  const { user } = useAuth();
  const [placedWidgets, setPlacedWidgets] = useState<PlacedWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeOpen, setStoreOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  // Ref so save callbacks always see the latest widget list.
  const widgetsRef = useRef<PlacedWidget[]>([]);

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    null;

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------

  useEffect(() => {
    fetchDashboardWidgets()
      .then((raw) => {
        const resolved = resolveLayout(raw);
        setPlacedWidgets(resolved);
        widgetsRef.current = resolved;

        // If any widget needed auto-placement, persist immediately so the
        // next load skips the auto-layout step.
        const anyUnpositioned = raw.some((w) => w.gridX === undefined);
        if (anyUnpositioned) {
          saveDashboardWidgets(resolved).catch(() => {
            // Non-critical: positions will be recalculated on next load.
          });
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("Not authenticated")) {
          toast.error("Could not load your dashboard. Please refresh.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // -------------------------------------------------------------------------
  // Add
  // -------------------------------------------------------------------------

  async function handleAdd(widgetId: string) {
    setAdding(widgetId);
    try {
      const def = getWidgetById(widgetId);
      const { w: defW, h: defH } = getDefaultSize(widgetId);
      const w = def?.defaultW ?? defW;
      const h = def?.defaultH ?? defH;

      const currentRects = widgetsRef.current
        .filter((pw) => pw.gridX !== undefined)
        .map((pw) => ({
          id: pw.instanceId,
          x: pw.gridX!,
          y: pw.gridY!,
          w: pw.gridW!,
          h: pw.gridH!,
        }));

      const { x, y } = findFirstFit(w, h, currentRects);
      const newWidget = await addDashboardWidget(widgetId, { x, y, w, h });
      const positioned = { ...newWidget, gridX: x, gridY: y, gridW: w, gridH: h };

      setPlacedWidgets((prev) => {
        const next = [...prev, positioned];
        widgetsRef.current = next;
        return next;
      });
      toast.success("Widget added");
    } catch (err) {
      toast.error("Failed to add widget");
      if (process.env.NODE_ENV !== "production") console.error(err);
    } finally {
      setAdding(null);
    }
  }

  // -------------------------------------------------------------------------
  // Remove
  // -------------------------------------------------------------------------

  async function handleRemove(instanceId: string) {
    setPlacedWidgets((prev) => {
      const next = prev.filter((w) => w.instanceId !== instanceId);
      widgetsRef.current = next;
      return next;
    });
    try {
      await removeDashboardWidget(instanceId);
    } catch {
      toast.error("Failed to remove widget");
      fetchDashboardWidgets()
        .then((raw) => {
          const resolved = resolveLayout(raw);
          setPlacedWidgets(resolved);
          widgetsRef.current = resolved;
        })
        .catch(() => {});
    }
  }

  // -------------------------------------------------------------------------
  // Move (drag to new grid cell)
  // -------------------------------------------------------------------------

  async function handleMove(instanceId: string, x: number, y: number) {
    setPlacedWidgets((prev) => {
      const next = prev.map((w) =>
        w.instanceId === instanceId ? { ...w, gridX: x, gridY: y } : w
      );
      widgetsRef.current = next;
      return next;
    });
    try {
      await saveDashboardWidgets(widgetsRef.current);
    } catch {
      toast.error("Failed to save layout");
    }
  }

  // -------------------------------------------------------------------------
  // Resize
  // -------------------------------------------------------------------------

  async function handleResize(instanceId: string, w: number, h: number) {
    setPlacedWidgets((prev) => {
      const next = prev.map((pw) =>
        pw.instanceId === instanceId ? { ...pw, gridW: w, gridH: h } : pw
      );
      widgetsRef.current = next;
      return next;
    });
    try {
      await saveDashboardWidgets(widgetsRef.current);
    } catch {
      toast.error("Failed to save layout");
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

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
            Drag to move widgets. Resize from the bottom-right corner.
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
        onMove={handleMove}
        onResize={handleResize}
        onRemove={handleRemove}
        onOpenStore={() => setStoreOpen(true)}
      />
    </div>
  );
}
