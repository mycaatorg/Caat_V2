# M2 — First useful Australian plan (design)

Branch `feat/caat-m2-australian-plan`, built for review; not merged or released. Tickets PROD-71, 72, 73, 74.

## Who and what problem

A Year 10–12 student in Australia, planning for an Australian university, usually starting from "which scholarships could I get?". Today a new account lands on a dashboard of empty boxes: a three-item setup card, an empty applications rollup, and an empty, configurable widget grid. Navigation lists eleven tools with equal weight. Nothing answers "what should I do next?", and the public site speaks to US college applicants (Stanford, Yale, "college application").

M2 succeeds when a new student, in a few minutes and without a long profile, ends with one saved scholarship or university and a clear next step, and every later visit opens on what needs doing.

## Owner decisions

1. **Today replaces the dashboard as home** at a new `/today` route. Sign-in, the logo and the root redirect go there. `/dashboard` (the customisable widget grid) stays as is and remains reachable from the account menu and "More tools", so no saved widget layout is lost and no URL breaks.
2. **Navigation is four primary destinations plus a workspace.** Today, Explore (Scholarships, Universities, Courses), My shortlist, My applications. Workspace: Essays, Documents, Resume. Community keeps its group. Profile and settings live in the account menu. Every old URL keeps working; labels change only where the audience needs it ("Schools" → "Universities", "Majors" → "Courses").
3. **My shortlist is one page** (`/shortlist`) for everything a student has saved: tracked scholarships, bookmarked universities and courses, each with its next action. It reads the existing bookmark tables; no data moves.
4. **Onboarding is five short questions, all skippable**, then a discovery step that saves a first item. Answers persist step by step, so leaving halfway keeps progress. Existing students are never forced through it; Today offers it once as a dismissible card if their profile lacks the basics.
5. **No invented urgency.** Today shows real deadlines, real missing items from the readiness rules students already see on the application hub, and the student's own to-dos. No streaks, no generic completion percentages.
6. **Copy is Australian and honest.** Universities and courses, ATAR-era timing, AUD, UAC/VTAC/QTAC/SATAC/TISC named only as official destinations CAAT does not submit to. Illustrative examples are labelled as examples. Claims (catalogue size, security) are only kept when verified.

## Information architecture

```
Today            /today                 new home
Explore          Scholarships /scholarships · Universities /schools · Courses /majors
My shortlist     /shortlist             new, aggregates saved items
My applications  /applications
Workspace        Essays · Documents · Resume
Community        Community Campus · Saved posts
Account menu     Profile · Settings · Dashboard (widgets) · Sign out
```

Mobile uses the existing off-canvas sidebar, so the same order applies; Today is designed single-column first.

## Today

Sections, each only shown when it has content (empty states give one starting action):

- **Greeting + next step.** One sentence and one primary button chosen from real state, in order: finish onboarding → save a first scholarship or university → start an application from the shortlist → set a missing deadline → open the nearest deadline.
- **Needs attention.** Concrete tasks derived from data: application without a deadline, application past "researching" with no essay draft for that school, required document categories not uploaded (hub rules), overdue own to-dos. Each links to the exact place to fix it.
- **Coming up.** The next deadlines from the existing unified-deadline feed (applications, tracked scholarships, calendar events), 60 days ahead, with day counts.
- **Pick up where you left off.** The most recently edited essay draft, resume and application, by `updated_at`.
- **Your to-dos.** Open `user_todos`, due-date first, with quick complete.
- **Shortlist snapshot.** Counts and up to three saved items with a link to My shortlist.

Data: existing tables only; one server component fetch per section, no client waterfalls.

## Onboarding (`/welcome`)

Five steps, one question each, progress shown as "2 of 5", Back, Skip and "Not sure" on every step:

1. Year level: Year 10, 11, 12, finished school / gap year, not sure → stored as `year_level` and used to derive `graduation_year` only when the profile has none.
2. Study status: domestic (Australian or New Zealand citizen, or permanent resident), international, not sure → `student_status`.
3. Where to study: Australia (default), other countries chips → `preferred_countries` (merged, never overwritten).
4. Interests: fields of study chips from the courses catalogue → `target_majors` (merged).
5. Stage: just exploring, building a shortlist, preparing applications, applied and waiting → `journey_stage`.

Finish: three to six scholarships matched with the existing scoring, each with Save, plus "Browse all". Saving one completes onboarding and shows its next step ("Check eligibility, then add the deadline"). Completion stamps `onboarding_completed_at`; "Skip for now" stamps `onboarding_dismissed_at` so we never nag.

Schema (additive, nullable, owner-only RLS already covers `profiles`): `year_level text`, `student_status text`, `journey_stage text`, `onboarding_completed_at timestamptz`, `onboarding_dismissed_at timestamptz`. Migration file in `supabase/migrations`, applied to the isolated stack only. **Production needs explicit approval at release time.**

First-use events (Vercel Analytics `track`, no profile values, no essay or document content): `onboarding_started`, `onboarding_step_completed` {step, skipped}, `onboarding_completed`, `first_item_saved` {kind}, `today_next_step_clicked` {kind}.

## Landing and core copy (PROD-71)

Hero for Australian students and universities; feature cards reworded (applications, universities, scholarships, essays, documents); demo examples replaced with clearly illustrative Australian ones; a short "what CAAT does and does not do" note (tracks and prepares; you submit through UAC, VTAC, QTAC, SATAC, TISC or the university). Signup and help wording aligned. Unverified claims narrowed or removed. Brand: serif display with an italic maroon accent word, monospaced uppercase labels, square corners, maroon `#9a1a27`, no em dashes.

## Scholarship search (PROD-72)

Measure first against a representative synthetic catalogue on the isolated stack (thousands of rows), then fix only measured bottlenecks; empty states must offer "Clear filters". If time runs out, record the baseline and the plan.

## Verification

- Unit/component tests for task derivation, next-step choice, onboarding persistence and merge rules, shortlist aggregation, navigation active states.
- Isolated browser journeys: new student onboarding → saved item → Today shows it and its next step; returning student Today with an application missing a deadline → fix → task disappears.
- Screenshots desktop and mobile for Today, shortlist, onboarding steps, landing; keyboard pass on navigation and onboarding.
- Full unit, typecheck, lint, browser suite; independent review before handing over.

## Out of scope for M2

Course-level shortlists with campuses and prerequisites (PROD-76), eligibility explanations (PROD-75), requirement checklists (PROD-77), notifications (PROD-79), sharing (PROD-80).
