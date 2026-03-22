import type { LucideIcon } from "lucide-react";
import { Calendar, CheckSquare, BookOpen, School } from "lucide-react";
import type { ComponentType } from "react";

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  // Lazy-loaded via dynamic import to keep the registry tree-shakeable
  component: ComponentType;
}

// ---------------------------------------------------------------------------
// Registry — the ONLY file you need to touch to add a new widget.
// 1. Create your component under components/dashboard/widgets/
// 2. Import it here and add an entry to the array below.
// ---------------------------------------------------------------------------

import { CalendarWidget } from "./widgets/CalendarWidget";
import { TodoWidget } from "./widgets/TodoWidget";
import { BookmarkedMajorsWidget } from "./widgets/BookmarkedMajorsWidget";
import { BookmarkedSchoolsWidget } from "./widgets/BookmarkedSchoolsWidget";

export const widgetRegistry: WidgetDefinition[] = [
  {
    id: "calendar",
    title: "Calendar",
    description: "View and track upcoming dates and events.",
    icon: Calendar,
    component: CalendarWidget,
  },
  {
    id: "todo",
    title: "To-Do List",
    description: "Keep track of your personal tasks and reminders.",
    icon: CheckSquare,
    component: TodoWidget,
  },
  {
    id: "bookmarked-majors",
    title: "Bookmarked Majors",
    description: "Quick access to the majors you have saved.",
    icon: BookOpen,
    component: BookmarkedMajorsWidget,
  },
  {
    id: "bookmarked-schools",
    title: "Bookmarked Schools",
    description: "Quick access to the schools you have saved.",
    icon: School,
    component: BookmarkedSchoolsWidget,
  },
];

export function getWidgetById(id: string): WidgetDefinition | undefined {
  return widgetRegistry.find((w) => w.id === id);
}
