"use client";

import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, MapPin, Wifi, Clock, CalendarDays } from "lucide-react";
import { supabase } from "@/src/lib/supabaseClient";
import { toast } from "sonner";
import { toDateKey, formatTime } from "@/lib/calendar-utils";

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
  description: string;
  time_start: string;
  time_end: string;
  location: string;
  is_online: boolean;
}

const EMPTY_FORM: EventForm = {
  title: "",
  description: "",
  time_start: "",
  time_end: "",
  location: "",
  is_online: false,
};


export function CalendarWidget() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("calendar_events")
        .select(
          "id, title, event_date, description, time_start, time_end, location, is_online"
        )
        .eq("user_id", user.id)
        .order("time_start", { ascending: true, nullsFirst: true });

      if (error) {
        toast.error("Could not load calendar events.");
        return;
      }
      setEvents((data ?? []) as CalendarEvent[]);
    }

    load();
  }, []);

  const selectedKey = date ? toDateKey(date) : null;
  const eventsForDay = events.filter((e) => e.event_date === selectedKey);
  const datesWithEvents = new Set(events.map((e) => e.event_date));

  async function handleSaveEvent() {
    if (!form.title.trim() || !date) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated.");
      setSaving(false);
      return;
    }

    const payload = {
      user_id: user.id,
      title: form.title.trim(),
      event_date: toDateKey(date),
      description: form.description.trim() || null,
      time_start: form.time_start || null,
      time_end: form.time_end || null,
      location: form.is_online ? null : form.location.trim() || null,
      is_online: form.is_online,
    };

    const { data, error } = await supabase
      .from("calendar_events")
      .insert(payload)
      .select(
        "id, title, event_date, description, time_start, time_end, location, is_online"
      )
      .single();

    if (error || !data) {
      toast.error("Could not save event.");
    } else {
      setEvents((prev) => [...prev, data as CalendarEvent]);
      setForm(EMPTY_FORM);
      setFormOpen(false);
    }
    setSaving(false);
  }

  async function handleDeleteEvent(id: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Could not delete event.");
    } else {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }
  }

  return (
    <div className="flex gap-4">
      {/* Left: calendar + add-event form */}
      <div className="flex flex-col gap-3 shrink-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          className="rounded-md p-0"
          modifiers={{
            hasEvent: (d) => datesWithEvents.has(toDateKey(d)),
          }}
          modifiersClassNames={{
            hasEvent: "underline decoration-primary decoration-2",
          }}
        />

        {!formOpen ? (
          <button
            type="button"
            onClick={() => {
              setForm(EMPTY_FORM);
              setFormOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add event
          </button>
        ) : (
          <div className="space-y-2.5 rounded-lg border bg-muted/30 p-3">
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
                  if (e.key === "Escape") setFormOpen(false);
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
                <Label
                  htmlFor="cal-is-online"
                  className="text-xs cursor-pointer"
                >
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
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={handleSaveEvent}
                disabled={saving || !form.title.trim()}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px bg-border shrink-0" />

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

        {eventsForDay.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-10 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No events</p>
            <p className="text-xs text-muted-foreground/50">
              Click &quot;Add event&quot; to get started
            </p>
          </div>
        ) : (
          <ul className="space-y-2 overflow-y-auto">
            {eventsForDay.map((ev) => (
              <li
                key={ev.id}
                className="rounded-lg border bg-card p-3 space-y-1.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium leading-tight">{ev.title}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(ev.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5 transition-colors"
                    aria-label="Delete event"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
                      {formatTime(ev.time_start) ?? "—"}
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
        )}
      </div>
    </div>
  );
}
