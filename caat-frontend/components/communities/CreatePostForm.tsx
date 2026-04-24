"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { PlusCircle, X, CheckCircle, Clock, XCircle, FileText, EyeOff, School, BarChart2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getInitials } from "@/lib/user-utils";
import { cn } from "@/lib/utils";
import type { CommunityPost, PostAuthor, TopicTag, ResultCard, ScoreCard, PollOption } from "@/types/community";
import { TOPIC_LABELS } from "@/types/community";
import { createPostAction, fetchUserResumesAction, searchSchoolsAction } from "@/app/(main)/communities/actions";

const TOPIC_TAGS = Object.keys(TOPIC_LABELS) as TopicTag[];
const EXAM_OPTIONS = ["SAT", "ACT", "IB", "A-Levels", "ATAR", "AP"] as const;
const OUTCOME_OPTIONS = [
  { value: "accepted",   label: "Accepted",   icon: CheckCircle, color: "text-green-600" },
  { value: "waitlisted", label: "Waitlisted", icon: Clock,        color: "text-amber-600" },
  { value: "rejected",   label: "Rejected",   icon: XCircle,      color: "text-red-600" },
] as const;

interface CreatePostFormProps {
  currentUser: PostAuthor | null;
  onPostCreated: (post: CommunityPost) => void;
}

export function CreatePostForm({ currentUser, onPostCreated }: CreatePostFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [topicTag, setTopicTag] = useState<TopicTag | "">("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Result card
  const [showResult, setShowResult] = useState(false);
  const [resultOutcome, setResultOutcome] = useState<ResultCard["outcome"] | "">("");
  const [resultUniversity, setResultUniversity] = useState("");
  const [resultProgram, setResultProgram] = useState("");

  // Score card
  const [showScore, setShowScore] = useState(false);
  const [scoreExam, setScoreExam] = useState<ScoreCard["exam"] | "">("");
  const [scoreValue, setScoreValue] = useState("");

  // Resume
  const [showResume, setShowResume] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [resumes, setResumes] = useState<{ id: string; title: string }[]>([]);

  // School
  const [showSchool, setShowSchool] = useState(false);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schoolSuggestions, setSchoolSuggestions] = useState<{ id: number; name: string }[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<{ id: number; name: string } | null>(null);
  const schoolDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const authorName = currentUser
    ? [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") || "You"
    : "You";

  useEffect(() => {
    if (!isExpanded) return;
    textareaRef.current?.focus();
    fetchUserResumesAction().then(setResumes);
  }, [isExpanded]);

  const handleSchoolSearch = useCallback((q: string) => {
    setSchoolQuery(q);
    setSelectedSchool(null);
    if (schoolDebounceRef.current) clearTimeout(schoolDebounceRef.current);
    if (!q.trim()) { setSchoolSuggestions([]); return; }
    schoolDebounceRef.current = setTimeout(async () => {
      const results = await searchSchoolsAction(q);
      setSchoolSuggestions(results);
    }, 300);
  }, []);

  function reset() {
    setContent(""); setTopicTag(""); setIsAnonymous(false);
    setShowResult(false); setResultOutcome(""); setResultUniversity(""); setResultProgram("");
    setShowScore(false); setScoreExam(""); setScoreValue("");
    setShowResume(false); setSelectedResumeId("");
    setShowSchool(false); setSchoolQuery(""); setSelectedSchool(null); setSchoolSuggestions([]);
    setShowPoll(false); setPollOptions(["", ""]);
    setIsExpanded(false);
  }

  function handleSubmit() {
    if (!content.trim()) return toast.error("Write something before posting.");
    if (!topicTag) return toast.error("Select a topic for your post.");
    if (showResult && (!resultOutcome || !resultUniversity.trim())) return toast.error("Fill in the result card or remove it.");
    if (showScore && (!scoreExam || !scoreValue.trim())) return toast.error("Fill in the score card or remove it.");
    if (showPoll) {
      const filled = pollOptions.filter((o) => o.trim());
      if (filled.length < 2) return toast.error("Add at least 2 poll options.");
    }

    const resultCard: ResultCard | null = showResult && resultOutcome && resultUniversity.trim()
      ? { outcome: resultOutcome, university_name: resultUniversity.trim(), program: resultProgram.trim() || undefined }
      : null;

    const scoreCard: ScoreCard | null = showScore && scoreExam && scoreValue.trim()
      ? { exam: scoreExam, score: scoreValue.trim() }
      : null;

    const pollOptionsFinal: PollOption[] | null = showPoll
      ? pollOptions.filter((o) => o.trim()).map((text, i) => ({ id: String(i), text: text.trim() }))
      : null;

    startTransition(async () => {
      const { post, error } = await createPostAction({
        content: content.trim(),
        topic_tag: topicTag,
        result_card: resultCard,
        score_card: scoreCard,
        resume_id: showResume && selectedResumeId ? selectedResumeId : null,
        is_anonymous: isAnonymous,
        university_id: showSchool && selectedSchool ? selectedSchool.id : null,
        poll_options: pollOptionsFinal,
      });

      if (error || !post) { toast.error(error ?? "Failed to create post."); return; }
      toast.success("Post shared.");
      onPostCreated(post);
      reset();
    });
  }

  const charCount = content.length;
  const isOverLimit = charCount > 2000;

  if (!isExpanded) {
    return (
      <Card className="w-full cursor-text" onClick={() => setIsExpanded(true)}>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-9 shrink-0">
              <AvatarImage src={currentUser?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {getInitials(authorName)}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm text-muted-foreground select-none">Share your experience, results, or advice…</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-4 pb-3 space-y-4">
        {/* Author row */}
        <div className="flex items-center gap-3">
          <Avatar className="size-9 shrink-0">
            <AvatarImage src={isAnonymous ? undefined : (currentUser?.avatar_url ?? undefined)} />
            <AvatarFallback className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {isAnonymous ? "AN" : getInitials(authorName)}
            </AvatarFallback>
          </Avatar>
          <p className="text-sm font-medium">{isAnonymous ? "Anonymous" : authorName}</p>
        </div>

        {/* Content */}
        <div className="space-y-1">
          <Textarea
            ref={textareaRef}
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="resize-none min-h-[100px]"
            maxLength={2100}
          />
          <p className={cn("text-xs text-right", isOverLimit ? "text-red-500" : "text-muted-foreground")}>
            {charCount} / 2000
          </p>
        </div>

        {/* Topic */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Topic *</Label>
          <Select value={topicTag} onValueChange={(v) => setTopicTag(v as TopicTag)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select a topic" /></SelectTrigger>
            <SelectContent>
              {TOPIC_TAGS.map((tag) => (<SelectItem key={tag} value={tag}>{TOPIC_LABELS[tag]}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        {/* Attachment toggles */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: "result",  show: showResult, setShow: setShowResult,  Icon: CheckCircle, label: "Result"  },
            { key: "score",   show: showScore,  setShow: setShowScore,   Icon: null,        label: "Score"   },
            { key: "resume",  show: showResume, setShow: (v: boolean) => { setShowResume(v); if (!v) setSelectedResumeId(""); }, Icon: FileText, label: "Resume" },
            { key: "school",  show: showSchool, setShow: (v: boolean) => { setShowSchool(v); if (!v) { setSelectedSchool(null); setSchoolQuery(""); }}, Icon: School, label: "School" },
            { key: "poll",    show: showPoll,   setShow: (v: boolean) => { setShowPoll(v); if (!v) setPollOptions(["", ""]); }, Icon: BarChart2, label: "Poll" },
          ].map(({ key, show, setShow, Icon, label }) => (
            <Button
              key={key}
              type="button"
              variant={show ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShow(!show)}
            >
              {show ? <X className="size-3" /> : (Icon ? <Icon className="size-3" /> : <PlusCircle className="size-3" />)}
              {label}
            </Button>
          ))}
        </div>

        {/* Anonymous toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="anonymous-post"
            checked={isAnonymous}
            onCheckedChange={(checked) => setIsAnonymous(!!checked)}
          />
          <Label htmlFor="anonymous-post" className="text-xs cursor-pointer text-muted-foreground flex items-center gap-1">
            <EyeOff className="size-3.5" />
            Post anonymously
          </Label>
        </div>

        {/* Result card inputs */}
        {showResult && (
          <div className="rounded-md border p-3 space-y-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Result Card</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Outcome *</Label>
              <Select value={resultOutcome} onValueChange={(v) => setResultOutcome(v as ResultCard["outcome"])}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select outcome" /></SelectTrigger>
                <SelectContent>
                  {OUTCOME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}><span className={opt.color}>{opt.label}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">University *</Label>
              <Input placeholder="e.g. University of Toronto" value={resultUniversity} onChange={(e) => setResultUniversity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Program (optional)</Label>
              <Input placeholder="e.g. Computer Science" value={resultProgram} onChange={(e) => setResultProgram(e.target.value)} />
            </div>
          </div>
        )}

        {/* Score card inputs */}
        {showScore && (
          <div className="rounded-md border p-3 space-y-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Score Card</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Exam *</Label>
                <Select value={scoreExam} onValueChange={(v) => setScoreExam(v as ScoreCard["exam"])}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Exam type" /></SelectTrigger>
                  <SelectContent>
                    {EXAM_OPTIONS.map((exam) => (<SelectItem key={exam} value={exam}>{exam}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Score *</Label>
                <Input placeholder="e.g. 1520" value={scoreValue} onChange={(e) => setScoreValue(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Resume picker */}
        {showResume && (
          <div className="rounded-md border p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attach Resume</p>
            {resumes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No resumes found.{" "}
                <a href="/resume-builder" className="underline" target="_blank" rel="noreferrer">Build one</a>.
              </p>
            ) : (
              <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select a resume" /></SelectTrigger>
                <SelectContent>
                  {resumes.map((r) => (<SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* School picker */}
        {showSchool && (
          <div className="rounded-md border p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tag School</p>
            {selectedSchool ? (
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                <span className="text-sm">{selectedSchool.name}</span>
                <button type="button" onClick={() => { setSelectedSchool(null); setSchoolQuery(""); }} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Search schools…"
                  value={schoolQuery}
                  onChange={(e) => handleSchoolSearch(e.target.value)}
                  autoComplete="off"
                />
                {schoolSuggestions.length > 0 && (
                  <div className="absolute top-full mt-1 w-full z-10 rounded-md border bg-popover shadow-md">
                    {schoolSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => { setSelectedSchool(s); setSchoolQuery(""); setSchoolSuggestions([]); }}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Poll creation */}
        {showPoll && (
          <div className="rounded-md border p-3 space-y-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Poll Options</p>
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const next = [...pollOptions];
                    next[i] = e.target.value;
                    setPollOptions(next);
                  }}
                  className="text-sm"
                />
                {pollOptions.length > 2 && (
                  <Button
                    type="button" variant="ghost" size="sm" className="px-2 text-muted-foreground"
                    onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {pollOptions.length < 4 && (
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                onClick={() => setPollOptions([...pollOptions, ""])}>
                <PlusCircle className="size-3" /> Add option
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 gap-2 justify-end border-t">
        <Button variant="ghost" size="sm" onClick={reset} disabled={isPending}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isPending || isOverLimit || !content.trim() || !topicTag}>
          {isPending ? "Posting…" : "Post"}
        </Button>
      </CardFooter>
    </Card>
  );
}
