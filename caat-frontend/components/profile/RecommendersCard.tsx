"use client";

import React, { useEffect, useState } from "react";
import { Users, Trash2, Pencil, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { RecommenderRow, RecommenderStatus } from "@/types/profile";
import {
  fetchRecommenders,
  addRecommender,
  updateRecommender,
  deleteRecommender,
} from "@/app/(main)/profile/recommenders-api";

const STATUS_CONFIG: Record<
  RecommenderStatus,
  { label: string; className: string }
> = {
  requested: {
    label: "Requested",
    className:
      "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  confirmed: {
    label: "Confirmed",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  submitted: {
    label: "Submitted",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
};

const EMPTY_DRAFT = { name: "", subject: "", status: "requested" as RecommenderStatus, notes: "" };

export function RecommendersCard() {
  const [rows, setRows] = useState<RecommenderRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [isAdding, setIsAdding] = useState(false);
  const [addDraft, setAddDraft] = useState(EMPTY_DRAFT);
  const [addSaving, setAddSaving] = useState(false);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(EMPTY_DRAFT);
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommenders()
      .then(setRows)
      .catch(() => toast.error("Failed to load recommenders."))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!addDraft.name.trim()) return;
    setAddSaving(true);
    try {
      const row = await addRecommender({
        name: addDraft.name.trim(),
        subject: addDraft.subject.trim() || undefined,
        status: addDraft.status,
        notes: addDraft.notes.trim() || undefined,
      });
      setRows((prev) => [...prev, row]);
      setAddDraft(EMPTY_DRAFT);
      setIsAdding(false);
      toast.success("Recommender added.");
    } catch {
      toast.error("Failed to add recommender.");
    } finally {
      setAddSaving(false);
    }
  }

  function startEdit(row: RecommenderRow) {
    setEditingId(row.id);
    setEditDraft({
      name: row.name,
      subject: row.subject ?? "",
      status: row.status,
      notes: row.notes ?? "",
    });
  }

  async function handleEdit() {
    if (!editingId || !editDraft.name.trim()) return;
    setEditSaving(true);
    try {
      await updateRecommender(editingId, {
        name: editDraft.name.trim(),
        subject: editDraft.subject.trim() || undefined,
        status: editDraft.status,
        notes: editDraft.notes.trim() || undefined,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                name: editDraft.name.trim(),
                subject: editDraft.subject.trim() || null,
                status: editDraft.status,
                notes: editDraft.notes.trim() || null,
              }
            : r
        )
      );
      setEditingId(null);
      toast.success("Recommender updated.");
    } catch {
      toast.error("Failed to update recommender.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteRecommender(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Recommender removed.");
    } catch {
      toast.error("Failed to remove recommender.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" />
          Recommenders
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground py-2">Loading…</p>
        ) : (
          <>
            {rows.length === 0 && !isAdding && (
              <p className="text-sm text-muted-foreground py-2">
                No recommenders added yet.
              </p>
            )}

            {/* Existing rows */}
            {rows.map((row) =>
              editingId === row.id ? (
                <RecommenderForm
                  key={row.id}
                  draft={editDraft}
                  onChange={setEditDraft}
                  onSave={handleEdit}
                  onCancel={() => setEditingId(null)}
                  saving={editSaving}
                />
              ) : (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{row.name}</p>
                      {row.subject && (
                        <p className="text-xs text-muted-foreground truncate">
                          {row.subject}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CONFIG[row.status].className}`}
                    >
                      {STATUS_CONFIG[row.status].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      aria-label="Edit recommender"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      disabled={deletingId === row.id}
                      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50"
                      aria-label="Remove recommender"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Add form */}
            {isAdding && (
              <RecommenderForm
                draft={addDraft}
                onChange={setAddDraft}
                onSave={handleAdd}
                onCancel={() => {
                  setIsAdding(false);
                  setAddDraft(EMPTY_DRAFT);
                }}
                saving={addSaving}
              />
            )}

            {!isAdding && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full mt-1 border-dashed text-muted-foreground"
                onClick={() => setIsAdding(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Recommender
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecommenderForm({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  draft: typeof EMPTY_DRAFT;
  onChange: (d: typeof EMPTY_DRAFT) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
            Name *
          </label>
          <Input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="Dr. Smith"
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
            Subject / Class
          </label>
          <Input
            value={draft.subject}
            onChange={(e) => onChange({ ...draft, subject: e.target.value })}
            placeholder="Mathematics"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
            Status
          </label>
          <select
            value={draft.status}
            onChange={(e) =>
              onChange({ ...draft, status: e.target.value as RecommenderStatus })
            }
            className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="requested">Requested</option>
            <option value="confirmed">Confirmed</option>
            <option value="submitted">Submitted</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end pt-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
          className="h-7 w-7 p-0"
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving || !draft.name.trim()}
          className="h-7 text-xs px-2.5"
        >
          <Check className="h-3 w-3" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
