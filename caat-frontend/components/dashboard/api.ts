import { supabase } from "@/src/lib/supabaseClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlacedWidget {
  /** Unique instance ID (uuid from DB row) */
  instanceId: string;
  /** Matches a WidgetDefinition.id in the registry */
  widgetId: string;
  /** Display order (0-based) */
  order: number;
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

export async function addDashboardWidget(widgetId: string): Promise<PlacedWidget> {
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

  const nextOrder = existing && existing.length > 0 ? (existing[0].order as number) + 1 : 0;

  const { data, error } = await supabase
    .from("user_dashboard_widgets")
    .insert({ user_id: user.id, widget_id: widgetId, order: nextOrder })
    .select("id, widget_id, order")
    .single();

  if (error) throw new Error(error.message);

  return {
    instanceId: data.id as string,
    widgetId: data.widget_id as string,
    order: data.order as number,
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
  created_at: string;
}

export async function fetchTodos(): Promise<TodoItem[]> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_todos")
    .select("id, text, done, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as TodoItem[];
}

export async function addTodo(text: string): Promise<TodoItem> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_todos")
    .insert({ user_id: user.id, text, done: false })
    .select("id, text, done, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as TodoItem;
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
