"use client";

import { LayoutDashboard, Plus } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { WidgetCard } from "./WidgetCard";
import type { PlacedWidget } from "./api";

interface WidgetGridProps {
  widgets: PlacedWidget[];
  onReorder: (widgets: PlacedWidget[]) => void;
  onRemove: (instanceId: string) => void;
  onOpenStore: () => void;
}

export function WidgetGrid({
  widgets,
  onReorder,
  onRemove,
  onOpenStore,
}: WidgetGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = widgets.findIndex((w) => w.instanceId === active.id);
    const newIndex = widgets.findIndex((w) => w.instanceId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(widgets, oldIndex, newIndex).map((w, idx) => ({
      ...w,
      order: idx,
    }));
    onReorder(reordered);
  }

  if (widgets.length === 0) {
    return (
      <div
        onClick={onOpenStore}
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/10 py-16 text-center cursor-pointer hover:border-muted-foreground/40 hover:bg-muted/20 transition-colors group"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 group-hover:border-muted-foreground/50 transition-colors">
          <Plus className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Your dashboard is empty
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Click here or open the Widget Store to add widgets
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={widgets.map((w) => w.instanceId)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {widgets.map((widget) => (
              <WidgetCard
                key={widget.instanceId}
                widget={widget}
                onRemove={onRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add more prompt */}
      <button
        onClick={onOpenStore}
        className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 py-5 text-sm text-muted-foreground hover:border-muted-foreground/35 hover:text-foreground transition-colors"
      >
        <LayoutDashboard className="h-4 w-4" />
        Add more widgets from the Widget Store
      </button>
    </div>
  );
}
