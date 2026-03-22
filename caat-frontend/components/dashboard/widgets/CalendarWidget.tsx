"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";

export function CalendarWidget() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="flex flex-col items-center gap-2">
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        className="rounded-md"
      />
      {date && (
        <p className="text-xs text-muted-foreground">
          Selected: {date.toLocaleDateString(undefined, { dateStyle: "long" })}
        </p>
      )}
    </div>
  );
}
