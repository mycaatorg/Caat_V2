"use client";

import { GripVertical, X, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWidgetById } from "./widget-registry";
import type { PlacedWidget } from "./api";

interface WidgetCardProps {
  widget: PlacedWidget;
  /** Absolute-positioning style injected by WidgetGrid. */
  style?: React.CSSProperties;
  isDragging?: boolean;
  isResizing?: boolean;
  onRemove: (instanceId: string) => void;
  /** Called when the user presses on the drag handle. */
  onDragHandlePointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  /** Called when the user presses on the resize handle. */
  onResizeHandlePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function WidgetCard({
  widget,
  style,
  isDragging,
  isResizing,
  onRemove,
  onDragHandlePointerDown,
  onResizeHandlePointerDown,
}: WidgetCardProps) {
  const definition = getWidgetById(widget.widgetId);
  if (!definition) return null;

  const Icon = definition.icon;
  const WidgetComponent = definition.component;

  return (
    <div
      style={style}
      className="w-full"
      data-widget-id={widget.instanceId}
    >
      <Card
        className={`relative group overflow-hidden h-full flex flex-col ${
          isDragging || isResizing ? "ring-2 ring-primary/40 shadow-xl" : ""
        }`}
      >
        <CardHeader className="flex flex-row items-center gap-2 pb-3 pt-3 px-4 shrink-0">
          {/* Drag handle */}
          <button
            onPointerDown={onDragHandlePointerDown}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors touch-none"
            aria-label="Drag to move"
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

        <CardContent className="px-4 pb-4 flex-1 min-h-0 overflow-hidden flex flex-col">
          <WidgetComponent />
        </CardContent>

        {/* Resize handle — bottom-right corner */}
        <div
          onPointerDown={onResizeHandlePointerDown}
          className="absolute bottom-1 right-1 p-1 cursor-se-resize opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-muted-foreground touch-none"
          aria-label="Drag to resize"
        >
          <GripHorizontal className="h-3 w-3 rotate-45" />
        </div>
      </Card>
    </div>
  );
}
