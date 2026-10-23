"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, MapPin, Wifi, Clock, CalendarDays, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { getClientUserId } from "@/lib/current-user";
import { toast } from "sonner";
import { toDateKey, formatTime } from "@/lib/calendar-utils";
import {
  CUSTOM_SOURCE_PILL,
  fetchUnifiedDeadlines,
  type UnifiedDeadline,
} from "@/lib/unified-deadlines";

interface CalendarEvent {
  id: string;
  title: string;
  event_date: string;
  description: string | null;
  time_start: string | null;
  time_end: string | null;
  location: string | null;
  is_online: boolean;
}

interface EventForm {
  title: string;
  // The event's own date (B15). Editing keeps this so changing only the title
  // never moves the event onto whatever day the calendar happens to have
  // selected. Empty for a new event, which falls back to the selected day.
  event_date: string;
  description: string;
  time_start: string;
  time_end: string;
  location: string;
  is_online: boolean;
}

const EMPTY_FORM: EventForm = {
  title: "",
  event_date: "",
  description: "",
  time_start: "",
  time_end: "",
  location: "",
  is_online: false,
};


function eventToForm(ev: CalendarEvent): EventForm {
  return {
    title: ev.title,
    event_date: ev.event_date,
    description: ev.description ?? "",
    time_start: ev.time_start ?? "",
    time_end: ev.time_end ?? "",
    location: ev.location ?? "",
    is_online: ev.is_online,
  };
}

export function CalendarWidget() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [deadlines, setDeadlines] = useState<UnifiedDeadline[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const userId = await getClientUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from("calendar_events")
        .select(
          "id, title, event_date, description, time_start, time_end, location, is_online"
        )
        .eq("user_id", userId)
        .order("time_start", { ascending: true, nullsFirst: true });

      if (error) {
        toast.error("Could not load calendar events.");
      } else {
        setEvents((data ?? []) as CalendarEvent[]);
      }

      // Pull app + scholarship deadlines for overlay dots.
      // Events come from calendar_events natively above — exclude them here
      // to avoid double-rendering.
      try {
        const all = await fetchUnifiedDeadlines(supabase, userId);
        setDeadlines(all.filter((d) => d.source !== "event"));
      } catch {
        // non-critical
      }
    }

    load();
  }, []);

  // Build a per-date map of which deadline sources have an entry.
  // app + scholarship from `deadlines`, event from `events`.
  const dateSources = useMemo(() => {
    const map = new Map<string, { app: boolean; scholarship: boolean; event: boolean }>();
    function ensure(key: string) {
      let entry = map.get(key);
      if (!entry) {
        entry = { app: false, scholarship: false, event: false };
        map.set(key, entry);
      }
      return entry;
    }
    for (const d of deadlines) {
      const e = ensure(d.dateISO);
      if (d.source === "app") e.app = true;
      if (d.source === "scholarship" || d.source === "custom") e.scholarship = true;
    }
    for (const ev of events) {
      ensure(ev.event_date).event = true;
    }
    return map;
  }, [deadlines, events]);

  const selectedKey = date ? toDateKey(date) : null;
  const eventsForDay = events.filter((e) => e.event_date === selectedKey);
  const deadlinesForDay = deadlines.filter((d) => d.dateISO === selectedKey);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(ev: CalendarEvent) {
    setEditingId(ev.id);
    setForm(eventToForm(ev));
    setFormOpen(true);
  }

  function cancelForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  async function handleSaveEvent() {
    if (!form.title.trim() || !date) return;
    setSaving(true);

    const userId = await getClientUserId();
    if (!userId) {
      toast.error("Not authenticated.");
      setSaving(false);
      return;
    }

    const payload = {
      title: form.title.trim(),
      // B15 — an edit keeps the event's own date; only a new event uses the
      // currently selected calendar day.
      event_date: editingId ? form.event_date : toDateKey(date),
      description: form.description.trim() || null,
      time_start: form.time_start || null,
      time_end: form.time_end || null,
      location: form.is_online ? null : form.location.trim() || null,
      is_online: form.is_online,
    };

    if (editingId) {
      const { data, error } = await supabase
        .from("calendar_events")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", userId)
        .select(
          "id, title, event_date, description, time_start, time_end, location, is_online"
        )
        .single();

      if (error || !data) {
        toast.error("Could not update event.");
      } else {
        setEvents((prev) =>
          prev.map((e) => (e.id === editingId ? (data as CalendarEvent) : e))
        );
        cancelForm();
      }
    } else {
      const { data, error } = await supabase
        .from("calendar_events")
        .insert({ user_id: userId, ...payload })
        .select(
          "id, title, event_date, description, time_start, time_end, location, is_online"
        )
        .single();

      if (error || !data) {
        toast.error("Could not save event.");
      } else {
        setEvents((prev) => [...prev, data as CalendarEvent]);
        cancelForm();
      }
    }
    setSaving(false);
  }

  async function handleDeleteEvent(id: string) {
    const userId = await getClientUserId();
    if (!userId) return;

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      toast.error("Could not delete event.");
    } else {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      if (editingId === id) cancelForm();
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Left: calendar + form */}
      <div className="flex flex-col gap-3 shrink-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          className="rounded-md p-0"
          components={{
            DayButton: (dayButtonProps) => {
              const dayKey = toDateKey(dayButtonProps.day.date);
              const src = dateSources.get(dayKey);
              return (
                <span className="relative inline-flex w-full h-full">
                  <CalendarDayButton {...dayButtonProps} />
                  {src && (src.app || src.scholarship || src.event) && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5"
                    >
                      {src.app && (
                        <span className="h-1 w-1 rounded-full bg-blue-600" />
                      )}
                      {src.scholarship && (
                        <span className="h-1 w-1 rounded-full bg-purple-600" />
                      )}
                      {src.event && (
                        <span className="h-1 w-1 rounded-full bg-green-600" />
                      )}
                    </span>
                  )}
                </span>
              );
            },
          }}
        />
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground px-1">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />App
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />Schol
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600" />Event
          </span>
        </div>

        {!formOpen ? (
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add event
          </button>
        ) : (
          <div className="space-y-2.5 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {editingId ? "Edit event" : "New event"}
            </p>

            <div className="space-y-1">
              <Label className="text-xs">Event name</Label>
              <Input
                autoFocus
                placeholder="e.g. SAT Exam"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEvent();
                  if (e.key === "Escape") cancelForm();
                }}
                className="h-7 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="Optional notes..."
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="text-xs resize-none min-h-[52px]"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">From</Label>
                <Input
                  type="time"
                  value={form.time_start}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, time_start: e.target.value }))
                  }
                  className="h-7 text-xs"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">To</Label>
                <Input
                  type="time"
                  value={form.time_end}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, time_end: e.target.value }))
                  }
                  className="h-7 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cal-is-online"
                  checked={form.is_online}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, is_online: v === true }))
                  }
                />
                <Label htmlFor="cal-is-online" className="text-xs cursor-pointer">
                  Online
                </Label>
              </div>
              {!form.is_online && (
                <Input
                  placeholder="Location"
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location: e.target.value }))
                  }
                  className="h-7 text-xs"
                />
              )}
            </div>

            <div className="flex gap-2 pt-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={cancelForm}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={handleSaveEvent}
                disabled={saving || !form.title.trim()}
              >
                {saving ? "Saving..." : editingId ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Divider — vertical on wide, horizontal when stacked */}
      <div className="h-px w-full sm:h-auto sm:w-px bg-border shrink-0" />

      {/* Right: events panel */}
      <div className="flex-1 flex flex-col gap-2 min-w-0 overflow-hidden">
        <p className="text-xs font-medium text-muted-foreground">
          {date
            ? date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : "Select a date"}
        </p>

        {eventsForDay.length === 0 && deadlinesForDay.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-10 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">Nothing on this date</p>
            <p className="text-xs text-muted-foreground/50">
              Click &quot;Add event&quot; to add one
            </p>
          </div>
        ) : (
          <>
          {deadlinesForDay.length > 0 && (
            <ul className="space-y-2 mb-2">
              {deadlinesForDay.map((d) => (
                <li key={d.id} className="rounded-lg border bg-card p-3 text-xs">
                  <Link href={d.href} className="font-medium hover:underline">
                    {d.title}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {d.source === "custom" && (
                      <>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          <span aria-hidden="true">{CUSTOM_SOURCE_PILL.visible}</span>
                          <span className="sr-only">{CUSTOM_SOURCE_PILL.spoken}</span>
                        </span>{" "}
                      </>
                    )}
                    {d.source === "app" ? "Application deadline" : "Scholarship deadline"}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <ul className="space-y-2 overflow-y-auto">
            {eventsForDay.map((ev) => (
              <li
                key={ev.id}
                className="rounded-lg border bg-card p-3 space-y-1.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium leading-tight">{ev.title}</span>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <button
                      type="button"
                      onClick={() => openEdit(ev)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Edit event"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Delete event"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {ev.description && (
                  <p className="text-muted-foreground leading-snug">
                    {ev.description}
                  </p>
                )}

                {(ev.time_start || ev.time_end) && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>
                      {formatTime(ev.time_start) ?? "-"}
                      {ev.time_end ? ` → ${formatTime(ev.time_end)}` : ""}
                    </span>
                  </div>
                )}

                {ev.is_online ? (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Wifi className="h-3 w-3 shrink-0" />
                    <span>Online</span>
                  </div>
                ) : ev.location ? (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{ev.location}</span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          </>
        )}
      </div>
    </div>
  );
}
