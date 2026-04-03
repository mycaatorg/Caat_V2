"use client";

import React from "react";
import { Input } from "@/components/ui/input";

export default function PersonalInfoGuided({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  function setField(key: string, v: string) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="rounded-md border bg-white p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">FULL NAME</div>
          <Input
            value={(value.fullName as string) ?? ""}
            onChange={(e) => setField("fullName", e.target.value)}
            placeholder="John Doe"
          />
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">EMAIL</div>
          <Input
            value={(value.email as string) ?? ""}
            onChange={(e) => setField("email", e.target.value)}
            placeholder="john@example.com"
          />
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">PHONE</div>
          <Input
            value={(value.phone as string) ?? ""}
            onChange={(e) => setField("phone", e.target.value)}
            placeholder="+1 234 567 890"
          />
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">WEBSITE / LINKEDIN</div>
          <Input
            value={(value.linkedin as string) ?? ""}
            onChange={(e) => setField("linkedin", e.target.value)}
            placeholder="linkedin.com/in/..."
          />
        </div>

        <div className="col-span-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">LOCATION</div>
          <Input
            value={(value.location as string) ?? ""}
            onChange={(e) => setField("location", e.target.value)}
            placeholder="Sydney, Australia"
          />
        </div>
      </div>
    </div>
  );
}
