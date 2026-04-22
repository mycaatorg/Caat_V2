// ---------------------------------------------------------------------------
// Pure cell-based grid engine — no React dependencies.
//
// The grid is COLS columns wide and grows vertically without limit.
// Each widget occupies a rectangular block of cells. Collision detection
// works on individual cells, so a tall widget in column 3 never blocks
// a cell in column 1 just because they share the same row range.
// ---------------------------------------------------------------------------

export const COLS = 4;
/** Visual height of one row unit in pixels (used for CSS, not layout logic). */
export const ROW_HEIGHT_PX = 108;
/** Gap between grid cells in pixels. */
export const GAP_PX = 8;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GridRect {
  /** Widget instance ID — used to exclude self during collision checks. */
  id: string;
  /** 0-based column index of the left edge. */
  x: number;
  /** 0-based row index of the top edge. */
  y: number;
  /** Column span (1 … COLS). */
  w: number;
  /** Row span (>= 1). */
  h: number;
}

// ---------------------------------------------------------------------------
// Core primitives
// ---------------------------------------------------------------------------

/**
 * Build a Set of "col,row" strings for every cell occupied by the given
 * rects, optionally excluding one widget (e.g. the one being dragged).
 */
export function buildOccupied(
  rects: GridRect[],
  excludeId?: string
): Set<string> {
  const cells = new Set<string>();
  for (const r of rects) {
    if (r.id === excludeId) continue;
    for (let col = r.x; col < r.x + r.w; col++) {
      for (let row = r.y; row < r.y + r.h; row++) {
        cells.add(`${col},${row}`);
      }
    }
  }
  return cells;
}

/**
 * Returns true if any cell of the given rect is already occupied.
 */
export function hasConflict(
  rect: Omit<GridRect, "id">,
  occupied: Set<string>
): boolean {
  for (let col = rect.x; col < rect.x + rect.w; col++) {
    for (let row = rect.y; row < rect.y + rect.h; row++) {
      if (occupied.has(`${col},${row}`)) return true;
    }
  }
  return false;
}

/**
 * Returns true if the rect would exceed the grid's column bounds.
 */
export function exceedsBounds(rect: Omit<GridRect, "id">): boolean {
  return rect.x < 0 || rect.y < 0 || rect.x + rect.w > COLS || rect.w < 1 || rect.h < 1;
}

/**
 * Check whether placing / resizing a widget to the given rect is valid:
 * - Does not collide with other widgets
 * - Stays within column bounds
 */
export function isPlacementValid(
  rect: Omit<GridRect, "id">,
  allRects: GridRect[],
  excludeId?: string
): boolean {
  if (exceedsBounds(rect)) return false;
  const occupied = buildOccupied(allRects, excludeId);
  return !hasConflict(rect, occupied);
}

// ---------------------------------------------------------------------------
// Auto-placement
// ---------------------------------------------------------------------------

/**
 * Find the top-left-most free cell where a w×h rect fits.
 * Scans row by row, left to right.
 */
export function findFirstFit(
  w: number,
  h: number,
  existing: GridRect[],
  excludeId?: string
): { x: number; y: number } {
  const occupied = buildOccupied(existing, excludeId);
  for (let row = 0; row < 200; row++) {
    for (let col = 0; col <= COLS - w; col++) {
      if (!hasConflict({ x: col, y: row, w, h }, occupied)) {
        return { x: col, y: row };
      }
    }
  }
  return { x: 0, y: 200 }; // fallback — effectively unreachable
}

// ---------------------------------------------------------------------------
// Default sizes
// ---------------------------------------------------------------------------

const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  calendar:              { w: 2, h: 4 },
  todo:                  { w: 2, h: 3 },
  "bookmarked-majors":   { w: 2, h: 2 },
  "bookmarked-schools":  { w: 2, h: 2 },
  "upcoming-deadlines":  { w: 2, h: 3 },
};

export function getDefaultSize(widgetId: string): { w: number; h: number } {
  return DEFAULT_SIZES[widgetId] ?? { w: 2, h: 2 };
}

// ---------------------------------------------------------------------------
// Auto-layout
// ---------------------------------------------------------------------------

export interface PartialRect {
  id: string;
  widgetId: string;
  /** Whether this widget already has explicit grid coordinates. */
  positioned: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Given a mixed list of widgets (some already positioned, some not),
 * return a fully-positioned list.
 *
 * Already-positioned widgets are placed first (they anchor the layout).
 * Un-positioned widgets are auto-placed in reading order (top-left first).
 */
export function autoLayout(rects: PartialRect[]): GridRect[] {
  const result: GridRect[] = [];

  // First pass: keep widgets that already have explicit positions.
  for (const r of rects) {
    if (r.positioned) {
      result.push({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h });
    }
  }

  // Second pass: auto-place the rest in order.
  for (const r of rects) {
    if (!r.positioned) {
      const { x, y } = findFirstFit(r.w, r.h, result);
      result.push({ id: r.id, x, y, w: r.w, h: r.h });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maximum row index reached by any widget (i.e. bottom edge of the grid). */
export function getGridHeight(rects: GridRect[]): number {
  if (rects.length === 0) return 4;
  return Math.max(...rects.map((r) => r.y + r.h));
}

/**
 * Convert a pixel offset relative to the grid canvas into a grid cell.
 * Returns clamped values that are always within COLS.
 */
export function pixelToCell(
  relX: number,
  relY: number,
  canvasWidth: number
): { col: number; row: number } {
  const cellW = (canvasWidth + GAP_PX) / COLS;
  const cellH = ROW_HEIGHT_PX + GAP_PX;
  const col = Math.max(0, Math.min(COLS - 1, Math.floor(relX / cellW)));
  const row = Math.max(0, Math.floor(relY / cellH));
  return { col, row };
}
