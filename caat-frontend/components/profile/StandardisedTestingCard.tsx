"use client";

import React, { useState } from "react";
import { Award, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "./ProfileCard";
import {
  CURRICULUM_OPTIONS,
  GPA_SCALES,
  ENGLISH_PROFICIENCY_TESTS,
  type StandardisedTestScore,
  type StandardisedTestSubjectRow,
} from "@/types/profile";

interface StandardisedTestingCardProps {
  scores: StandardisedTestScore[];
  onSave: (scores: StandardisedTestScore[]) => Promise<void>;
}

// ── Display helpers ────────────────────────────────────────────────────────────

function scoreMaxLabel(score: StandardisedTestScore): string | null {
  switch (score.curriculum) {
    case "SAT": return "/ 1600";
    case "ATAR": return "/ 99.95";
    case "IB": return "/ 46";
    case "GPA": return score.score_scale ? `/ ${score.score_scale}` : null;
    case "English Proficiency": {
      const test = ENGLISH_PROFICIENCY_TESTS.find(
        (t) => t.label === score.score_scale
      );
      return test ? `/ ${test.maxScore}` : null;
    }
    default: return null;
  }
}

function ScoreDisplay({ score }: { score: StandardisedTestScore }) {
  const max = scoreMaxLabel(score);
  const label =
    score.curriculum === "English Proficiency" && score.score_scale
      ? score.score_scale
      : score.curriculum;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {score.cumulative_score && (
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tabular-nums">
            {score.cumulative_score}
          </span>
          {max && <span className="text-sm text-muted-foreground">{max}</span>}
        </div>
      )}
      {score.subjects.length > 0 && (
        <div className="mt-1 flex flex-col gap-0.5">
          {score.subjects.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.subject_name}</span>
              <span className="font-medium">{s.grade}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Edit helpers ───────────────────────────────────────────────────────────────

function newSubject(): StandardisedTestSubjectRow {
  return {
    id: crypto.randomUUID(),
    test_score_id: "",
    subject_name: "",
    grade: "",
    created_at: new Date().toISOString(),
  };
}

function ScoreEditor({
  score,
  onChange,
  onRemove,
}: {
  score: StandardisedTestScore;
  onChange: (updated: StandardisedTestScore) => void;
  onRemove: () => void;
}) {
  const hasSubjects = score.curriculum === "A-Levels" || score.curriculum === "IB";
  const hasCumulative = score.curriculum !== "A-Levels";

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/30">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <select
          value={score.curriculum}
          onChange={(e) =>
            onChange({
              ...score,
              curriculum: e.target.value,
              cumulative_score: null,
              score_scale: null,
              subjects: [],
            })
          }
          className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {CURRICULUM_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* GPA scale selector */}
      {score.curriculum === "GPA" && (
        <select
          value={score.score_scale ?? ""}
          onChange={(e) => onChange({ ...score, score_scale: e.target.value })}
          className="h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="" disabled>
            Select scale…
          </option>
          {GPA_SCALES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      )}

      {/* Custom GPA scale input */}
      {score.curriculum === "GPA" && score.score_scale === "custom" && (
        <Input
          placeholder="Enter max score (e.g. 7.0)"
          className="h-8 text-sm"
          onChange={(e) => onChange({ ...score, score_scale: e.target.value })}
        />
      )}

      {/* English proficiency test selector */}
      {score.curriculum === "English Proficiency" && (
        <select
          value={score.score_scale ?? ""}
          onChange={(e) => onChange({ ...score, score_scale: e.target.value })}
          className="h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="" disabled>
            Select test…
          </option>
          {ENGLISH_PROFICIENCY_TESTS.map((t) => (
            <option key={t.label} value={t.label}>
              {t.label} (/ {t.maxScore})
            </option>
          ))}
        </select>
      )}

      {/* Cumulative score input */}
      {hasCumulative && (
        <Input
          placeholder={
            score.curriculum === "GPA"
              ? "Your GPA"
              : score.curriculum === "English Proficiency"
              ? "Your score"
              : "Score"
          }
          value={score.cumulative_score ?? ""}
          onChange={(e) =>
            onChange({ ...score, cumulative_score: e.target.value })
          }
          className="h-8 text-sm"
        />
      )}

      {/* Subject rows */}
      {hasSubjects && (
        <div className="flex flex-col gap-1.5 mt-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Subjects
          </p>
          {score.subjects.map((sub, i) => (
            <div key={sub.id} className="flex items-center gap-2">
              <Input
                placeholder="Subject name"
                value={sub.subject_name}
                onChange={(e) => {
                  const updated = [...score.subjects];
                  updated[i] = { ...sub, subject_name: e.target.value };
                  onChange({ ...score, subjects: updated });
                }}
                className="h-8 text-sm flex-1"
              />
              <Input
                placeholder={score.curriculum === "IB" ? "1–7" : "A*, A, B…"}
                value={sub.grade}
                onChange={(e) => {
                  const updated = [...score.subjects];
                  updated[i] = { ...sub, grade: e.target.value };
                  onChange({ ...score, subjects: updated });
                }}
                className="h-8 text-sm w-24"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  onChange({
                    ...score,
                    subjects: score.subjects.filter((_, idx) => idx !== i),
                  })
                }
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({ ...score, subjects: [...score.subjects, newSubject()] })
            }
            className="h-7 text-xs border-dashed self-start"
          >
            <Plus className="h-3 w-3" />
            Add subject
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function StandardisedTestingCard({
  scores,
  onSave,
}: StandardisedTestingCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<StandardisedTestScore[]>(scores);

  function handleEdit() {
    setDraft(scores);
    setIsEditing(true);
  }

  async function handleSave() {
    await onSave(draft);
    setIsEditing(false);
  }

  function handleCancel() {
    setDraft(scores);
    setIsEditing(false);
  }

  function addCurriculum() {
    const used = new Set(draft.map((s) => s.curriculum));
    const next =
      CURRICULUM_OPTIONS.find((c) => !used.has(c)) ?? CURRICULUM_OPTIONS[0];
    setDraft((d) => [
      ...d,
      {
        id: crypto.randomUUID(),
        profile_id: "",
        curriculum: next,
        cumulative_score: null,
        score_scale: null,
        subjects: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  }

  return (
    <ProfileCard
      title="Standardised Testing"
      icon={<Award className="h-4 w-4" />}
      isEditing={isEditing}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      {isEditing ? (
        <div className="flex flex-col gap-3">
          {draft.map((score, i) => (
            <ScoreEditor
              key={score.id}
              score={score}
              onChange={(updated) =>
                setDraft((d) => d.map((s, idx) => (idx === i ? updated : s)))
              }
              onRemove={() =>
                setDraft((d) => d.filter((_, idx) => idx !== i))
              }
            />
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={addCurriculum}
            className="border-dashed text-xs self-start"
          >
            <Plus className="h-3 w-3" />
            Add curriculum
          </Button>
        </div>
      ) : scores.length === 0 ? (
        <p className="text-sm text-muted-foreground">No test scores added yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {scores.map((score) => (
            <ScoreDisplay key={score.id} score={score} />
          ))}
        </div>
      )}
    </ProfileCard>
  );
}
