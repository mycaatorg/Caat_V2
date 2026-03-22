"use client";

import { GripVertical, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWidgetById } from "./widget-registry";
import type { PlacedWidget } from "./api";

interface WidgetCardProps {
  widget: PlacedWidget;
  onRemove: (instanceId: string) => void;
}

export function WidgetCard({ widget, onRemove }: WidgetCardProps) {
  const definition = getWidgetById(widget.widgetId);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.instanceId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  if (!definition) return null;

  const Icon = definition.icon;
  const WidgetComponent = definition.component;

  return (
    <div ref={setNodeRef} style={style} className="w-full">
      <Card className="relative group overflow-hidden">
        <CardHeader className="flex flex-row items-center gap-2 pb-3 pt-3 px-4">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors touch-none"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />

          <CardTitle className="text-sm font-medium flex-1">
            {definition.title}
          </CardTitle>

          {/* Remove button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onRemove(widget.instanceId)}
            aria-label={`Remove ${definition.title}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>

        <CardContent className="px-4 pb-4">
          <WidgetComponent />
        </CardContent>
      </Card>
    </div>
  );
}
