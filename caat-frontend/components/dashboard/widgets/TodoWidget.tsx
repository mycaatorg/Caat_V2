"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchTodos,
  addTodo,
  toggleTodo,
  deleteTodo,
  type TodoItem,
} from "../api";

export function TodoWidget() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

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
      const newTodo = await addTodo(text);
      setTodos((prev) => [...prev, newTodo]);
      setInput("");
    } catch {
      toast.error("Failed to add to-do");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(id: string, current: boolean) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !current } : t))
    );
    try {
      await toggleTodo(id, !current);
    } catch {
      // Revert optimistic update
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, done: current } : t))
      );
      toast.error("Failed to update to-do");
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          placeholder="Add a task..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="h-8 px-2"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-full rounded" />
          ))}
        </div>
      ) : todos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No tasks yet. Add one above!
        </p>
      ) : (
        <ScrollArea className="max-h-56">
          <ul className="flex flex-col gap-1.5 pr-2">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center gap-2 group rounded-md px-1 py-0.5 hover:bg-muted/50"
              >
                <Checkbox
                  id={`todo-${todo.id}`}
                  checked={todo.done}
                  onCheckedChange={() => handleToggle(todo.id, todo.done)}
                />
                <label
                  htmlFor={`todo-${todo.id}`}
                  className={`flex-1 text-sm cursor-pointer ${
                    todo.done ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {todo.text}
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(todo.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}

      {todos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {todos.filter((t) => t.done).length}/{todos.length} completed
        </p>
      )}
    </div>
  );
}
