"use client";

import { useRef, useState, useCallback } from "react";
import { LayoutDashboard, Plus } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { getWidgetById } from "./widget-registry";
import type { PlacedWidget } from "./api";
import {
  COLS,
  ROW_HEIGHT_PX,
  GAP_PX,
  buildOccupied,
  hasConflict,
  getGridHeight,
  pixelToCell,
} from "@/lib/grid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WidgetGridProps {
  widgets: PlacedWidget[];
  onMove: (instanceId: string, x: number, y: number) => void;
  onResize: (instanceId: string, w: number, h: number) => void;
  onRemove: (instanceId: string) => void;
  onOpenStore: () => void;
}

interface DragState {
  instanceId: string;
  /** Pixel offset within the widget where the user grabbed (canvas-relative). */
  grabPixelX: number;
  grabPixelY: number;
  /** Grid-unit grab offset — used for ghost snapping. */
  grabCol: number;
  grabRow: number;
  /** Current cursor position relative to canvas (updated on every pointermove). */
  mouseX: number;
  mouseY: number;
}

interface ResizeState {
  instanceId: string;
  startMouseX: number;
  startMouseY: number;
  startW: number;
  startH: number;
}

interface Preview {
  x: number;
  y: number;
  w: number;
  h: number;
  valid: boolean;
}

// ---------------------------------------------------------------------------
// Shared position helper — same formula used for rendering and hit-testing
// ---------------------------------------------------------------------------

/** CSS left value for a widget at column x. */
function cssLeft(x: number) {
  return `calc(${x} / ${COLS} * (100% + ${GAP_PX}px))`;
}

/** CSS width value for a widget spanning w columns. */
function cssWidth(w: number) {
  return `calc(${w} / ${COLS} * (100% + ${GAP_PX}px) - ${GAP_PX}px)`;
}

/** Pixel top for a widget at row y. */
function pxTop(y: number) {
  return y * (ROW_HEIGHT_PX + GAP_PX);
}

/** Pixel height for a widget spanning h rows. */
function pxHeight(h: number) {
  return h * (ROW_HEIGHT_PX + GAP_PX) - GAP_PX;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WidgetGrid({
  widgets,
  onMove,
  onResize,
  onRemove,
  onOpenStore,
}: WidgetGridProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  // Snapped landing zone shown as a ghost while dragging / resizing.
  const [preview, setPreview] = useState<Preview | null>(null);

  const getCanvasRect = useCallback(
    () => canvasRef.current?.getBoundingClientRect() ?? new DOMRect(),
    []
  );

  // ---------------------------------------------------------------------------
  // Geometry: cell width includes its share of the gap so snapping is exact.
  //   totalWidth = COLS*cellW - GAP   ⟹   cellW = (totalWidth + GAP) / COLS
  // ---------------------------------------------------------------------------
  function cellWidthPx(canvasWidth: number) {
    return (canvasWidth + GAP_PX) / COLS;
  }

  function cellHeightPx() {
    return ROW_HEIGHT_PX + GAP_PX;
  }

  // ---------------------------------------------------------------------------
  // Shared: build the list of grid rects for collision checks
  // ---------------------------------------------------------------------------
  function toRects(excludeId?: string) {
    return widgets
      .filter((w) => w.gridX !== undefined && w.instanceId !== excludeId)
      .map((w) => ({ id: w.instanceId, x: w.gridX!, y: w.gridY!, w: w.gridW!, h: w.gridH! }));
  }

  // ---------------------------------------------------------------------------
  // Drag — widget floats freely under cursor, ghost shows snapped target
  // ---------------------------------------------------------------------------

  function handleDragHandlePointerDown(
    instanceId: string,
    e: React.PointerEvent<HTMLElement>
  ) {
    e.preventDefault();
    const widget = widgets.find((w) => w.instanceId === instanceId);
    if (!widget) return;

    const canvasRect = getCanvasRect();
    const cw = cellWidthPx(canvasRect.width);
    const ch = cellHeightPx();

    // Pixel offset of the grab point relative to the canvas top-left
    const widgetLeftPx = (widget.gridX! / COLS) * (canvasRect.width + GAP_PX);
    const widgetTopPx = pxTop(widget.gridY!);

    const grabPixelX = e.clientX - canvasRect.left - widgetLeftPx;
    const grabPixelY = e.clientY - canvasRect.top - widgetTopPx;

    // Grid-unit grab offset (for snapping the ghost correctly)
    const grabCol = Math.max(0, Math.min(widget.gridW! - 1, Math.floor(grabPixelX / cw)));
    const grabRow = Math.max(0, Math.min(widget.gridH! - 1, Math.floor(grabPixelY / ch)));

    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    setDrag({ instanceId, grabPixelX, grabPixelY, grabCol, grabRow, mouseX, mouseY });
    setPreview({ x: widget.gridX!, y: widget.gridY!, w: widget.gridW!, h: widget.gridH!, valid: true });

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------

  function handleResizeHandlePointerDown(
    instanceId: string,
    e: React.PointerEvent<HTMLElement>
  ) {
    e.preventDefault();
    e.stopPropagation();
    const widget = widgets.find((w) => w.instanceId === instanceId);
    if (!widget) return;

    setResize({
      instanceId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startW: widget.gridW!,
      startH: widget.gridH!,
    });
    setPreview({ x: widget.gridX!, y: widget.gridY!, w: widget.gridW!, h: widget.gridH!, valid: true });

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  // ---------------------------------------------------------------------------
  // Overlay pointer handlers
  // ---------------------------------------------------------------------------

  function handleOverlayPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const canvasRect = getCanvasRect();
    const relX = e.clientX - canvasRect.left;
    const relY = e.clientY - canvasRect.top;

    if (drag) {
      // Update cursor position so the widget follows the mouse.
      setDrag((prev) => prev ? { ...prev, mouseX: relX, mouseY: relY } : prev);

      // Compute snapped ghost target.
      const widget = widgets.find((w) => w.instanceId === drag.instanceId);
      if (!widget) return;

      const { col: rawCol, row: rawRow } = pixelToCell(relX, relY, canvasRect.width);
      const targetX = Math.max(0, Math.min(COLS - widget.gridW!, rawCol - drag.grabCol));
      const targetY = Math.max(0, rawRow - drag.grabRow);

      const occupied = buildOccupied(toRects(drag.instanceId).map(r => ({ ...r })), drag.instanceId);
      const valid = !hasConflict({ x: targetX, y: targetY, w: widget.gridW!, h: widget.gridH! }, occupied);

      setPreview({ x: targetX, y: targetY, w: widget.gridW!, h: widget.gridH!, valid });
      return;
    }

    if (resize) {
      const widget = widgets.find((w) => w.instanceId === resize.instanceId);
      if (!widget) return;

      const cw = cellWidthPx(canvasRect.width);
      const ch = cellHeightPx();

      const def = getWidgetById(widget.widgetId);
      const minW = def?.minW ?? 1;
      const minH = def?.minH ?? 1;

      const deltaX = e.clientX - resize.startMouseX;
      const deltaY = e.clientY - resize.startMouseY;
      const newW = Math.max(minW, Math.min(COLS - widget.gridX!, resize.startW + Math.round(deltaX / cw)));
      const newH = Math.max(minH, resize.startH + Math.round(deltaY / ch));

      const occupied = buildOccupied(
        toRects(resize.instanceId).map(r => ({ ...r })),
        resize.instanceId
      );
      const valid = !hasConflict({ x: widget.gridX!, y: widget.gridY!, w: newW, h: newH }, occupied);

      setPreview({ x: widget.gridX!, y: widget.gridY!, w: newW, h: newH, valid });
    }
  }

  function handleOverlayPointerUp() {
    if (drag && preview && preview.valid) {
      onMove(drag.instanceId, preview.x, preview.y);
    }
    setDrag(null);

    if (resize && preview && preview.valid) {
      onResize(resize.instanceId, preview.w, preview.h);
    }
    setResize(null);

    setPreview(null);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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

  const positionedWidgets = widgets.filter((w) => w.gridX !== undefined);
  const gridRows = getGridHeight(
    positionedWidgets.map((w) => ({ id: w.instanceId, x: w.gridX!, y: w.gridY!, w: w.gridW!, h: w.gridH! }))
  );

  // Default: exact height to fit all widgets. Add a 2-row buffer only while
  // dragging so there's room to drop below the current bottom edge.
  const canvasHeightPx = drag
    ? (gridRows + 2) * (ROW_HEIGHT_PX + GAP_PX) + GAP_PX
    : gridRows * (ROW_HEIGHT_PX + GAP_PX) - GAP_PX;

  return (
    <div className="space-y-4">
      <div
        ref={canvasRef}
        className="relative select-none"
        style={{ height: canvasHeightPx }}
      >
        {/* Widgets */}
        {positionedWidgets.map((widget) => {
          const isDraggingThis = drag?.instanceId === widget.instanceId;
          const isResizingThis = resize?.instanceId === widget.instanceId;

          let style: React.CSSProperties;

          if (isDraggingThis && drag) {
            // Widget floats freely at cursor position — no grid snapping while dragging.
            style = {
              position: "absolute",
              left: drag.mouseX - drag.grabPixelX,
              top: drag.mouseY - drag.grabPixelY,
              width: cssWidth(widget.gridW!),
              height: pxHeight(widget.gridH!),
              transition: "none",
              opacity: 0.85,
              zIndex: 30,
              pointerEvents: "none",
              // Keep width stable while floating
              boxSizing: "border-box",
            };
          } else if (isResizingThis && preview) {
            // During resize, show the widget live at its new size.
            style = {
              position: "absolute",
              left: cssLeft(widget.gridX!),
              top: pxTop(widget.gridY!),
              width: cssWidth(preview.w),
              height: pxHeight(preview.h),
              transition: "none",
              zIndex: 10,
            };
          } else {
            // Normal resting state — smooth position/size transitions.
            style = {
              position: "absolute",
              left: cssLeft(widget.gridX!),
              top: pxTop(widget.gridY!),
              width: cssWidth(widget.gridW!),
              height: pxHeight(widget.gridH!),
              transition: "left 200ms ease, top 200ms ease, width 200ms ease, height 200ms ease",
              zIndex: 1,
            };
          }

          return (
            <WidgetCard
              key={widget.instanceId}
              widget={widget}
              style={style}
              isDragging={isDraggingThis}
              isResizing={isResizingThis}
              onRemove={onRemove}
              onDragHandlePointerDown={(e) =>
                handleDragHandlePointerDown(widget.instanceId, e)
              }
              onResizeHandlePointerDown={(e) =>
                handleResizeHandlePointerDown(widget.instanceId, e)
              }
            />
          );
        })}

        {/* Drop zone ghost — snapped landing position, shown while dragging */}
        {drag && preview && (
          <div
            className={`absolute rounded-xl border-2 pointer-events-none ${
              preview.valid
                ? "border-primary/50 bg-primary/5"
                : "border-destructive/50 bg-destructive/5"
            }`}
            style={{
              left: cssLeft(preview.x),
              top: pxTop(preview.y),
              width: cssWidth(preview.w),
              height: pxHeight(preview.h),
              zIndex: 5,
              transition: "left 80ms ease, top 80ms ease",
            }}
          />
        )}

        {/* Transparent overlay — captures all pointer events during drag/resize */}
        {(drag || resize) && (
          <div
            className="absolute inset-0 z-20"
            style={{
              cursor: drag ? "grabbing" : "se-resize",
              // Extend below the canvas so fast drags don't escape
              bottom: "-200px",
            }}
            onPointerMove={handleOverlayPointerMove}
            onPointerUp={handleOverlayPointerUp}
          />
        )}
      </div>

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
