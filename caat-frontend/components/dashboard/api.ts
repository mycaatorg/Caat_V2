import { supabase } from "@/src/lib/supabaseClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlacedWidget {
  /** Unique instance ID (uuid from DB row) */
  instanceId: string;
  /** Matches a WidgetDefinition.id in the registry */
  widgetId: string;
  /** Display order (0-based) — kept for backward-compat */
  order: number;
  /**
   * Grid position and size (in grid units).
   * Undefined when the DB columns haven't been migrated yet;
   * DashboardShell will auto-assign positions in that case.
   */
  gridX?: number;
  gridY?: number;
  gridW?: number;
  gridH?: number;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchDashboardWidgets(): Promise<PlacedWidget[]> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  // Try selecting grid columns; fall back gracefully if the DB migration
  // hasn't been run yet (PostgREST returns an error for unknown columns).
  const { data: fullData, error: fullError } = await supabase
    .from("user_dashboard_widgets")
    .select("id, widget_id, order, grid_x, grid_y, grid_w, grid_h")
    .eq("user_id", user.id)
    .order("order", { ascending: true });

  if (!fullError) {
    return (fullData ?? []).map((row) => ({
      instanceId: row.id as string,
      widgetId: row.widget_id as string,
      order: row.order as number,
      gridX: row.grid_x != null ? (row.grid_x as number) : undefined,
      gridY: row.grid_y != null ? (row.grid_y as number) : undefined,
      gridW: row.grid_w != null ? (row.grid_w as number) : undefined,
      gridH: row.grid_h != null ? (row.grid_h as number) : undefined,
    }));
  }

  // Fallback: DB columns not yet added — return without grid positions.
  const { data, error } = await supabase
    .from("user_dashboard_widgets")
    .select("id, widget_id, order")
    .eq("user_id", user.id)
    .order("order", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    instanceId: row.id as string,
    widgetId: row.widget_id as string,
    order: row.order as number,
  }));
}

// ---------------------------------------------------------------------------
// Add a widget (inserts one row, order = current max + 1)
// ---------------------------------------------------------------------------

export async function addDashboardWidget(
  widgetId: string,
  gridPos?: { x: number; y: number; w: number; h: number }
): Promise<PlacedWidget> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  // Get current max order
  const { data: existing } = await supabase
    .from("user_dashboard_widgets")
    .select("order")
    .eq("user_id", user.id)
    .order("order", { ascending: false })
    .limit(1);

  const nextOrder =
    existing && existing.length > 0 ? (existing[0].order as number) + 1 : 0;

  const insertRow: Record<string, unknown> = {
    user_id: user.id,
    widget_id: widgetId,
    order: nextOrder,
  };
  if (gridPos) {
    insertRow.grid_x = gridPos.x;
    insertRow.grid_y = gridPos.y;
    insertRow.grid_w = gridPos.w;
    insertRow.grid_h = gridPos.h;
  }

  const { data, error } = await supabase
    .from("user_dashboard_widgets")
    .insert(insertRow)
    .select("id, widget_id, order, grid_x, grid_y, grid_w, grid_h")
    .single();

  if (error) throw new Error(error.message);

  return {
    instanceId: data.id as string,
    widgetId: data.widget_id as string,
    order: data.order as number,
    gridX: data.grid_x != null ? (data.grid_x as number) : undefined,
    gridY: data.grid_y != null ? (data.grid_y as number) : undefined,
    gridW: data.grid_w != null ? (data.grid_w as number) : undefined,
    gridH: data.grid_h != null ? (data.grid_h as number) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Remove a widget by its instance ID
// ---------------------------------------------------------------------------

export async function removeDashboardWidget(instanceId: string): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_dashboard_widgets")
    .delete()
    .eq("id", instanceId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Persist a full reordered list (upsert all rows with new order values)
// ---------------------------------------------------------------------------

export async function saveDashboardWidgets(widgets: PlacedWidget[]): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const upsertRows = widgets.map((w, idx) => ({
    id: w.instanceId,
    user_id: user.id,
    widget_id: w.widgetId,
    order: idx,
    ...(w.gridX !== undefined && {
      grid_x: w.gridX,
      grid_y: w.gridY,
      grid_w: w.gridW,
      grid_h: w.gridH,
    }),
  }));

  const { error } = await supabase
    .from("user_dashboard_widgets")
    .upsert(upsertRows, { onConflict: "id" });

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Todo widget helpers (user_todos table)
// ---------------------------------------------------------------------------

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  due_date: string | null;  // ISO date string "YYYY-MM-DD"
  priority: number;         // 1 = high, 2 = medium, 3 = low
  created_at: string;
}

const TODO_SELECT = "id, text, done, due_date, priority, created_at";

export async function fetchTodos(): Promise<TodoItem[]> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_todos")
    .select(TODO_SELECT)
    .eq("user_id", user.id)
    .order("done", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as TodoItem[];
}

export async function addTodo(
  text: string,
  opts?: { due_date?: string | null; priority?: number }
): Promise<TodoItem> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_todos")
    .insert({
      user_id: user.id,
      text,
      done: false,
      due_date: opts?.due_date ?? null,
      priority: opts?.priority ?? 2,
    })
    .select(TODO_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as TodoItem;
}

export async function updateTodo(
  id: string,
  patch: Partial<Pick<TodoItem, "due_date" | "priority" | "text">>
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_todos")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function toggleTodo(id: string, done: boolean): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_todos")
    .update({ done })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function deleteTodo(id: string): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_todos")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}
