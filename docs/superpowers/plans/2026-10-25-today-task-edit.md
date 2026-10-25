# Today task editor implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Correct saved personal task text/date on Today safely.
**Architecture:** Dedicated owner-scoped read/compare-and-update helpers, one editor per mounted row, parent callback updates that row without resetting completion. Existing LibraryDialog and todo table.
**Tech Stack:** React/Next, Supabase, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-25-today-task-edit.md

## Global constraints
- Text 1–1000 trimmed characters; optional real date; completion and priority untouched.
- Optimistic conflict check on original text/date; no zero-row success.
- Preserve draft on failure, explicit reload, bounded requests and explicit opener focus.
- No schema, dependencies or provider/status writes.

## Review focus
- External edits and deletion must not be overwritten/reported saved.
- Completion/Undo in flight must not revert edited fields.
- Failed reload/save must retain local draft.
- Pointer/keyboard focus must survive pending/error/close.
- Long text must not push Edit or the date off phone width.

### Task 1: Safe task edit API
**Files:** new lib/personal-tasks.ts and tests/unit/personal-tasks.test.ts.
**Interfaces:** TaskDetails {id,text,due_date,done,priority}; fetchPersonalTask(id,signal): Promise<TaskDetails|null>; editPersonalTask(original,{text,due_date},signal): Promise<TaskDetails>.
- [ ] Write and run failing tests for auth/owner scope, unchanged completion/priority, original text/date filters including null, missing rows and validation.
- [ ] Implement minimal API; focused tests and typecheck pass.

### Task 2: Today editor
**Files:** new components/today/task-editor.tsx; TodayView.tsx; tests/unit/today-task-editor.test.tsx and today-view.test.tsx.
**Interfaces:** TaskEditor({task:{id,text,dueDate},disabled,onSaved}) supplies explicit opener/dialog; callback updates matching row text/date only.
- [ ] Test edit/pending/error/conflict reload/focus and state preservation RED.
- [ ] Implement editor and integrate both Today list modes; full unit suite/typecheck/lint.

### Task 3: Release
- [ ] Real desktop/mobile browser edit→reload and outage/conflict recovery tests.
- [ ] Independent and actual Claude reviews, significant fixes with regression tests.
- [ ] Separate PR after PROD-169, exact-head CI, release and production checks, close170.
