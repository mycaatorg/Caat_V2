export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mapStatus(status: string): "Verified" | "In Review" | "Resubmit" {
  if (status === "verified") return "Verified";
  if (status === "resubmit") return "Resubmit";
  return "In Review";
}

export function getFileExt(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function sanitizeFileName(name: string): string {
  return name.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "_");
}
