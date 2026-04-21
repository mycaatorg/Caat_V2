# `CAAT V2 — Remaining Vulnerabilities: Unified Remediation Plan

**Date:** 2026-04-18
**Scope:** All vulnerabilities skipped across the three fix rounds (High / Medium / Low)

---

## Summary of Remaining Vulnerabilities

| ID | Severity | Finding |
|----|----------|---------|
| G1 | High | Zero rate limiting anywhere in the application |
| D2 | Medium | All mutations run client-side, no server-side enforcement layer |
| E2 | Medium | File size validation is client-side only |
| E5 | Medium | Storage bucket policies not verifiable from code |
| F1 | Medium | No input length validation on any form field |
| F2 | Medium | Zod installed but never used |
| F3 | Medium | No limit on data record creation |
| D3 | Low | Browser Supabase client used in server components |
| H3 | Low | No explicit CSRF protection mechanism |
| I3 | Low | Overly broad `.select("*")` queries |

---

## Root Cause Analysis

Before planning individual fixes, it helps to see why these were all skipped: they share the same underlying gaps.

```
Gap A — No server-side layer for writes
  Causes: G1 (can't rate-limit), D2 (no enforcement point), E2 (can't validate
          server-side), F3 (can't count records server-side)

Gap B — No schema definitions for data models
  Causes: F1 (no length constraints), F2 (Zod unused), I3 (no column reference)

Gap C — Wrong Supabase client in server-side code
  Causes: D3 (browser client in server component)
  Note:   This is also a prerequisite for fixing Gap A correctly.

Dashboard config only (not code):
  E5 — storage bucket policies
  H3 — CSRF (SameSite cookies already handles this — no action needed)
```

Gaps A and B are related: schemas (Gap B) feed directly into the server layer (Gap A) as the validation logic. Gap C is a prerequisite for Gap A. This means all 8 remaining code vulnerabilities can be addressed with **three ordered building blocks**.

---

## The Unified Approach: Three Building Blocks

### Why Server Actions, not API routes

The natural fix for Gap A is to introduce a server-side layer. The options are:

- **API Routes** (`app/api/...`): New routing infrastructure, HTTP concerns bleed into business logic, clients need to manage fetch calls.
- **Server Actions** (`"use server"` functions): Called like regular `async` functions from client components, no new routing, type-safe by default, native to Next.js 15 App Router.

Server Actions are the minimal fit. They slot into the existing call patterns — the client components already call `await uploadDocument(file, category)`. That call site doesn't change; only what runs on the other side of it does.

**What stays direct browser→Supabase (no change):**
- All reads (schools, scholarships, majors, resume loading, profile fetching)
- Mutations with no enforcement requirements (resume content autosave, profile field updates, bookmark toggles — already guarded by RLS + the fixes already applied)

**What moves to Server Actions:**
- File uploads (validates size server-side, moves storage call server-side)
- Record creation operations that need count limits
- Auth form submissions that need rate limiting

---

### Building Block 1 — Server Supabase Client Utility

**Fixes: D3**
**Prerequisite for: Building Block 3 (Server Actions)**

Create one file: `caat-frontend/lib/supabase-server.ts`

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies are read-only, ignore.
          }
        },
      },
    }
  );
}
```

Then in any server component (e.g. `schools/page.tsx`), replace the browser client import:

```ts
// Before
import { supabase } from "@/src/lib/supabaseClient";

// After
import { createSupabaseServer } from "@/lib/supabase-server";
const supabase = createSupabaseServer();
```

This is a standalone ~20-line change with no side effects on existing functionality.

---

### Building Block 2 — Zod Schemas for All Data Models

**Fixes: F1 (length limits), F2 (Zod actually used), I3 (explicit column reference)**
**Prerequisite for: Building Block 3 (validation inside Server Actions)**

Create a `caat-frontend/lib/schemas/` directory with one schema file per domain. Each schema serves three purposes simultaneously:
1. **Server-side validation** — parsed inside Server Actions before any DB write
2. **Client-side `maxLength`** — schema's `.max()` values populate `<Input maxLength={...}>` directly (no separate constants needed)
3. **Column reference for I3** — each schema's keys list exactly what fields are read from the DB, eliminating guesswork from changing `.select("*")`

**Schemas to create:**

| File | Covers |
|------|--------|
| `lib/schemas/profile.ts` | ProfileRow fields, lengths for name/phone/URL fields |
| `lib/schemas/application.ts` | Application status, notes, dates |
| `lib/schemas/resume-section.ts` | Section content, labels |
| `lib/schemas/user-scholarship.ts` | Scholarship name, amount, deadline, URL, notes |
| `lib/schemas/essay.ts` | Essay title and content |
| `lib/schemas/todo.ts` | Todo title and notes |
| `lib/schemas/recommender.ts` | Name, subject, notes |
| `lib/schemas/document.ts` | Category enum, MIME type allowlist, size limit constant |

**Suggested length limits (based on common sense for a college tracking app):**

```ts
// Example: lib/schemas/profile.ts
import { z } from "zod";

export const ProfileSchema = z.object({
  first_name:       z.string().max(100).nullable(),
  last_name:        z.string().max(100).nullable(),
  email:            z.string().email().max(254).nullable(),
  birth_date:       z.string().nullable(),
  phone:            z.string().max(30).nullable(),
  linkedin:         z.string().max(2048).nullable(),
  github:           z.string().max(2048).nullable(),
  nationality:      z.string().max(100).nullable(),
  current_location: z.string().max(200).nullable(),
  school_name:      z.string().max(200).nullable(),
  curriculum:       z.string().max(100).nullable(),
  graduation_year:  z.number().int().min(2000).max(2040).nullable(),
  target_majors:    z.array(z.string().max(100)).max(20).nullable(),
  preferred_countries: z.array(z.string().max(100)).max(20).nullable(),
  activities:       z.array(z.string().max(500)).max(50).nullable(),
  default_resume_id: z.string().uuid().nullable(),
});

// Export column list for .select() — fixes I3 automatically
export const PROFILE_COLUMNS = Object.keys(ProfileSchema.shape).join(", ");
```

The `PROFILE_COLUMNS` export is the key I3 fix: instead of `.select("*")`, every query becomes `.select(PROFILE_COLUMNS)`. The schema is the single source of truth — add a field to the schema, it appears in the select automatically.

---

### Building Block 3 — Server Actions for Enforced Writes

**Fixes: G1 (rate limiting), D2 (server-side enforcement), E2 (server-side file size), F3 (record limits)**
**Depends on: Building Blocks 1 and 2**

Create `caat-frontend/app/actions/` with Server Action files. The existing `api.ts` client functions remain unchanged and continue to work — they're called from the same places, just the target changes to the new Server Actions for the specific operations that need enforcement.

**Rate limiting setup (for G1):**

Use `@upstash/ratelimit` + `@upstash/redis` (serverless-compatible, no always-on server needed). One utility:

```ts
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv(); // Reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 attempts per 15 minutes
});

export const uploadRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 h"), // 20 uploads per hour
});

export const createRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 h"), // 60 record creations per hour
});
```

**Server Actions to create:**

```
app/actions/
  auth.ts        — login, signup, password reset (rate limited with authRateLimit)
  documents.ts   — uploadDocument, reuploadDocument (size check + uploadRateLimit)
  records.ts     — createResume, addApplication, addBookmark (count check + createRateLimit)
```

**Structure of each Server Action (pattern):**

```ts
// app/actions/documents.ts
"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { authRateLimit, uploadRateLimit } from "@/lib/rate-limit";
import { DocumentUploadSchema } from "@/lib/schemas/document";
import { headers } from "next/headers";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadDocumentAction(formData: FormData) {
  // 1. Rate limit by IP
  const ip = (await headers()).get("x-forwarded-for") ?? "unknown";
  const { success } = await uploadRateLimit.limit(ip);
  if (!success) throw new Error("Too many uploads. Please wait and try again.");

  // 2. Auth check
  const supabase = createSupabaseServer();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error("Not authenticated");

  // 3. Server-side file size check (E2)
  const file = formData.get("file") as File;
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error("File exceeds 10 MB limit.");

  // 4. Schema validation (F1, F2)
  const category = DocumentUploadSchema.shape.category.parse(formData.get("category"));

  // 5. Count check (F3 — already in api.ts but now enforced server-side)
  // ... rest of upload logic
}
```

**Per-user record limits for F3:**

| Record type | Suggested limit | Rationale |
|-------------|----------------|-----------|
| Documents | 50 (already enforced client-side) | Storage cost |
| Resumes | 10 | Reasonable for a student |
| Applications | 100 | Can apply to many schools |
| Bookmarks (per table) | 200 | Discovery feature |
| Todos | 500 | Task management |
| Essay drafts | 30 | Multiple versions per app |
| Recommenders | 15 | Academic context |

**Env vars needed (add to `.env.local` and production env):**
```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Upstash has a free tier covering ~10k requests/day which is more than sufficient for this app's scale.

---

## Building Block 4 — Supabase Dashboard (E5)

Not fixable from code. Manual checklist:

**`user-documents` bucket:**
- [ ] RLS enabled
- [ ] Users can only `SELECT`/`INSERT`/`DELETE` objects where `(storage.foldername(name))[1] = auth.uid()::text`
- [ ] Max upload size set (e.g. 10 MB) in bucket settings

**`profile-avatars` bucket:**
- [ ] Public read is intentional — confirm this is acceptable
- [ ] Write restricted to authenticated users uploading to their own `{user_id}/` path
- [ ] Max upload size set (e.g. 5 MB)

**H3 — CSRF:**
No action needed. Supabase Auth uses `httpOnly` cookies with `SameSite=Lax`, which is the accepted browser-standard CSRF defence. Modern browsers enforce this by default.

---

## Recommended Implementation Order

The dependencies flow cleanly from top to bottom:

```
Step 1 — lib/supabase-server.ts          (D3, ~20 lines, no risk)
          ↓
Step 2 — lib/schemas/*.ts                (F1, F2, ~150 lines total across 8 files)
          ↓
Step 3 — Apply maxLength to form inputs  (F1 UX half, mechanical change using schema values)
          ↓
Step 4 — Update .select("*") calls       (I3, mechanical, use SCHEMA_COLUMNS exports)
          ↓
Step 5 — lib/rate-limit.ts + Upstash     (G1 prerequisite, set up Redis)
          ↓
Step 6 — app/actions/ Server Actions     (D2, G1, E2, F3 — the main lift)
          ↓
Step 7 — Supabase dashboard bucket       (E5 — independent, do any time)
          config checklist
```

Steps 1–4 are all low-risk, self-contained, and can be reviewed and merged independently. They also immediately deliver partial value (schemas used client-side for F1 and I3 before Server Actions are wired). Step 6 is the significant effort but is fully de-risked by having the schemas and server client already in place.

**Nothing from the existing codebase needs to be deleted or restructured.** The existing `api.ts` client functions remain as-is. Server Actions are an additive layer that the most sensitive write call sites swap to; the rest continue working unchanged.
