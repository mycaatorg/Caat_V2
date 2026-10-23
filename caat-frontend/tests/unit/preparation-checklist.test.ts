import { describe, expect, it } from "vitest";
import {
  PREP_STEP_LABELS,
  prepScoreLabel,
  preparationFor,
  type PreparationInputs,
} from "@/lib/preparation-checklist";

const prompts = [
  { id: "p-why", scope: "per_school" },
  { id: "p-personal", scope: "shared" },
  { id: "p-legacy", scope: null },
];

function inputs(patch: Partial<PreparationInputs> = {}): PreparationInputs {
  return { prompts, drafts: [], documents: [], ...patch };
}

describe("preparationFor", () => {
  it("counts nothing from another school or untagged per-school drafts or non-key shared files", () => {
    const result = preparationFor(
      { school_id: 7, deadline_at: null },
      inputs({
        drafts: [
          { prompt_id: "p-why", school_id: 99 },
          { prompt_id: "p-why", school_id: null },
          { prompt_id: "p-legacy", school_id: null },
          { prompt_id: "p-personal", school_id: 7 },
          { prompt_id: "unknown", school_id: null },
        ],
        documents: [
          { category: "other", school_id: null },
          { category: "transcripts", school_id: 99 },
        ],
      })
    );
    expect(result).toEqual({ deadlineSet: false, essayDrafted: false, keyDocsUploaded: false, score: 0 });
  });

  it("counts a per-school draft tagged to this school and any document attached to it", () => {
    const result = preparationFor(
      { school_id: 7, deadline_at: "2026-12-01" },
      inputs({ drafts: [{ prompt_id: "p-why", school_id: 7 }], documents: [{ category: "other", school_id: 7 }] })
    );
    expect(result).toEqual({ deadlineSet: true, essayDrafted: true, keyDocsUploaded: true, score: 3 });
  });

  it("counts a shared prompt's untagged draft and a shared key document", () => {
    const result = preparationFor(
      { school_id: 7, deadline_at: null },
      inputs({ drafts: [{ prompt_id: "p-personal", school_id: null }], documents: [{ category: "identity", school_id: null }] })
    );
    expect(result).toMatchObject({ essayDrafted: true, keyDocsUploaded: true, score: 2 });
  });

  it("gives two applications different results from the same mixed items", () => {
    const shared = inputs({
      drafts: [{ prompt_id: "p-why", school_id: 7 }],
      documents: [{ category: "letters", school_id: 8 }],
    });
    expect(preparationFor({ school_id: 7, deadline_at: null }, shared)).toMatchObject({ essayDrafted: true, keyDocsUploaded: false, score: 1 });
    expect(preparationFor({ school_id: 8, deadline_at: null }, shared)).toMatchObject({ essayDrafted: false, keyDocsUploaded: true, score: 1 });
  });
});

describe("checklist wording", () => {
  it("scores out of three steps and never implies submission", () => {
    expect(prepScoreLabel(2)).toBe("2 of 3 steps");
    for (const text of [...Object.values(PREP_STEP_LABELS), prepScoreLabel(3)]) {
      expect(text).not.toMatch(/submit|complete|ready|sent/i);
    }
  });
});
