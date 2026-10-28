"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeadlineCalendarDownload() {
  const descriptionId = useId();
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => () => active.current?.abort(), []);

  async function download() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/today/calendar", {cache:"no-store", signal:controller.signal});
      if (controller.signal.aborted) return;
      if (response.status === 204) {
        setNotice("No upcoming application or scholarship deadlines. Add a due date to get started.");
        return;
      }
      if (!response.ok || !response.headers.get("content-type")?.includes("text/calendar")) throw new Error("Calendar unavailable");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "caat-deadlines.ics";
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Calendar file downloaded. Import it into your calendar to use these dates.");
    } catch {
      if (!controller.signal.aborted) setError("Could not prepare your calendar. Please try again.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (active.current === controller) active.current = null;
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <Button type="button" variant="outline" size="sm" className="rounded-none gap-2" onClick={download} disabled={busy} aria-describedby={descriptionId}>
        <Download className="size-4" aria-hidden="true" />
        {busy ? "Preparing calendar…" : "Download deadline calendar"}
      </Button>
      <p id={descriptionId} className="text-xs text-muted-foreground max-w-prose">
        All upcoming application and scholarship due dates, as all-day events. A snapshot only—changes won’t sync. Check official closing times; importing again may create duplicates.
      </p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <p role="status" className="text-sm text-muted-foreground">{notice}</p>
    </div>
  );
}
