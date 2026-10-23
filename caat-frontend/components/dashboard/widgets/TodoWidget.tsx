"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchTodos,
  addTodo,
  toggleTodo,
  deleteTodo,
  updateTodo,
  type TodoItem,
} from "../api";

const PRIORITY_LABELS: Record<number, string> = { 1: "High", 2: "Medium", 3: "Low" };
const PRIORITY_COLORS: Record<number, string> = {
  1: "text-[#9a1a27] dark:text-[#e06b78]",
  2: "text-amber-600 dark:text-amber-400",
  3: "text-muted-foreground",
};

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isDuePast(iso: string | null): boolean {
  if (!iso) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function TodoWidget() {
  const router = useRouter();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [input, setInput] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<number>(2);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<Set<string>>(() => new Set());
  const recentlyCompletedIdsRef = useRef(new Set<string>());
  const [pendingTodoIds, setPendingTodoIds] = useState<Set<string>>(() => new Set());
  const pendingTodoIdsRef = useRef(new Set<string>());
  const todoVersionsRef = useRef(new Map<string, number>());

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setTodos(await fetchTodos());
    } catch {
      toast.error("Failed to load to-dos");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    const text = input.trim();
    if (!text) return;
    try {
      setAdding(true);
      const newTodo = await addTodo(text, {
        due_date: dueDate || null,
        priority,
      });
      // Insert and re-sort client-side to match DB ordering
      setTodos((prev) => sortTodos([...prev, newTodo]));
      setInput("");
      setDueDate("");
      setPriority(2);
      setShowOptions(false);
    } catch {
      toast.error("Failed to add to-do");
    } finally {
      setAdding(false);
    }
  }

  function setRecentlyCompleted(id: string, completed: boolean) {
    const next = new Set(recentlyCompletedIdsRef.current);
    if (completed) next.add(id);
    else next.delete(id);
    recentlyCompletedIdsRef.current = next;
    setRecentlyCompletedIds(next);
  }

  async function handleToggle(id: string, current: boolean) {
    if (pendingTodoIdsRef.current.has(id)) return;
    // Toast actions outlive the render that created them. Read the latest
    // membership so a failed Undo restores the task in its current section.
    const wasRecentlyCompleted = recentlyCompletedIdsRef.current.has(id);
    const nextDone = !current;
    const version = (todoVersionsRef.current.get(id) ?? 0) + 1;
    todoVersionsRef.current.set(id, version);
    pendingTodoIdsRef.current.add(id);
    setPendingTodoIds(new Set(pendingTodoIdsRef.current));
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: nextDone } : t)));
    setRecentlyCompleted(id, nextDone);
    try {
      await toggleTodo(id, nextDone);
      pendingTodoIdsRef.current.delete(id);
      setPendingTodoIds(new Set(pendingTodoIdsRef.current));
      router.refresh();
      if (todoVersionsRef.current.get(id) === version && nextDone) {
        toast.success("To-do completed", {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: () => {
              if (todoVersionsRef.current.get(id) === version) void handleToggle(id, true);
            },
          },
        });
      }
    } catch {
      pendingTodoIdsRef.current.delete(id);
      setPendingTodoIds(new Set(pendingTodoIdsRef.current));
      if (todoVersionsRef.current.get(id) !== version) return;
      toast.error("Failed to update to-do");
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: current } : t)));
      setRecentlyCompleted(id, wasRecentlyCompleted);
    }
  }

  async function handleDelete(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTodo(id);
    } catch {
      toast.error("Failed to delete to-do");
      load();
    }
  }

  async function handlePriorityChange(id: string, newPriority: number) {
    setTodos((prev) =>
      sortTodos(prev.map((t) => (t.id === id ? { ...t, priority: newPriority } : t)))
    );
    try {
      await updateTodo(id, { priority: newPriority });
    } catch {
      toast.error("Failed to update priority");
      load();
    }
  }

  function renderTodo(todo: TodoItem) {
    const dueLabel = formatDue(todo.due_date);
    const overdue = !todo.done && isDuePast(todo.due_date);
    return (
      <li
        key={todo.id}
        className={`flex items-center gap-2 group rounded-md px-1 py-0.5 hover:bg-muted/50 ${todo.done ? "opacity-60" : ""}`}
      >
        <Checkbox
          id={`todo-${todo.id}`}
          checked={todo.done}
          disabled={pendingTodoIds.has(todo.id)}
          onCheckedChange={() => handleToggle(todo.id, todo.done)}
          aria-label={todo.done ? `Restore "${todo.text}"` : `Mark "${todo.text}" done`}
        />
        <div className="flex-1 min-w-0">
          <label
            htmlFor={`todo-${todo.id}`}
            className={`block text-sm cursor-pointer truncate ${todo.done ? "line-through text-muted-foreground" : ""}`}
          >
            {todo.text}
          </label>
          {dueLabel && !todo.done && (
            <span
              className={`text-xs ${
                overdue ? "text-[#9a1a27] dark:text-[#e06b78] font-medium" : "text-muted-foreground"
              }`}
            >
              {dueLabel}
            </span>
          )}
        </div>

        {!todo.done && (
          <Select
            value={String(todo.priority)}
            onValueChange={(v) => handlePriorityChange(todo.id, Number(v))}
          >
            <SelectTrigger
              size="sm"
              aria-label="Priority"
              title={PRIORITY_LABELS[todo.priority]}
              className={`h-auto w-auto border-0 bg-transparent px-1 py-0 text-xs shadow-none gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                PRIORITY_COLORS[todo.priority] ?? ""
              }`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">High</SelectItem>
              <SelectItem value="2">Med</SelectItem>
              <SelectItem value="3">Low</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Button
          variant="ghost"
          size="icon"
          disabled={pendingTodoIds.has(todo.id)}
          className="h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-destructive"
          onClick={() => handleDelete(todo.id)}
          aria-label={`Delete to-do: ${todo.text}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </li>
    );
  }

  const activeTodos = todos.filter((todo) => !todo.done || recentlyCompletedIds.has(todo.id));
  const completedTodos = todos.filter((todo) => todo.done && !recentlyCompletedIds.has(todo.id));

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Input row */}
      <div className="flex gap-2 shrink-0">
        <Input
          placeholder="Add a task..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="h-8 text-sm"
        />
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 px-2 ${showOptions ? "bg-muted" : ""}`}
          onClick={() => setShowOptions((v) => !v)}
          aria-label="More options"
          type="button"
        >
          <Flag className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="h-8 px-2"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Expanded options */}
      {showOptions && (
        <div className="flex gap-2 items-center flex-wrap shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Due:</span>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-7 text-xs w-36"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Priority:</span>
            <Select value={String(priority)} onValueChange={(v) => setPriority(Number(v))}>
              <SelectTrigger size="sm" className="h-7 w-auto text-xs gap-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">High</SelectItem>
                <SelectItem value="2">Medium</SelectItem>
                <SelectItem value="3">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2 shrink-0">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-full rounded" />
          ))}
        </div>
      ) : todos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4 shrink-0">
          No tasks yet. Add one above!
        </p>
      ) : activeTodos.length ? (
        <ul className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
          {activeTodos.map(renderTodo)}
        </ul>
      ) : null}

      {completedTodos.length > 0 && (
        <section aria-label="Completed tasks" className="shrink-0 max-h-32 overflow-y-auto">
          <button
            type="button"
            aria-expanded={showCompleted}
            onClick={() => setShowCompleted((current) => !current)}
            className="w-full text-left text-xs text-muted-foreground hover:text-foreground"
          >
            {showCompleted ? "▾" : "▸"} Completed ({completedTodos.length})
          </button>
          {showCompleted && (
            <ul className="flex flex-col gap-1.5 mt-2">
              {completedTodos.map(renderTodo)}
            </ul>
          )}
        </section>
      )}

      {todos.length > 0 && (
        <p className="text-xs text-muted-foreground shrink-0">
          {todos.filter((t) => t.done).length}/{todos.length} completed
        </p>
      )}
    </div>
  );
}

function sortTodos(todos: TodoItem[]): TodoItem[] {
  return [...todos].sort((a, b) => {
    // Done items go to the bottom
    if (a.done !== b.done) return a.done ? 1 : -1;
    // Sort by due date ascending, nulls last
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    }
    // Then by priority ascending (1=high first)
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.created_at < b.created_at ? -1 : 1;
  });
}
