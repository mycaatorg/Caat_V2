"use client";

import { Store, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { widgetRegistry, type WidgetDefinition } from "./widget-registry";
import type { PlacedWidget } from "./api";

interface WidgetStoreProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placedWidgets: PlacedWidget[];
  onAdd: (widgetId: string) => void;
  adding: string | null;
}

function WidgetStoreItem({
  definition,
  isAdded,
  isLoading,
  onAdd,
}: {
  definition: WidgetDefinition;
  isAdded: boolean;
  isLoading: boolean;
  onAdd: () => void;
}) {
  const Icon = definition.icon;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/40 transition-colors">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{definition.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
          {definition.description}
        </p>
      </div>
      <Button
        size="sm"
        variant={isAdded ? "secondary" : "default"}
        className="shrink-0 h-7 px-2.5 text-xs"
        onClick={onAdd}
        disabled={isLoading}
      >
        {isAdded ? (
          <>
            <Check className="h-3.5 w-3.5 mr-1" />
            Added
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </>
        )}
      </Button>
    </div>
  );
}

export function WidgetStoreTrigger({
  open,
  onOpenChange,
  placedWidgets,
  onAdd,
  adding,
}: WidgetStoreProps) {
  const placedIds = new Set(placedWidgets.map((w) => w.widgetId));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Store className="h-4 w-4" />
          Widget Store
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-80 sm:w-96 p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3">
          <SheetTitle className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            Widget Store
          </SheetTitle>
          <SheetDescription>
            Customize your workspace. Click a widget to add it to your dashboard.
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-2.5">
            {widgetRegistry.map((definition) => (
              <WidgetStoreItem
                key={definition.id}
                definition={definition}
                isAdded={placedIds.has(definition.id)}
                isLoading={adding === definition.id}
                onAdd={() => onAdd(definition.id)}
              />
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-dashed p-4 text-center">
            <p className="text-xs text-muted-foreground">
              More widgets coming soon.
            </p>
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground text-center">
            {placedIds.size} of {widgetRegistry.length} widgets added
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
