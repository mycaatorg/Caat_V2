"use client";

import { useState, useEffect, useRef } from "react";
import {
  Upload,
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
  Trash2,
  RefreshCw,
  Eye,
  CloudUpload,
  Loader2,
  FileArchive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  reuploadDocument,
  updateDocumentStatus,
  getDocumentSignedUrl,
  DocumentRow,
  DocCategory,
} from "./api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TABS = [
  "All Files",
  "Academic Transcripts",
  "Passport & ID",
  "Language Proficiency",
  "Recommendation Letters",
] as const;

type Tab = (typeof TABS)[number];

const TAB_CATEGORY_MAP: Partial<Record<Tab, string>> = {
  "Academic Transcripts": "transcripts",
  "Passport & ID": "identity",
  "Language Proficiency": "language",
  "Recommendation Letters": "letters",
};

const CATEGORY_OPTIONS: { value: DocCategory; label: string }[] = [
  { value: "transcripts", label: "Academic Transcripts" },
  { value: "identity", label: "Passport & ID" },
  { value: "language", label: "Language Proficiency" },
  { value: "letters", label: "Recommendation Letters" },
];

const CATEGORY_LABELS: Record<string, string> = {
  transcripts: "Transcripts",
  identity: "Identity",
  language: "Language",
  letters: "Letters",
};

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png";
const MAX_FILE_SIZE_MB = 10;
const PAGE_SIZE = 8;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mapStatus(status: string): "Verified" | "In Review" | "Resubmit" {
  if (status === "verified") return "Verified";
  if (status === "resubmit") return "Resubmit";
  return "In Review";
}

function getFileExt(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function StatCard({
  label,
  count,
  icon,
  barColor,
  total,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  barColor: string;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between mb-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="text-4xl font-bold tracking-tight mb-4">
        {String(count).padStart(2, "0")}
      </p>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function FileIcon({ fileName, status }: { fileName: string; status: string }) {
  const ext = getFileExt(fileName);
  const isError = status === "resubmit";
  if (ext === "jpg" || ext === "jpeg" || ext === "png") {
    return (
      <ImageIcon
        className={cn(
          "h-5 w-5 shrink-0",
          isError ? "text-red-500" : "text-blue-500"
        )}
      />
    );
  }
  if (ext === "pdf") {
    return (
      <FileText
        className={cn(
          "h-5 w-5 shrink-0",
          isError ? "text-red-500" : "text-blue-500"
        )}
      />
    );
  }
  return (
    <FileArchive
      className={cn(
        "h-5 w-5 shrink-0",
        isError ? "text-red-500" : "text-muted-foreground"
      )}
    />
  );
}

const STATUS_OPTIONS = [
  {
    value: "verified",
    label: "Verified",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  },
  {
    value: "pending_review",
    label: "In Review",
    icon: <Clock className="h-3.5 w-3.5 text-amber-400" />,
  },
  {
    value: "resubmit",
    label: "Resubmit",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
  },
] as const;

function StatusBadge({
  status,
  onStatusChange,
}: {
  status: string;
  onStatusChange: (newStatus: string) => void;
}) {
  const mapped = mapStatus(status);

  let badge: React.ReactNode;
  if (mapped === "Verified") {
    badge = (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        Verified
      </span>
    );
  } else if (mapped === "In Review") {
    badge = (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-500">
        <Clock className="h-4 w-4" />
        In Review
      </span>
    );
  } else {
    badge = (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500">
        <AlertTriangle className="h-4 w-4" />
        Resubmit
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded px-1 text-left hover:bg-muted transition-colors focus:outline-none">
          {badge}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Set status
        </p>
        <DropdownMenuSeparator />
        {STATUS_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            className="gap-2"
            disabled={status === opt.value}
            onClick={() => onStatusChange(opt.value)}
          >
            {opt.icon}
            {opt.label}
            {status === opt.value && (
              <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CategoryPill({ label }: { label: string }) {
  return (
    <span className="inline-block max-w-full truncate rounded-md border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------
function DeleteModal({
  doc,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  doc: DocumentRow;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl border p-6 shadow-xl w-[90%] max-w-md">
        <h3 className="font-semibold text-lg mb-1">Delete Document</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Are you sure you want to delete{" "}
          <span className="font-medium text-foreground">{doc.file_name}</span>?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File drop zone
// ---------------------------------------------------------------------------
function FileDropZone({
  file,
  onFileChange,
  inputRef,
}: {
  file: File | null;
  onFileChange: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSet(dropped);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) validateAndSet(selected);
  }

  function validateAndSet(f: File) {
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File must be under ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    const ext = getFileExt(f.name);
    if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      toast.error("Only PDF, JPG, and PNG files are accepted");
      return;
    }
    onFileChange(f);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors",
        dragOver
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
          : "border-muted-foreground/25 hover:border-blue-400 hover:bg-muted/30"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        onChange={handleChange}
      />
      {file ? (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground truncate max-w-[240px]">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatFileSize(file.size)} · Click to change
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <CloudUpload className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Drop file here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              PDF, JPG, or PNG · Max {MAX_FILE_SIZE_MB}MB
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function DocumentVaultClient() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("All Files");
  const [page, setPage] = useState(1);

  // Sheet (upload / re-upload)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reuploadTarget, setReuploadTarget] = useState<DocumentRow | null>(null);
  const [uploadCategory, setUploadCategory] = useState<DocCategory>("transcripts");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [isReuploading, setIsReuploading] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reuploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocs();
  }, []);

  async function loadDocs() {
    try {
      setLoading(true);
      const data = await fetchDocuments();
      setDocs(data);
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  function openUploadSheet() {
    setReuploadTarget(null);
    setUploadFile(null);
    setUploadCategory("transcripts");
    setSheetOpen(true);
  }

  function openReuploadSheet(doc: DocumentRow) {
    setReuploadTarget(doc);
    setReuploadFile(null);
    setSheetOpen(true);
  }

  function handleSheetOpenChange(open: boolean) {
    if (!open && (isUploading || isReuploading)) return;
    setSheetOpen(open);
    if (!open) {
      setUploadFile(null);
      setReuploadFile(null);
      setReuploadTarget(null);
    }
  }

  async function handleUpload() {
    if (!uploadFile) {
      toast.error("Please select a file");
      return;
    }
    try {
      setIsUploading(true);
      const newDoc = await uploadDocument(uploadFile, uploadCategory);
      setDocs((prev) => [newDoc, ...prev]);
      setSheetOpen(false);
      setUploadFile(null);
      toast.success("Document uploaded successfully");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Upload failed"
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleReupload() {
    if (!reuploadFile || !reuploadTarget) {
      toast.error("Please select a file");
      return;
    }
    try {
      setIsReuploading(true);
      const updated = await reuploadDocument(reuploadTarget, reuploadFile);
      setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setSheetOpen(false);
      setReuploadFile(null);
      setReuploadTarget(null);
      toast.success("Document replaced successfully");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Re-upload failed"
      );
    } finally {
      setIsReuploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await deleteDocument(deleteTarget);
      setDocs((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Document deleted");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Delete failed"
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleView(doc: DocumentRow) {
    try {
      const url = await getDocumentSignedUrl(doc.storage_path);
      window.open(url, "_blank");
    } catch {
      toast.error("Could not open document");
    }
  }

  async function handleStatusChange(doc: DocumentRow, newStatus: string) {
    try {
      const updated = await updateDocumentStatus(doc.id, newStatus);
      setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      toast.success("Status updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  // Filtering & pagination
  const filteredDocs =
    activeTab === "All Files"
      ? docs
      : docs.filter((d) => d.category === TAB_CATEGORY_MAP[activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedDocs = filteredDocs.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Stats
  const total = docs.length;
  const verified = docs.filter((d) => d.status === "verified").length;
  const pending = docs.filter((d) => d.status === "pending_review").length;
  const actionReq = docs.filter((d) => d.status === "resubmit").length;

  const isReupload = reuploadTarget !== null;

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
        <Button
          onClick={openUploadSheet}
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
        >
          <Upload className="h-4 w-4" />
          Upload New
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Stats cards                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Verified"
          count={verified}
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
          barColor="bg-green-500"
          total={total}
        />
        <StatCard
          label="Pending Review"
          count={pending}
          icon={<Clock className="h-5 w-5 text-amber-400" />}
          barColor="bg-amber-400"
          total={total}
        />
        <StatCard
          label="Action Required"
          count={actionReq}
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          barColor="bg-red-500"
          total={total}
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
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
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
        <div className="overflow-x-auto">
        <div className="min-w-[640px]">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.6fr)] px-5 py-3 border-b">
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

        {/* Loading skeleton */}
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.6fr)] items-center px-5 py-4",
                i < 3 && "border-b"
              )}
            >
              {Array.from({ length: 5 }).map((__, j) => (
                <div
                  key={j}
                  className="h-4 rounded bg-muted animate-pulse"
                  style={{ width: j === 0 ? "70%" : j === 4 ? "40%" : "60%" }}
                />
              ))}
            </div>
          ))
        ) : pagedDocs.length > 0 ? (
          pagedDocs.map((doc, idx) => (
            <div
              key={doc.id}
              className={cn(
                "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.6fr)] items-center px-5 py-3.5",
                idx < pagedDocs.length - 1 && "border-b"
              )}
            >
              {/* Name */}
              <div className="flex items-center gap-2.5 overflow-hidden pr-3">
                <FileIcon fileName={doc.file_name} status={doc.status} />
                <div className="overflow-hidden">
                  <span className="text-sm font-medium truncate block">
                    {doc.file_name}
                  </span>
                  {doc.file_size && (
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)}
                    </span>
                  )}
                  {doc.review_notes && (
                    <span className="mt-0.5 block text-xs text-amber-600 dark:text-amber-400 truncate" title={doc.review_notes}>
                      Note: {doc.review_notes}
                    </span>
                  )}
                </div>
              </div>

              {/* Category */}
              <div className="overflow-hidden pr-2">
                <CategoryPill
                  label={CATEGORY_LABELS[doc.category] ?? doc.category}
                />
              </div>

              {/* Status */}
              <StatusBadge
                status={doc.status}
                onStatusChange={(newStatus) => handleStatusChange(doc, newStatus)}
              />

              {/* Date */}
              <span className="text-sm text-muted-foreground">
                {formatDate(doc.uploaded_at)}
              </span>

              {/* Action */}
              <div className="flex justify-end">
                {doc.status === "resubmit" ? (
                  <Button
                    size="sm"
                    onClick={() => openReuploadSheet(doc)}
                    className="bg-rose-100 text-rose-600 hover:bg-rose-200 border-rose-200 shadow-none text-xs font-semibold h-7"
                    variant="outline"
                  >
                    Fix Now
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted text-muted-foreground"
                        aria-label="More options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => handleView(doc)}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => openReuploadSheet(doc)}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Re-upload
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                        onClick={() => setDeleteTarget(doc)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {activeTab === "All Files"
                ? "No documents uploaded yet."
                : "No documents in this category."}
            </p>
            {activeTab === "All Files" && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 gap-1.5"
                onClick={openUploadSheet}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload your first document
              </Button>
            )}
          </div>
        )}

        </div>{/* end min-w wrapper */}
        </div>{/* end overflow-x-auto */}

        {/* Table footer */}
        <div className="flex items-center justify-between border-t px-5 py-3">
          <span className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `Showing ${pagedDocs.length} of ${filteredDocs.length} document${filteredDocs.length !== 1 ? "s" : ""}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground px-1">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex h-7 w-7 items-center justify-center rounded border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom info cards                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <li
                key={item}
                className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-300"
              >
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            <h3 className="font-semibold">Need Assistance?</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            If you are having trouble uploading your documents or have questions
            about specific requirements, our admissions team is here to help.
          </p>
          <a
            href="mailto:support@caat.app?subject=Document%20Upload%20Help"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline underline-offset-4"
          >
            Contact Support Team
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Upload / Re-upload Sheet                                            */}
      {/* ------------------------------------------------------------------ */}
      <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="right" className="sm:max-w-md w-full">
          <SheetHeader className="pb-2">
            <SheetTitle>
              {isReupload ? "Replace Document" : "Upload Document"}
            </SheetTitle>
            <SheetDescription>
              {isReupload
                ? `Replacing: ${reuploadTarget?.file_name}`
                : "Add a new document to your vault."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 px-4 flex-1 overflow-y-auto">
            {/* Category selector (only for new upload) */}
            {!isReupload && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) =>
                    setUploadCategory(e.target.value as DocCategory)
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category display (re-upload, locked) */}
            {isReupload && reuploadTarget && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Category</label>
                <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {CATEGORY_LABELS[reuploadTarget.category] ??
                    reuploadTarget.category}
                </div>
              </div>
            )}

            {/* File drop zone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">File</label>
              {isReupload ? (
                <FileDropZone
                  file={reuploadFile}
                  onFileChange={setReuploadFile}
                  inputRef={reuploadInputRef}
                />
              ) : (
                <FileDropZone
                  file={uploadFile}
                  onFileChange={setUploadFile}
                  inputRef={fileInputRef}
                />
              )}
            </div>
          </div>

          <SheetFooter className="pt-4">
            <SheetClose asChild>
              <Button
                variant="outline"
                disabled={isUploading || isReuploading}
                className="flex-1"
              >
                Cancel
              </Button>
            </SheetClose>
            <Button
              onClick={isReupload ? handleReupload : handleUpload}
              disabled={
                isReupload
                  ? isReuploading || !reuploadFile
                  : isUploading || !uploadFile
              }
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {(isUploading || isReuploading) && (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              )}
              {isReupload ? "Replace" : "Upload"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ------------------------------------------------------------------ */}
      {/* Delete confirmation modal                                           */}
      {/* ------------------------------------------------------------------ */}
      {deleteTarget && (
        <DeleteModal
          doc={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
