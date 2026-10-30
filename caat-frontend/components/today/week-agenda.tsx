"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, CheckSquare } from "lucide-react";
import type { TodayTodo } from "@/lib/today-data";
import type { UnifiedDeadline } from "@/lib/unified-deadlines";

const SOURCE: Record<UnifiedDeadline["source"], string> = {
  app: "Application", scholarship: "Scholarship", custom: "Your own scholarship", event: "Calendar event",
};

/** Date-only math: the student's today comes from the loader, never this device's clock. */
function weekDates(todayISO: string) {
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(`${todayISO}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return {
      iso: date.toISOString().slice(0, 10),
      number: date.getUTCDate(),
      weekday: date.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" }),
      label: date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    };
  });
}

export function WeekAgenda({ todayISO, deadlines, todos, onViewTodos }: {
  todayISO: string;
  deadlines: UnifiedDeadline[];
  todos: Array<TodayTodo & { done: boolean }>;
  onViewTodos: (taskId?: string) => void;
}) {
  const [selected, setSelected] = useState(0);
  const days = weekDates(todayISO);
  const openTodos = todos.filter(todo => !todo.done);
  const day = days[selected];
  const due = deadlines.filter(item => item.dateISO === day.iso);
  const tasks = openTodos.filter(item => item.dueDate === day.iso);
  const total = due.length + tasks.length;
  return (
    <section aria-label="Your next seven days" className="min-w-0 rounded-xl border bg-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-5 sm:px-6">
        <div>
          <h2 className="text-2xl font-semibold">Your next seven days</h2>
          <p className="mt-1 text-sm text-muted-foreground">See what’s due. Choose a day to plan your work.</p>
        </div>
        <button type="button" onClick={() => onViewTodos()} className="rounded-md px-3 py-2 text-sm font-medium text-[#9a1a27] dark:text-[#e06b78] hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">All to-dos</button>
      </div>
      <div className="mx-4 mt-5 overflow-x-auto pb-2 sm:mx-6" role="group" aria-label="Choose an agenda day">
        <div className="grid min-w-[350px] grid-cols-7 gap-1 sm:gap-2 p-1">
          {days.map((item, index) => {
            const count = deadlines.filter(d => d.dateISO === item.iso).length + openTodos.filter(t => t.dueDate === item.iso).length;
            return (
              <button key={item.iso} type="button" aria-pressed={index === selected}
                aria-label={`${item.label}${index === 0 ? ", Today" : ""}, ${count} item${count === 1 ? "" : "s"}`}
                onClick={() => setSelected(index)}
                className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-lg px-1 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a1a27] dark:focus-visible:outline-[#e06b78] ${index === selected ? "bg-[#9a1a27] text-white" : "bg-muted/50 hover:bg-muted"}`}>
                <span className="text-xs">{index === 0 ? "Today" : item.weekday}</span>
                <span className="font-display text-2xl leading-none">{item.number}</span>
                <span className={`text-xs ${index === selected ? "text-white/90" : "text-muted-foreground"}`}>{count ? `${count} due` : "—"}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t mt-3">
        <p role="status" className="px-4 py-3 text-sm font-medium sm:px-6">{day.label} <span className="text-muted-foreground">· {total} item{total === 1 ? "" : "s"}</span></p>
        {total ? (
          <ul className="max-h-72 overflow-y-auto divide-y border-t">
            {due.map(item => (
              <li key={`deadline-${item.id}`}>
                <Link href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#9a1a27] sm:px-6">
                  <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{item.title}</span><span className="block text-xs text-muted-foreground">{SOURCE[item.source]}</span></span>
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
            {tasks.map(item => (
              <li key={`todo-${item.id}`}>
                <button type="button" onClick={() => onViewTodos(item.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#9a1a27] sm:px-6">
                  <CheckSquare aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{item.text}</span><span className="block text-xs text-muted-foreground">Personal to-do · Open your to-dos</span></span>
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="px-4 pb-5 text-sm text-muted-foreground sm:px-6">No deadlines or dated to-dos on this day.</p>}
      </div>
      <p className="border-t bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:px-6">Dated items only. Find overdue and undated tasks in All to-dos; application preparation stays in Needs attention.</p>
    </section>
  );
}
