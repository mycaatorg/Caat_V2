import type { LucideIcon } from "lucide-react";
import { Calendar, CheckSquare, BookOpen, School, Clock } from "lucide-react";
import type { ComponentType } from "react";

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  // Lazy-loaded via dynamic import to keep the registry tree-shakeable
  component: ComponentType;
  /** Default width in grid units (out of COLS=4). */
  defaultW: number;
  /** Default height in grid units. */
  defaultH: number;
  /**
   * Minimum width the widget can be resized to before its content
   * looks cramped or broken.
   */
  minW: number;
  /**
   * Minimum height the widget can be resized to before its content
   * looks cramped or broken.
   */
  minH: number;
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
import { UpcomingDeadlinesWidget } from "./widgets/UpcomingDeadlinesWidget";

export const widgetRegistry: WidgetDefinition[] = [
  {
    id: "calendar",
    title: "Calendar",
    description: "View and track upcoming dates and events.",
    icon: Calendar,
    component: CalendarWidget,
    defaultW: 2,
    defaultH: 4,
    // Needs 2 cols for calendar + event panel side-by-side;
    // 3 rows so the full month grid fits without clipping.
    minW: 2,
    minH: 3,
  },
  {
    id: "todo",
    title: "To-Do List",
    description: "Keep track of your personal tasks and reminders.",
    icon: CheckSquare,
    component: TodoWidget,
    defaultW: 2,
    defaultH: 3,
    // 1 col is fine for a vertical list; 2 rows = enough for the
    // input bar + at least one task row visible.
    minW: 1,
    minH: 2,
  },
  {
    id: "bookmarked-majors",
    title: "Bookmarked Majors",
    description: "Quick access to the majors you have saved.",
    icon: BookOpen,
    component: BookmarkedMajorsWidget,
    defaultW: 2,
    defaultH: 2,
    // 2 rows = enough for the "View all" link + at least one item; the inner
    // list scrolls when content exceeds the available height.
    minW: 1,
    minH: 2,
  },
  {
    id: "bookmarked-schools",
    title: "Bookmarked Schools",
    description: "Quick access to the schools you have saved.",
    icon: School,
    component: BookmarkedSchoolsWidget,
    defaultW: 2,
    defaultH: 2,
    minW: 1,
    minH: 2,
  },
  {
    id: "upcoming-deadlines",
    title: "Upcoming Deadlines",
    description: "See upcoming scholarship and application deadlines.",
    icon: Clock,
    component: UpcomingDeadlinesWidget,
    defaultW: 2,
    defaultH: 3,
    // Each deadline row needs a bit of width for dot + label + countdown.
    minW: 1,
    minH: 2,
  },
];

export function getWidgetById(id: string): WidgetDefinition | undefined {
  return widgetRegistry.find((w) => w.id === id);
}
