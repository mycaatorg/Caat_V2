"use client";

import dynamic from "next/dynamic";

const ResumeBuilderShell = dynamic(
  () => import("@/components/resume-builder/ResumeBuilderShell"),
  { ssr: false }
);

export default function ResumeBuilderClient() {
  return <ResumeBuilderShell />;
}
