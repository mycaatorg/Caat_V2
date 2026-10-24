"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Download, Trash2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAccount } from "./actions";

const CONFIRM_WORD = "DELETE";

export function DataAccountSection() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, startDelete] = useTransition();

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/settings/export");
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `caat-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Your data export has downloaded.");
    } catch {
      toast.error("Could not export your data. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteMyAccount();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Your account has been deleted.");
      setOpen(false);
      // The auth user and session are gone; send them to the landing page.
      router.replace("/");
      router.refresh();
    });
  }

  const canConfirm = confirmText.trim() === CONFIRM_WORD && !isDeleting;

  return (
    <section
      aria-labelledby="data-account-heading"
      className="rounded-lg border bg-card p-6"
    >
      <h2 id="data-account-heading" className="text-lg font-semibold">
        Data and account
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your data belongs to you. Export a copy at any time, or permanently
        delete your account.
      </p>

      <div className="mt-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Export my data</p>
            <p className="text-sm text-muted-foreground">
              Download your profile, saved opportunities, workspace records and
              community activity as JSON. Includes document details, but not
              uploaded files, login secrets or moderation reports.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
            className="sm:w-auto"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {exporting ? "Preparing…" : "Export my data"}
          </Button>
        </div>

        <div className="border-t pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-destructive">
                Delete my account
              </p>
              <p className="text-sm text-muted-foreground">
                Permanently deletes your account and all data tied to it. This
                cannot be undone.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmText("");
                setOpen(true);
              }}
              className="sm:w-auto"
            >
              <Trash2 className="size-4" />
              Delete my account
            </Button>
          </div>
        </div>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg focus:outline-none">
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className="text-lg font-semibold">
                Delete your account?
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              This permanently deletes your profile, applications, essays,
              documents, resumes, scholarships, and community activity. This
              action cannot be undone.
            </Dialog.Description>

            <div className="mt-4 space-y-2">
              <Label htmlFor="confirm-delete">
                Type <span className="font-semibold">{CONFIRM_WORD}</span> to
                confirm
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                placeholder={CONFIRM_WORD}
                disabled={isDeleting}
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={isDeleting}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={!canConfirm}
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {isDeleting ? "Deleting…" : "Delete my account"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
