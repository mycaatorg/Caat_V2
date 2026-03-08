"use client";

import { useState } from "react";
import {
  Upload,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Info,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types & placeholder data
// ---------------------------------------------------------------------------
type DocStatus = "Verified" | "In Review" | "Resubmit";
type DocCategory = "Transcripts" | "Identity" | "Language" | "Letters";
type FileType = "pdf" | "jpg" | "png";

interface DocItem {
  id: string;
  name: string;
  fileType: FileType;
  category: DocCategory;
  status: DocStatus;
  dateUploaded: string;
}

const MOCK_DOCS: DocItem[] = [
  {
    id: "1",
    name: "High_School_Transcript_Final.pdf",
    fileType: "pdf",
    category: "Transcripts",
    status: "Verified",
    dateUploaded: "Oct 12, 2023",
  },
  {
    id: "2",
    name: "Passport_Copy_Main_Page.jpg",
    fileType: "jpg",
    category: "Identity",
    status: "In Review",
    dateUploaded: "Nov 04, 2023",
  },
  {
    id: "3",
    name: "IELTS_Certificate_2023.pdf",
    fileType: "pdf",
    category: "Language",
    status: "Resubmit",
    dateUploaded: "Nov 01, 2023",
  },
  {
    id: "4",
    name: "Prof_Smith_Rec_Letter.pdf",
    fileType: "pdf",
    category: "Letters",
    status: "Verified",
    dateUploaded: "Oct 28, 2023",
  },
];

const TOTAL_DOCS = 11;

const TABS = [
  "All Files",
  "Academic Transcripts",
  "Passport & ID",
  "Language Proficiency",
  "Recommendation Letters",
] as const;

const TAB_CATEGORY_MAP: Partial<Record<(typeof TABS)[number], DocCategory>> = {
  "Academic Transcripts": "Transcripts",
  "Passport & ID": "Identity",
  "Language Proficiency": "Language",
  "Recommendation Letters": "Letters",
};

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------
function StatCard({
  label,
  count,
  icon,
  barColor,
  barWidth,
}: {
  label: string;
  count: string;
  icon: React.ReactNode;
  barColor: string;
  barWidth: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between mb-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="text-4xl font-bold tracking-tight mb-4">{count}</p>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barColor, barWidth)} />
      </div>
    </div>
  );
}

function FileIcon({ fileType, status }: { fileType: FileType; status: DocStatus }) {
  const isError = status === "Resubmit";
  if (fileType === "jpg" || fileType === "png") {
    return <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />;
  }
  return (
    <FileText
      className={cn("h-5 w-5 shrink-0", isError ? "text-red-500" : "text-blue-500")}
    />
  );
}

function StatusBadge({ status }: { status: DocStatus }) {
  if (status === "Verified") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        Verified
      </span>
    );
  }
  if (status === "In Review") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-500">
        <Clock className="h-4 w-4" />
        In Review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500">
      <AlertTriangle className="h-4 w-4" />
      Resubmit
    </span>
  );
}

function CategoryPill({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-md border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function DocumentVaultClient() {
  const [activeTab, setActiveTab] =
    useState<(typeof TABS)[number]>("All Files");

  const filteredDocs =
    activeTab === "All Files"
      ? MOCK_DOCS
      : MOCK_DOCS.filter((d) => d.category === TAB_CATEGORY_MAP[activeTab]);

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Vault</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and track your international application materials.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Upload className="h-4 w-4" />
            Upload New
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Stats cards                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Verified"
          count="08"
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
          barColor="bg-green-500"
          barWidth="w-[73%]"
        />
        <StatCard
          label="Pending Review"
          count="02"
          icon={<Clock className="h-5 w-5 text-amber-400" />}
          barColor="bg-amber-400"
          barWidth="w-[18%]"
        />
        <StatCard
          label="Action Required"
          count="01"
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          barColor="bg-red-500"
          barWidth="w-[9%]"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Filter tabs + document table                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border bg-card shadow-sm mb-6">

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "shrink-0 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                activeTab === tab
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1.2fr_0.6fr] px-5 py-3 border-b">
          {["DOCUMENT NAME", "CATEGORY", "STATUS", "DATE UPLOADED", "ACTION"].map(
            (col) => (
              <span
                key={col}
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {col}
              </span>
            )
          )}
        </div>

        {/* Rows */}
        {filteredDocs.length > 0 ? (
          filteredDocs.map((doc, idx) => (
            <div
              key={doc.id}
              className={cn(
                "grid grid-cols-[minmax(0,2fr)_1fr_1fr_1.2fr_0.6fr] items-center px-5 py-3.5",
                idx < filteredDocs.length - 1 && "border-b"
              )}
            >
              {/* Name — overflow-hidden on the cell keeps truncate working in a grid */}
              <div className="flex items-center gap-2.5 overflow-hidden pr-3">
                <FileIcon fileType={doc.fileType} status={doc.status} />
                <span className="text-sm font-medium truncate">{doc.name}</span>
              </div>

              {/* Category */}
              <CategoryPill label={doc.category} />

              {/* Status */}
              <StatusBadge status={doc.status} />

              {/* Date */}
              <span className="text-sm text-muted-foreground">
                {doc.dateUploaded}
              </span>

              {/* Action */}
              <div className="flex justify-end">
                {doc.status === "Resubmit" ? (
                  <Button
                    size="sm"
                    className="bg-rose-100 text-rose-600 hover:bg-rose-200 border-rose-200 shadow-none text-xs font-semibold h-7"
                    variant="outline"
                  >
                    Fix Now
                  </Button>
                ) : (
                  <button
                    className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted text-muted-foreground"
                    aria-label="More options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No documents in this category yet.
          </div>
        )}

        {/* Table footer */}
        <div className="flex items-center justify-between border-t px-5 py-3">
          <span className="text-sm text-muted-foreground">
            Showing {filteredDocs.length} of {TOTAL_DOCS} documents
          </span>
          <div className="flex items-center gap-1">
            <button className="inline-flex h-7 w-7 items-center justify-center rounded border hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="inline-flex h-7 w-7 items-center justify-center rounded border hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom info cards                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Upload Guidelines */}
        <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0" />
            <h3 className="font-semibold text-blue-700 dark:text-blue-400">
              Upload Guidelines
            </h3>
          </div>
          <ul className="space-y-2">
            {[
              "Files must be in PDF, JPG, or PNG format.",
              "Maximum file size is 10MB per document.",
              "Ensure all scanned documents are clear and legible.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-300">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Need Assistance */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            <h3 className="font-semibold">Need Assistance?</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            If you are having trouble uploading your documents or have questions
            about specific requirements, our admissions team is here to help.
          </p>
          <button className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline underline-offset-4">
            Contact Support Team
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
