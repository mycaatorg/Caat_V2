"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchMySchools, type MySchool } from "@/lib/my-schools";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
import { Check, ChevronDown, ChevronRight, FileText, Lightbulb, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import {
  fetchEssayPrompts,
  fetchDraftsForPrompt,
  updateDraft,
  createDraft,
  deleteDraft,
  setCurrentDraft,
  fetchCustomPrompts,
  createCustomPrompt,
  deleteCustomPrompt,
  renameCustomPrompt,
  type EssayPrompt,
  type EssayDraft,
  type CustomEssayPrompt,
} from "./api";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function EssaysShell({
  initialPrompts,
}: {
  /** Global essay prompt list resolved on the server (C8) for an instant first paint. */
  initialPrompts?: EssayPrompt[] | null;
}) {
  const hasInitialPrompts = initialPrompts != null;
  const [prompts, setPrompts] = useState<EssayPrompt[] | null>(initialPrompts ?? null);
  const [promptsError, setPromptsError] = useState<string | null>(null);
  const [promptsLoading, setPromptsLoading] = useState(!hasInitialPrompts);

  const [customPrompts, setCustomPrompts] = useState<CustomEssayPrompt[]>([]);
  const [creatingCustomPrompt, setCreatingCustomPrompt] = useState(false);
  const [newCustomTitle, setNewCustomTitle] = useState("");
  const [savingCustomPrompt, setSavingCustomPrompt] = useState(false);
  const [deletingCustomPromptId, setDeletingCustomPromptId] = useState<string | null>(null);
  const [renamingCustomId, setRenamingCustomId] = useState<string | null>(null);
  const [renameCustomValue, setRenameCustomValue] = useState("");
  const [confirmDeleteCustomId, setConfirmDeleteCustomId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  // ?prompt=<id> deep-links to a prompt (e.g. Today's "pick up where you left
  // off"); custom prompts resolve once the custom list loads.
  const urlPromptRaw = searchParams.get("prompt");
  const urlPromptId = urlPromptRaw && /^[0-9a-f-]{36}$/i.test(urlPromptRaw) ? urlPromptRaw : null;
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(
    urlPromptId ?? initialPrompts?.[0]?.id ?? null,
  );
  const [drafts, setDrafts] = useState<EssayDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [activeDraft, setActiveDraft] = useState<EssayDraft | null>(null);

  // School tagging for per-school prompts (null = shared across applications)
  // Guard against a malformed ?school=abc — Number("abc") is NaN, which would
  // poison the school_id filter/state.
  const urlSchoolRaw = searchParams.get("school");
  const urlSchoolNum = urlSchoolRaw ? Number(urlSchoolRaw) : NaN;
  const urlSchoolId = Number.isFinite(urlSchoolNum) ? urlSchoolNum : null;
  const [mySchools, setMySchools] = useState<MySchool[]>([]);
  const [tagSchoolId, setTagSchoolId] = useState<number | null>(urlSchoolId);
  const [essayContent, setEssayContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [draftsPopoverOpen, setDraftsPopoverOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const selectedPrompt = prompts?.find((p) => p.id === selectedPromptId) ?? null;
  const selectedCustomPrompt = customPrompts.find((p) => p.id === selectedPromptId) ?? null;

  // Refs mirror the latest editor state so save/flush logic reads current values
  // (never a stale closure) and so we can flush the outgoing draft before its
  // content is replaced (draft/prompt switch, new draft, unmount).
  const essayContentRef = useRef(essayContent);
  const activeDraftRef = useRef(activeDraft);
  essayContentRef.current = essayContent;
  activeDraftRef.current = activeDraft;
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const transitionLockRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWritesRef = useRef(0);
  const queuedSaveTailRef = useRef<{ draftId: string; content: string; promise: Promise<void> } | null>(null);

  // M1 — warn on hard close/refresh while an essay edit is still within the
  // autosave window (complements the flush-before-switch/unmount fixes).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (
        autosaveTimerRef.current ||
        savingRef.current ||
        pendingSaveRef.current ||
        pendingWritesRef.current > 0 ||
        (activeDraftRef.current !== null && essayContentRef.current !== activeDraftRef.current.content)
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Persist outgoing edits in order, draining any further typing that happens
  // while a write is in flight. Declared before effects that reference it.
  const saveDraftContent = useCallback((draft: EssayDraft, content: string) => {
    const currentTail = queuedSaveTailRef.current;
    if (currentTail?.draftId === draft.id && currentTail.content === content) {
      return currentTail.promise;
    }

    pendingWritesRef.current += 1;
    setSaving(true);
    const queuedSave = saveQueueRef.current.then(async () => {
      await updateDraft(draft.id, { content });
      const updatedAt = new Date().toISOString();
      if (activeDraftRef.current?.id === draft.id) {
        activeDraftRef.current = { ...activeDraftRef.current, content, updated_at: updatedAt };
      }
      setDrafts((prev) =>
        prev.map((item) => item.id === draft.id ? { ...item, content, updated_at: updatedAt } : item)
      );
      setActiveDraft((prev) =>
        prev?.id === draft.id ? { ...prev, content, updated_at: updatedAt } : prev
      );
    });
    const queuedWrite = { draftId: draft.id, content, promise: queuedSave };
    queuedSaveTailRef.current = queuedWrite;
    const finishQueuedWrite = () => {
      pendingWritesRef.current -= 1;
      if (queuedSaveTailRef.current === queuedWrite) queuedSaveTailRef.current = null;
      if (pendingWritesRef.current === 0) setSaving(false);
    };
    // Keep later writes moving after a failure while returning this write's
    // rejection to callers that need to keep the current draft selected.
    saveQueueRef.current = queuedSave.then(
      finishQueuedWrite,
      finishQueuedWrite,
    );
    return queuedSave;
  }, []);

  const flushPending = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    try {
      setSaveError(null);
      while (true) {
        const draft = activeDraftRef.current;
        const content = essayContentRef.current;
        if (!draft || (content === draft.content && pendingWritesRef.current === 0)) return;
        await saveDraftContent(draft, content);
        if (essayContentRef.current === content) return;
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
      throw err;
    }
  }, [saveDraftContent]);

  // Load prompts on mount
  useEffect(() => {
    // First-paint prompt list came from the server; skip the client fetch then.
    if (hasInitialPrompts) return;

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
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load custom prompts when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchCustomPrompts().then(setCustomPrompts).catch(() => {});
    fetchMySchools().then(setMySchools).catch(() => {});
  }, [isAuthenticated]);

  // Keep the school selector in sync with whichever draft is active. A loaded
  // draft shows its own tag; with no draft we fall back to the URL-armed school
  // (e.g. arriving from a hub's "Start an essay for X" button).
  useEffect(() => {
     
    setTagSchoolId(activeDraft ? activeDraft.school_id : urlSchoolId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDraft?.id]);

  // When selected prompt changes, load drafts
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
          toast.error("Could not load drafts for this prompt. Please try again.");
        }
      })
      .finally(() => { if (!cancelled) setDraftsLoading(false); });

    return () => {
      cancelled = true;
      // Flush the outgoing prompt's active draft before this effect re-runs and
      // replaces the editor content for the newly selected prompt.
      void flushPending().catch(() => {});
    };
  }, [selectedPromptId, isAuthenticated, flushPending]);

  // Track auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setIsAuthenticated(!!user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) =>
      setIsAuthenticated(!!session?.user)
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleSave = useCallback(async () => {
    const draft = activeDraftRef.current;
    if (!draft) return;
    // If a save is already in flight, don't drop the edits typed since it
    // started: mark that another save is needed and re-run when it resolves.
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    const content = essayContentRef.current;
    if (content === draft.content && pendingWritesRef.current === 0) return;
    setSaveError(null);
    savingRef.current = true;
    setSaving(true);
    try {
      await saveDraftContent(draft, content);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      savingRef.current = false;
      setSaving(pendingWritesRef.current > 0);
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        // Re-run to capture edits made during the in-flight save.
        void handleSave();
      }
    }
     
  }, [saveDraftContent]);

  const handleSwitchDraft = useCallback(
    async (draft: EssayDraft) => {
      if (transitionLockRef.current || activeDraftRef.current?.id === draft.id) return;
      transitionLockRef.current = true;
      try {
        await flushPending();
      } catch {
        return;
      } finally {
        transitionLockRef.current = false;
      }
      setActiveDraft(draft);
      setEssayContent(draft.content);
      setRenamingId(null);
      if (draft.prompt_id) {
        setCurrentDraft(draft.id, draft.prompt_id).catch(() => {});
      }
    },
    [flushPending]
  );

  const handleSelectPrompt = useCallback(async (promptId: string) => {
    if (promptId === selectedPromptId || transitionLockRef.current) return;
    transitionLockRef.current = true;
    try {
      await flushPending();
    } catch {
      return;
    } finally {
      transitionLockRef.current = false;
    }
    setSelectedPromptId(promptId);
  }, [flushPending, selectedPromptId]);

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
        setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, label: value } : d)));
        if (activeDraft?.id === draftId) setActiveDraft((p) => (p ? { ...p, label: value } : p));
      } catch {
        setRenameValue("");
        toast.error("Failed to rename draft. Please try again.");
      }
    },
    [renameValue, activeDraft?.id]
  );

  const handleNewDraft = useCallback(async () => {
    if (!selectedPromptId || creatingDraft || !isAuthenticated || transitionLockRef.current) return;
    transitionLockRef.current = true;
    try {
      // Flush the outgoing draft before creating its replacement.
      try {
        await flushPending();
      } catch {
        return;
      }
      const promptSlug = selectedPrompt?.slug ?? `custom-${selectedPromptId}`;
      setCreatingDraft(true);
      setSaveError(null);
      try {
        const newDraft = await createDraft({
          promptId: selectedPromptId,
          promptSlug,
          label: `Draft ${drafts.length + 1}`,
          schoolId: selectedPrompt?.scope === "per_school" ? tagSchoolId : null,
        });
        setDrafts((prev) => [newDraft, ...prev]);
        setActiveDraft(newDraft);
        setEssayContent("");
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Failed to create draft");
      } finally {
        setCreatingDraft(false);
      }
    } finally {
      transitionLockRef.current = false;
    }
  }, [selectedPromptId, selectedPrompt, creatingDraft, isAuthenticated, drafts.length, tagSchoolId, flushPending]);

  // Persist a school tag onto the active draft (or just hold it for the next
  // new draft if none is active yet).
  const handleTagSchool = useCallback(
    async (schoolId: number | null) => {
      setTagSchoolId(schoolId);
      if (!activeDraft) return;
      try {
        await updateDraft(activeDraft.id, { school_id: schoolId });
        setDrafts((prev) => prev.map((d) => (d.id === activeDraft.id ? { ...d, school_id: schoolId } : d)));
        setActiveDraft((prev) => (prev ? { ...prev, school_id: schoolId } : prev));
      } catch {
        toast.error("Could not update the school tag.");
      }
    },
    [activeDraft]
  );

  const handleDeleteDraft = useCallback(
     
    async (draftId: string) => {
      if (deletingId) return;
      setConfirmDeleteId(null);
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
        toast.error("Failed to delete draft. Please try again.");
      } finally {
        setDeletingId(null);
      }
    },
    [activeDraft?.id, drafts, deletingId]
  );

  // Custom prompt handlers
  const handleCreateCustomPrompt = useCallback(async () => {
    const title = newCustomTitle.trim();
    if (!title || savingCustomPrompt || !isAuthenticated || transitionLockRef.current) return;
    transitionLockRef.current = true;
    try {
      await flushPending();
    } catch {
      transitionLockRef.current = false;
      return;
    }
    setSavingCustomPrompt(true);
    try {
      const cp = await createCustomPrompt(title);
      setCustomPrompts((prev) => [...prev, cp]);
      setNewCustomTitle("");
      setCreatingCustomPrompt(false);
      setSelectedPromptId(cp.id);
    } catch {
      toast.error("Failed to create essay. Please try again.");
    } finally {
      setSavingCustomPrompt(false);
      transitionLockRef.current = false;
    }
  }, [newCustomTitle, savingCustomPrompt, isAuthenticated, flushPending]);

  const startRenameCustom = useCallback((cp: CustomEssayPrompt) => {
    setRenamingCustomId(cp.id);
    setRenameCustomValue(cp.title);
  }, []);

  const submitRenameCustom = useCallback(
    async (id: string) => {
      const value = renameCustomValue.trim() || "Untitled";
      setRenamingCustomId(null);
      try {
        await renameCustomPrompt(id, value);
        setCustomPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, title: value } : p)));
      } catch {
        toast.error("Failed to rename essay. Please try again.");
      }
    },
    [renameCustomValue]
  );

  const handleDeleteCustomPrompt = useCallback(
    async (id: string) => {
      if (transitionLockRef.current) return;
      const deletingActivePrompt = selectedPromptId === id;
      transitionLockRef.current = true;
      setConfirmDeleteCustomId(null);
      try {
        if (deletingActivePrompt) {
          setDeletingCustomPromptId(id);
          try {
            await flushPending();
          } catch {
            toast.error("Could not save this essay before deleting it. Please retry.");
            return;
          }
        }
        await deleteCustomPrompt(id);
        // Delete all drafts for this custom prompt from local state
        setCustomPrompts((prev) => prev.filter((p) => p.id !== id));
        if (deletingActivePrompt) {
          const next = prompts?.[0] ?? null;
          setSelectedPromptId(next?.id ?? null);
        }
      } catch {
        toast.error("Failed to delete essay. Please try again.");
      } finally {
        if (deletingActivePrompt) setDeletingCustomPromptId(null);
        transitionLockRef.current = false;
      }
    },
    [selectedPromptId, prompts, flushPending]
  );

  const lastSavedLabel =
    activeDraft?.updated_at
      ? format(new Date(activeDraft.updated_at), "MMM d, yyyy 'at' h:mm a")
      : "Never";

  // Autosave — fires 2s after the user stops typing. (autosaveTimerRef is
  // declared with the other editor refs above.)
  useEffect(() => {
    if (essayContent === activeDraft?.content) return;
    if (!activeDraft || !isAuthenticated) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => { handleSave(); }, 2000);

    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essayContent]);

  // Flush pending edits on unmount (client-side navigation away) and on tab
  // close, so leaving within the 2s autosave window doesn't lose work.
  useEffect(() => {
    const onBeforeUnload = () => { void flushPending().catch(() => {}); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flushPending().catch(() => {});
    };
  }, [flushPending]);

  // Shared draft editor card — used for both prompt types
  const draftEditorCard = (
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
                  <Button variant="outline" size="sm" className="gap-2 font-normal">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate max-w-35">
                      {activeDraft?.label ?? "Drafts"}
                    </span>
                    <span className="text-muted-foreground">({drafts.length})</span>
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
                  <div className="border-b px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Drafts
                    </p>
                  </div>
                  <div className="max-h-70 overflow-y-auto py-1">
                    {draftsLoading ? (
                      <p className="px-3 py-4 text-center text-sm text-muted-foreground">Loading…</p>
                    ) : drafts.length === 0 ? (
                      <p className="px-3 py-4 text-center text-sm text-muted-foreground">No drafts yet.</p>
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
                                onClick={() => { handleSwitchDraft(draft); setDraftsPopoverOpen(false); }}
                                disabled={creatingDraft || savingCustomPrompt}
                                className={cn(
                                  "flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1.5 text-left text-sm transition-colors",
                                  activeDraft?.id === draft.id
                                    ? "bg-[#9a1a27]/10 text-[#9a1a27] dark:text-[#e06b78]"
                                    : "hover:bg-muted/60"
                                )}
                              >
                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="min-w-0 flex-1 truncate">{draft.label ?? "Untitled"}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {format(new Date(draft.updated_at), "MMM d")}
                                </span>
                              </button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                                aria-label="Rename draft"
                                onClick={(e) => { e.stopPropagation(); startRename(draft); }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {confirmDeleteId === draft.id ? (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    className="h-7 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded transition-colors"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteDraft(draft.id); }}
                                  >
                                    Delete
                                  </button>
                                  <button
                                    className="h-7 px-2 text-xs font-medium text-muted-foreground hover:bg-muted rounded transition-colors"
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                  aria-label="Delete draft"
                                  disabled={deletingId === draft.id}
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(draft.id); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
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
                      disabled={draftsLoading || creatingDraft || savingCustomPrompt}
                      onClick={() => { handleNewDraft(); setDraftsPopoverOpen(false); }}
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
              className="bg-[#9a1a27] hover:bg-[#7d141f] text-white"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-4">
        {!draftsLoading && !activeDraft ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">No draft selected</p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">
                Create a draft first to start writing.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={creatingDraft || savingCustomPrompt || !isAuthenticated}
              onClick={handleNewDraft}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New draft
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {saving ? "Saving…" : `Last saved on: ${draftsLoading ? "…" : lastSavedLabel}`}
            </p>
            {saveError && (
              <p className="mb-2 text-xs text-destructive">{saveError}</p>
            )}
            <Textarea
              placeholder="Start writing your essay here."
              value={essayContent}
              onChange={(e) => setEssayContent(e.target.value)}
              disabled={draftsLoading || creatingDraft || savingCustomPrompt || deletingCustomPromptId === selectedPromptId}
              className="min-h-70 flex-1 resize-y font-mono text-sm"
            />
            <div className="flex items-center justify-end gap-3 mt-1.5 text-xs text-muted-foreground">
              <span>
                {essayContent.trim() === ""
                  ? "0 words"
                  : `${essayContent.trim().split(/\s+/).length} word${essayContent.trim().split(/\s+/).length !== 1 ? "s" : ""}`}
              </span>
              <span>{essayContent.length} characters</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
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
        {/* Left: essay prompts + my essays */}
        <Card className="h-fit rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-4 w-4 text-[#9a1a27] dark:text-[#e06b78]" />
              Essay prompts
            </CardTitle>
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
                  onClick={() => { void handleSelectPrompt(prompt.id); }}
                  disabled={creatingDraft || savingCustomPrompt}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    selectedPromptId === prompt.id
                      ? "border-[#9a1a27] dark:border-[#e06b78] bg-[#9a1a27] text-white"
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

            {/* My Essays section */}
            {isAuthenticated && (
              <>
                <Separator className="my-3" />
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    My Essays
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-[#9a1a27] dark:text-[#e06b78] hover:text-[#7d141f] hover:bg-[#9a1a27]/10"
                    onClick={() => { setCreatingCustomPrompt(true); setNewCustomTitle(""); }}
                    aria-label="Add custom essay"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {creatingCustomPrompt && (
                  <div className="flex items-center gap-1 px-1 mb-1">
                    <Input
                      autoFocus
                      placeholder="Essay title…"
                      value={newCustomTitle}
                      onChange={(e) => setNewCustomTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateCustomPrompt();
                        if (e.key === "Escape") { setCreatingCustomPrompt(false); setNewCustomTitle(""); }
                      }}
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      size="icon"
                      className="h-8 w-8 shrink-0 bg-[#9a1a27] hover:bg-[#7d141f] text-white"
                      disabled={savingCustomPrompt || !newCustomTitle.trim()}
                      onClick={handleCreateCustomPrompt}
                      aria-label="Confirm"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => { setCreatingCustomPrompt(false); setNewCustomTitle(""); }}
                      aria-label="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                {customPrompts.length === 0 && !creatingCustomPrompt ? (
                  <p className="text-xs text-muted-foreground px-1 py-1">
                    No custom essays yet. Click + to add one.
                  </p>
                ) : (
                  customPrompts.map((cp) => (
                    <div key={cp.id} className="group flex items-center gap-1">
                      {renamingCustomId === cp.id ? (
                        <Input
                          autoFocus
                          value={renameCustomValue}
                          onChange={(e) => setRenameCustomValue(e.target.value)}
                          onBlur={() => submitRenameCustom(cp.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setRenamingCustomId(null);
                          }}
                          className="h-8 flex-1 text-sm border-0 bg-muted/50 shadow-none focus-visible:ring-2"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => { void handleSelectPrompt(cp.id); }}
                          disabled={creatingDraft || savingCustomPrompt}
                          className={cn(
                            "flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                            selectedPromptId === cp.id
                              ? "border-[#9a1a27] dark:border-[#e06b78] bg-[#9a1a27] text-white"
                              : "border-transparent hover:bg-muted/50"
                          )}
                        >
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 shrink-0",
                              selectedPromptId === cp.id && "rotate-90"
                            )}
                          />
                          <span className="font-medium truncate">{cp.title}</span>
                        </button>
                      )}
                      {renamingCustomId !== cp.id && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                            aria-label="Rename"
                            onClick={() => startRenameCustom(cp)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {confirmDeleteCustomId === cp.id ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                className="h-7 px-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded transition-colors"
                                onClick={() => handleDeleteCustomPrompt(cp.id)}
                              >
                                Delete
                              </button>
                              <button
                                className="h-7 px-1.5 text-xs text-muted-foreground hover:bg-muted rounded transition-colors"
                                onClick={() => setConfirmDeleteCustomId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                              aria-label="Delete"
                              onClick={() => setConfirmDeleteCustomId(cp.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: prompt details + drafts + editor */}
        <div className="flex min-h-100 min-w-0 flex-col gap-4">
          {selectedCustomPrompt ? (
            // Custom essay — no tips card, just the editor
            <>
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg">{selectedCustomPrompt.title}</CardTitle>
                  <CardDescription>Your custom essay prompt.</CardDescription>
                </CardHeader>
              </Card>
              {draftEditorCard}
            </>
          ) : selectedPrompt ? (
            // Default prompt — tips card + editor
            <>
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg">{selectedPrompt.title}</CardTitle>
                  <CardDescription>{selectedPrompt.description ?? undefined}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 text-muted-foreground"
                      >
                        <Lightbulb className="h-4 w-4 text-[#9a1a27] dark:text-[#e06b78]" />
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

                  {selectedPrompt.scope === "per_school" && (
                    <div className="mt-4 flex flex-col gap-1.5 border-t pt-4">
                      <label className="text-sm font-medium">This essay is for</label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full max-w-xs justify-between font-normal">
                            {mySchools.find((s) => s.id === tagSchoolId)?.name ?? "Not tied to a school yet"}
                            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                          <DropdownMenuItem onSelect={() => handleTagSchool(null)}>
                            Not tied to a school yet
                            {tagSchoolId == null ? <Check className="h-3.5 w-3.5 ml-auto text-muted-foreground" /> : null}
                          </DropdownMenuItem>
                          {mySchools.map((s) => (
                            <DropdownMenuItem key={s.id} onSelect={() => handleTagSchool(s.id)}>
                              {s.name}
                              {tagSchoolId === s.id ? <Check className="h-3.5 w-3.5 ml-auto text-muted-foreground" /> : null}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <p className="text-xs text-muted-foreground">
                        You write this one fresh for each school. Tag it so it shows up under that
                        school&apos;s application.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              {draftEditorCard}
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
