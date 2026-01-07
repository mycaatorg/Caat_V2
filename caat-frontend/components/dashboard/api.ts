//components/dashboard/api.ts
import { supabase } from "@/src/lib/supabaseClient";

export async function getWidgetsFromDB(user_id: string) {
  const { data: widgets, error } = await supabase
    .from("widgets")
    .select("*")
    .order("section", { ascending: true })
    .order("order", { ascending: true });

  if (error) throw error;

  if (widgets.length === 0) {
    const defaultWidgets = [
      { icon: "list-todo", section: "main", order: 1, user_id: user_id },
      { icon: "calendar", section: "active", order: 1, user_id: user_id },
      { icon: "news", section: "active", order: 2, user_id: user_id },
      { icon: "university", section: "active", order: 3, user_id: user_id }
    ];
    await supabase.from("widgets").insert(defaultWidgets);
    return defaultWidgets;
}
  return widgets;
}
