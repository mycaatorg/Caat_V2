"use client";

import dynamic from "next/dynamic";

const EssaysShell = dynamic(
  () => import("@/components/essays/EssaysShell"),
  { ssr: false }
);

export default function EssaysClient() {
  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <EssaysShell />
      </div>
    </div>
  );
}
