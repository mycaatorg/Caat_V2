"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, ChevronRight, FileText, Lightbulb, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  fetchEssayPrompts,
  fetchDraftsForPrompt,
  updateDraft,
  createDraft,
  deleteDraft,
  type EssayPrompt,
  type EssayDraft,
} from "./api";
import { supabase } from "@/src/lib/supabaseClient";
import { cn } from "@/lib/utils";

/* ---------------------------
   Load prompts from DB on mount
---------------------------- */

export default function EssaysShell() {
  const [prompts, setPrompts] = useState<EssayPrompt[] | null>(null);
  const [promptsError, setPromptsError] = useState<string | null>(null);
  const [promptsLoading, setPromptsLoading] = useState(true);

  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<EssayDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [activeDraft, setActiveDraft] = useState<EssayDraft | null>(null);
  const [essayContent, setEssayContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [draftsPopoverOpen, setDraftsPopoverOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedPrompt = prompts?.find((p) => p.id === selectedPromptId);

  // Load prompts on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setPromptsLoading(true);
      setPromptsError(null);
      try {
        const data = await fetchEssayPrompts();
        if (!cancelled) {
          setPrompts(data);
          if (data.length > 0 && !selectedPromptId) setSelectedPromptId(data[0].id);
        }
      } catch (err) {
        if (!cancelled)
          setPromptsError(err instanceof Error ? err.message : "Failed to load prompts");
      } finally {
        if (!cancelled) setPromptsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // When selected prompt changes, load drafts for that prompt
  useEffect(() => {
    if (!selectedPromptId || !isAuthenticated) {
      setDrafts([]);
      setActiveDraft(null);
      setEssayContent("");
      return;
    }

    let cancelled = false;
    setDraftsLoading(true);

    fetchDraftsForPrompt(selectedPromptId)
      .then((list) => {
        if (cancelled) return;
        setDrafts(list);
        const current = list.find((d) => d.is_current) ?? list[0];
        setActiveDraft(current ?? null);
        setEssayContent(current?.content ?? "");
      })
      .catch(() => {
        if (!cancelled) {
          setDrafts([]);
          setActiveDraft(null);
          setEssayContent("");
        }
      })
      .finally(() => {
        if (!cancelled) setDraftsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPromptId, isAuthenticated]);

  // Track auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setIsAuthenticated(!!user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) =>
      setIsAuthenticated(!!session?.user)
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeDraft || saving) return;
    setSaveError(null);
    setSaving(true);
    try {
      await updateDraft(activeDraft.id, { content: essayContent });
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === activeDraft.id
            ? { ...d, content: essayContent, updated_at: new Date().toISOString() }
            : d
        )
      );
      setActiveDraft((prev) =>
        prev?.id === activeDraft.id
          ? { ...prev, content: essayContent, updated_at: new Date().toISOString() }
          : prev
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [activeDraft, essayContent, saving]);

  const handleSwitchDraft = useCallback((draft: EssayDraft) => {
    setActiveDraft(draft);
    setEssayContent(draft.content);
    setRenamingId(null);
  }, []);

  const startRename = useCallback((draft: EssayDraft) => {
    setRenamingId(draft.id);
    setRenameValue(draft.label ?? "Untitled");
  }, []);

  const submitRename = useCallback(
    async (draftId: string) => {
      const value = renameValue.trim() || "Untitled";
      setRenamingId(null);
      try {
        await updateDraft(draftId, { label: value });
        setDrafts((prev) =>
          prev.map((d) => (d.id === draftId ? { ...d, label: value } : d))
        );
        if (activeDraft?.id === draftId) setActiveDraft((p) => (p ? { ...p, label: value } : p));
      } catch {
        setRenameValue("");
      }
    },
    [renameValue, activeDraft?.id]
  );

  const handleNewDraft = useCallback(async () => {
    if (!selectedPrompt || creatingDraft || !isAuthenticated) return;
    setCreatingDraft(true);
    setSaveError(null);
    try {
      const newDraft = await createDraft({
        promptId: selectedPrompt.id,
        promptSlug: selectedPrompt.slug,
        label: `Draft ${drafts.length + 1}`,
      });
      setDrafts((prev) => [newDraft, ...prev]);
      setActiveDraft(newDraft);
      setEssayContent("");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to create draft");
    } finally {
      setCreatingDraft(false);
    }
  }, [selectedPrompt, creatingDraft, isAuthenticated, drafts.length]);

  const handleDeleteDraft = useCallback(
    async (draftId: string) => {
      if (deletingId) return;
      setDeletingId(draftId);
      try {
        await deleteDraft(draftId);
        setDrafts((prev) => prev.filter((d) => d.id !== draftId));
        if (activeDraft?.id === draftId) {
          const remaining = drafts.filter((d) => d.id !== draftId);
          const next = remaining[0] ?? null;
          setActiveDraft(next);
          setEssayContent(next?.content ?? "");
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Failed to delete draft");
      } finally {
        setDeletingId(null);
      }
    },
    [activeDraft?.id, drafts, deletingId]
  );

  const lastSavedLabel =
    activeDraft?.updated_at
      ? format(new Date(activeDraft.updated_at), "MMM d, yyyy 'at' h:mm a")
      : "Never";

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {isAuthenticated === false && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Sign in to save your essays and keep them across sessions.
        </p>
      )}

      {promptsError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {promptsError}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left: essay prompts */}
        <Card className="h-fit rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Essay prompts</CardTitle>
            <CardDescription>
              Choose a prompt to view tips and write your response.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {promptsLoading ? (
              <p className="text-sm text-muted-foreground">Loading prompts…</p>
            ) : prompts?.length ? (
              prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() => setSelectedPromptId(prompt.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    selectedPromptId === prompt.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent hover:bg-muted/50"
                  )}
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selectedPromptId === prompt.id && "rotate-90"
                    )}
                  />
                  <span className="font-medium">{prompt.title}</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No prompts available.</p>
            )}
          </CardContent>
        </Card>

        {/* Right: prompt details + drafts + editor */}
        <div className="flex min-h-100 min-w-0 flex-col gap-4">
          {selectedPrompt ? (
            <>
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg">{selectedPrompt.title}</CardTitle>
                  <CardDescription>
                    {selectedPrompt.description ?? undefined}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 text-muted-foreground"
                      >
                        <Lightbulb className="h-4 w-4" />
                        Tips & guidance
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selectedPrompt.tips ?? "No tips for this prompt."}
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>

              <Card className="flex flex-1 flex-col rounded-xl">
                <CardHeader className="flex flex-col gap-3 border-b pb-4 pr-0">
                  <div className="flex w-full flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">Your response</CardTitle>
                      <CardDescription>
                        Write your essay here. Save to store it on your account.
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pl-3 pr-6">
                      {isAuthenticated && (
                        <Popover open={draftsPopoverOpen} onOpenChange={setDraftsPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 font-normal"
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate max-w-35">
                                {activeDraft?.label ?? "Drafts"}
                              </span>
                              <span className="text-muted-foreground">
                                ({drafts.length})
                              </span>
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            className="w-80 p-0"
                            sideOffset={8}
                          >
                            <div className="border-b px-3 py-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Drafts
                              </p>
                            </div>
                            <div className="max-h-70 overflow-y-auto py-1">
                              {draftsLoading ? (
                                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                                  Loading…
                                </p>
                              ) : drafts.length === 0 ? (
                                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                                  No drafts yet.
                                </p>
                              ) : (
                                drafts.map((draft) => (
                                  <div key={draft.id} className="group flex items-center gap-1 rounded-sm px-2 py-1">
                                    {renamingId === draft.id ? (
                                      <Input
                                        autoFocus
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={() => submitRename(draft.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") e.currentTarget.blur();
                                          if (e.key === "Escape") {
                                            setRenamingId(null);
                                            setRenameValue(draft.label ?? "Untitled");
                                          }
                                        }}
                                        className="h-8 flex-1 border-0 bg-muted/50 text-sm shadow-none focus-visible:ring-2"
                                        placeholder="Draft name"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleSwitchDraft(draft);
                                            setDraftsPopoverOpen(false);
                                          }}
                                          className={cn(
                                            "flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1.5 text-left text-sm transition-colors",
                                            activeDraft?.id === draft.id
                                              ? "bg-primary/10 text-primary"
                                              : "hover:bg-muted/60"
                                          )}
                                        >
                                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                          <span className="min-w-0 flex-1 truncate">
                                            {draft.label ?? "Untitled"}
                                          </span>
                                          <span className="shrink-0 text-xs text-muted-foreground">
                                            {format(new Date(draft.updated_at), "MMM d")}
                                          </span>
                                        </button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                                          aria-label="Rename draft"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startRename(draft);
                                          }}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                          aria-label="Delete draft"
                                          disabled={deletingId === draft.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteDraft(draft.id);
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="border-t p-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start gap-2 text-sm"
                                disabled={draftsLoading || creatingDraft}
                                onClick={() => {
                                  handleNewDraft();
                                  setDraftsPopoverOpen(false);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                New draft
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                      <Button
                        size="sm"
                        disabled={saving || !isAuthenticated || draftsLoading || !activeDraft}
                        onClick={handleSave}
                      >
                        <Save className="h-4 w-4" />
                        {saving ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col pt-4">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Last saved: {draftsLoading ? "…" : lastSavedLabel}
                  </p>
                  {saveError && (
                    <p className="mb-2 text-xs text-destructive">{saveError}</p>
                  )}
                  <Textarea
                    placeholder="Start writing your essay here."
                    value={essayContent}
                    onChange={(e) => setEssayContent(e.target.value)}
                    disabled={draftsLoading}
                    className="min-h-70 flex-1 resize-y font-mono text-sm"
                  />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="flex flex-1 items-center justify-center rounded-xl">
              <CardContent className="py-12 text-center text-muted-foreground">
                {promptsLoading
                  ? "Loading…"
                  : "Select an essay prompt from the list to view guidance and start writing."}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
