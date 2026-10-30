# Today week planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Give Today a visible planning workspace connecting next action, dated work and core student destinations.
**Architecture:** One presentational client agenda consumes existing loaded deadlines and live to-do state. Today retains all persistence and focus-list behavior.
**Tech Stack:** Existing React, Next.js, Tailwind, Vitest and Playwright.
**Spec:** docs/superpowers/specs/2026-10-30-week-planner-design.md

## Global Constraints
No dependencies, schema, notifications or new persistence. Preserve existing ownership, dates, task editing/Undo and full-list URLs. Keep evidence. User standing approval covers implementation/review/release; use existing isolated checkout and fresh feature branch.

## Review Focus
Long titles and a narrow viewport must not hide actions or overflow the page. Multiple deadline sources must not be silently truncated. Updating tasks must not leave agenda counts stale. Empty days must not imply no remaining work. Date-only values must not shift across timezones.

### Task 1: Connected Today workspace
**Files:** create components/today/week-agenda.tsx; modify components/today/TodayView.tsx; test tests/unit/today-view.test.tsx; add journey to tests/e2e/staging-journeys.spec.ts (all under caat-frontend).
**Interfaces:** WeekAgenda consumes todayISO:string, deadlines:UnifiedDeadline[], todos:Array<TodayTodo & {done:boolean}>, onViewTodos:(taskId?:string)=>void. Produces an accessible seven-date selector and full selected-day list. Today owns mutation state and passes a callback opening the full to-do page containing the selected task. No shared task interfaces.
- [ ] Write tests for seven-day month/year/leap rollover; select dates and show matching deadline/task routes and source labels; exclude completed/undated/outside items; render >10 same-day items; empty-day and full-task action. Add Today integration for completion failure/Undo updating agenda and next-step explanation/workspace destinations.
- [ ] Run focused tests. Expected new behavior fails against existing implementation.
- [ ] Implement agenda and overview layout from spec, retaining existing detailed sections.
- [ ] Run focused tests, typecheck/lint and full unit coverage. Expected pass without reduced thresholds.
- [ ] Add authenticated browser journey with owner/peer fixtures, selecting dates by keyboard, task completion and reload, navigation, long text and overflow assertion. Run desktop/phone Chromium/WebKit, inspect screenshots. Expected all pass and scoped cleanup succeeds.
- [ ] Commit. Run final focused task tests, record evidence. Actual Claude and one fresh independent whole-branch review; reproduce and fix important findings, then reverify.
- [ ] Feature PR/CI, develop/release/main CI, exact deployment/alias and live checks. Mark ticket Done only after release verification; retain known human-pilot/runtime-log limits.
