# CAAT V2 — Full Security Audit Report

**Date:** 2026-04-17
**Scope:** Full codebase — `caat-frontend/` (Next.js 15 + Supabase)
**Branch:** `main` (latest)

---

## Executive Summary

The CAAT V2 application follows a **client-only architecture** — all data mutations go directly from the browser to Supabase via the JS SDK. There are **zero API routes** and **zero server actions**. This means the entire security model rests on Supabase Row Level Security (RLS) policies, with no server-side defence-in-depth layer for input validation, rate limiting, or business logic enforcement.

The audit identified **28 unique findings**: **8 Critical/High**, **11 Medium**, and **9 Low**.

---

## Table of Contents

1. [Findings by Category](#findings-by-category)
   - [A. Cross-Site Scripting (XSS)](#a-cross-site-scripting-xss)
   - [B. Insecure Direct Object References (IDOR)](#b-insecure-direct-object-references-idor)
   - [C. Query / Filter Injection](#c-query--filter-injection)
   - [D. Authentication & Session Management](#d-authentication--session-management)
   - [E. File Upload & Storage Security](#e-file-upload--storage-security)
   - [F. Input Validation & Data Limits](#f-input-validation--data-limits)
   - [G. Rate Limiting & Abuse Prevention](#g-rate-limiting--abuse-prevention)
   - [H. Security Headers & Configuration](#h-security-headers--configuration)
   - [I. Information Leakage](#i-information-leakage)
   - [J. Dependency & Secrets Management](#j-dependency--secrets-management)
2. [Summary Matrix](#summary-matrix)
3. [Recommended Remediation Steps](#recommended-remediation-steps)

---

## Findings by Category

---

### A. Cross-Site Scripting (XSS)

#### A1 — Stored XSS via `dangerouslySetInnerHTML` in Resume Preview

| Field | Detail |
|-------|--------|
| **Severity** | **HIGH** |
| **Files** | `components/resume-builder/ResumePreviewPanel.tsx:257` |
| **Description** | The `ResumePage` component renders `section.htmlBlocks` directly via `dangerouslySetInnerHTML={{ __html: html }}`. This HTML is built by guided editors (`ExperienceGuided.tsx`, `EducationGuided.tsx`) through **raw string concatenation** of user input — company names, titles, bullet points, institution names — without HTML-escaping. |
| **Evidence** | `ExperienceGuided.tsx:42` — `lines.push(\`<p><strong>${e.company}</strong>${e.title ? \` — ${e.title}\` : ""}</p>\`);` |
| **Impact** | A user could inject `<img src=x onerror=alert(document.cookie)>` into a resume field. The payload is stored in the `resume_sections` table and rendered unsanitised. If resumes are ever shared (e.g. with counsellors), this becomes a full stored XSS attack. Even in single-user mode, it could be exploited via CSRF-style content injection. |

#### A2 — Additional `innerHTML` Assignments for DOM Measurement

| Field | Detail |
|-------|--------|
| **Severity** | **HIGH** |
| **Files** | `ResumePreviewPanel.tsx:60,402` · `ResumePreviewMini.tsx:48,194` |
| **Description** | The `getTopLevelBlocks` and `createMeasureNode` helper functions set `container.innerHTML = html` for page-break measurement. This parses the same unsanitised user HTML, creating additional XSS execution points beyond the visible preview. |

#### A3 — `javascript:` Protocol URLs in Href Attributes

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `schools/page.tsx:164` · `schools/[id]/page.tsx:89` · `scholarships/my-scholarships-panel.tsx:631` · `components/profile/PersonalInfoCard.tsx` (LinkedIn/GitHub fields) |
| **Description** | User-provided or database-sourced URLs are rendered directly in `<a href={...}>` without protocol validation. A `javascript:alert(1)` value would execute on click. The scholarship `external_url` field is fully user-controlled. Profile URL fields use `type="text"` (not `type="url"`), providing no browser-level validation. |
| **Impact** | Self-XSS for user-created scholarships; broader risk if school data is ever user-contributed or imported without validation. |

---

### B. Insecure Direct Object References (IDOR)

#### B1 — `deleteSection` Has No User Ownership Check

| Field | Detail |
|-------|--------|
| **Severity** | **HIGH** |
| **Files** | `components/resume-builder/api.ts:213-222` |
| **Description** | Deletes a `resume_sections` row using **only** `.eq("id", sectionId)`. The function calls `requireUserId()` (authentication check) but never uses the returned `userId` to scope the query. |
| **Evidence** | `await supabase.from("resume_sections").delete().eq("id", sectionId);` |
| **Impact** | Any authenticated user can delete any other user's resume section by guessing/knowing the UUID. Severity depends on whether RLS on `resume_sections` enforces ownership through the parent `resumes` table — but application code provides zero defence. |

#### B2 — `deleteResume` Deletes Sections Without User Scope

| Field | Detail |
|-------|--------|
| **Severity** | **HIGH** |
| **Files** | `components/resume-builder/api.ts:225-240` |
| **Description** | When deleting a resume, the function first deletes all sections with `.eq("resume_id", resumeId)` — without verifying that `resumeId` belongs to the current user. The resume itself is then deleted with `.eq("user_id", userId)` (correct), but the sections deletion happens **first** and is unguarded. |
| **Impact** | An attacker could provide another user's `resumeId`. The sections get deleted; the resume delete then fails due to the `user_id` check — leaving the victim's resume empty. |

#### B3 — `saveResumeState` Upserts Sections Without User Ownership Verification

| Field | Detail |
|-------|--------|
| **Severity** | **HIGH** |
| **Files** | `components/resume-builder/api.ts:200-206` |
| **Description** | The section upsert uses `onConflict: "id"` without any user ownership check. An attacker could craft a payload with section IDs belonging to another user's resume. |
| **Evidence** | `await supabase.from("resume_sections").upsert(rows, { onConflict: "id" });` |

#### B4 — `getDocumentSignedUrl` Has No User Ownership Check

| Field | Detail |
|-------|--------|
| **Severity** | **HIGH** |
| **Files** | `app/(main)/documents/api.ts:163-172` |
| **Description** | Generates a signed URL for **any** storage path without verifying it belongs to the authenticated user. The storage path pattern is predictable: `{user_id}/{category}/{timestamp}_{filename}`. |
| **Impact** | Any authenticated user who knows or guesses another user's storage path can access their private documents (transcripts, identity documents, letters). |

#### B5 — `deleteDocument` and `reuploadDocument` Use Client-Supplied Storage Path

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `app/(main)/documents/api.ts:101-117,119-161` |
| **Description** | Both functions accept a full `DocumentRow` from the client. The storage file removal uses `doc.storage_path` from this client-supplied object — without verifying the path belongs to the current user. The DB operations are properly scoped with `.eq("user_id", ...)`, but the storage removal is not. |
| **Impact** | An attacker could delete another user's files from Supabase storage while the DB operation harmlessly fails/updates nothing. |

---

### C. Query / Filter Injection

#### C1 — PostgREST Filter Injection in School Search

| Field | Detail |
|-------|--------|
| **Severity** | **HIGH** |
| **Files** | `app/(main)/schools/page.tsx:73-74` |
| **Description** | The `searchQuery` from URL params (`?q=`) is interpolated directly into a PostgREST `.or()` filter string without any sanitisation. PostgREST uses `.`, `,`, `(`, `)` as filter syntax delimiters. |
| **Evidence** | `` const orQuery = `name.ilike.${searchQuery}%,name.ilike.% ${searchQuery}%,name.ilike.%(${searchQuery})%`; `` |
| **Impact** | A crafted URL like `/schools?q=foo%25,id.gt.0` injects additional filter clauses. While PostgREST prevents true SQL injection, this allows filter manipulation — potentially exposing data columns, bypassing intended filtering, or causing error messages that leak schema information. |

#### C2 — LIKE Wildcards Not Escaped in Application Search

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | `app/(main)/applications/api.ts:85` |
| **Description** | The `.ilike("name", \`%${query}%\`)` call is properly parameterised by the Supabase SDK, but `%` and `_` characters in the user's query are not escaped, allowing unintended wildcard matching. |

---

### D. Authentication & Session Management

#### D1 — Bookmark Buttons Use `getSession()` Instead of `getUser()`

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `schools/school-bookmark-button.tsx:30` · `scholarships/[id]/bookmark-button.tsx:21` · `majors/[id]/bookmark-button.tsx:19` |
| **Description** | Per Supabase's own security advisory, `getSession()` reads the JWT from local storage **without server-side verification**. A tampered JWT could return a spoofed `user.id`. The returned `userId` is then used in `.eq("user_id", userId)` and `.upsert()` queries. Should use `getUser()` which validates the token against the Supabase Auth server. |

#### D2 — All Mutations Run Client-Side With No Server-Side Layer

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** (architectural) |
| **Files** | `src/lib/supabaseClient.ts` + all `api.ts` files |
| **Description** | There is only ONE Supabase client (browser, anon key). Zero API routes, zero server actions. All CRUD happens from the browser. The entire security model depends 100% on Supabase RLS. Any user with browser DevTools can craft arbitrary Supabase queries. |

#### D3 — Browser Supabase Client Used in Server Component

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | `app/(main)/schools/page.tsx:1,63` |
| **Description** | The `SchoolsPage` is a server component that imports `createBrowserClient`. The browser client is designed for client-side use (reads `document.cookie`). This works because the `schools` table is likely public-read, but it's architecturally incorrect and sets a bad precedent. |

#### D4 — `updateProfile` Accepts Partial Fields — Potential Mass Assignment

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `app/(main)/profile/api.ts:59-76` |
| **Description** | Accepts `Partial<Omit<ProfileRow, "id">>` and passes it directly to `.update(fields)`. Since calls originate from client-side code, an attacker could include fields that should not be user-modifiable (e.g., `role`, `is_admin`, if they exist on the profiles table). |

---

### E. File Upload & Storage Security

#### E1 — File Type Validation is Client-Side Only

| Field | Detail |
|-------|--------|
| **Severity** | **HIGH** |
| **Files** | `documents/client.tsx:324-335` · `documents/api.ts:52-55` · `components/profile/AvatarUpload.tsx:41-44` |
| **Description** | Document uploads validate extensions (`pdf, jpg, jpeg, png`) and MIME types only in client JavaScript. The `uploadDocument` API function passes `file.type` (browser-reported) to Supabase storage without server-side validation. An attacker can bypass client checks via DevTools/curl and upload arbitrary file types (`.html`, `.svg` with embedded scripts, executables). |
| **Impact** | An attacker could upload a malicious HTML/SVG file. When any user opens the signed URL, the browser renders it — executing embedded JavaScript. This is a **stored XSS vector through file upload**. |

#### E2 — File Size Validation is Client-Side Only

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | Same as E1 |
| **Description** | The 10MB limit for documents and 5MB limit for avatars are enforced only in client JavaScript. An attacker bypassing the client can upload files of any size (up to Supabase's own limits). |

#### E3 — No Limit on Total Number of Uploaded Documents

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `app/(main)/documents/api.ts` |
| **Description** | No check on the count of existing documents before allowing another upload. A user could upload thousands of documents, exhausting storage. |

#### E4 — Avatar Upload Publicly Accessible With No Content Validation

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `components/profile/AvatarUpload.tsx:57` |
| **Description** | Uses `getPublicUrl()` — meaning the `profile-avatars` bucket is publicly readable. Combined with client-only MIME type validation, an attacker could upload an HTML file as their "avatar" and share the public URL as a phishing/XSS vector. |

#### E5 — Supabase Storage Bucket Policies Not Visible in Code

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Description** | No storage bucket RLS policies exist in the codebase. Security depends entirely on Supabase dashboard configuration, which cannot be audited from code alone. Needs manual verification. |

---

### F. Input Validation & Data Limits

#### F1 — No Input Length Validation on Any Form Field

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | All form components (see list below) |
| **Description** | The **only** input constraints in the entire application are `minLength={8}` on the signup password and `min`/`max` on the graduation year number. Every other field — names, notes, descriptions, URLs, phone numbers, activities, essay content, resume content, todo items, application notes — accepts **unlimited-length input**. There is no server-side validation either. |
| **Affected components** | `PersonalInfoCard.tsx`, `AcademicProfileCard.tsx`, `ExtracurricularsCard.tsx`, `InterestsGoalsCard.tsx`, `RecommendersCard.tsx`, `StandardisedTestingCard.tsx`, `EssaysShell.tsx`, `applications/client.tsx`, `my-scholarships-panel.tsx`, `TodoWidget.tsx`, `ExperienceGuided.tsx`, `EducationGuided.tsx` |
| **Impact** | A user can submit megabytes of text into any field, causing database bloat, rendering performance issues, and potential denial of service. |

#### F2 — Zod Installed but Never Used

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `package.json` |
| **Description** | Zod v4 is listed as a dependency but is never imported anywhere in the application. All data flows from form state directly to Supabase `.insert()` / `.update()` calls without any schema validation. Invalid data types, excessively long strings, or unexpected formats can be written to the database. |

#### F3 — No Limit on Data Record Creation

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | All `api.ts` files |
| **Description** | There are no limits on how many bookmarks, applications, todos, essay drafts, resumes, scholarships, or recommenders a user can create. A malicious user could create thousands of records per table. |

---

### G. Rate Limiting & Abuse Prevention

#### G1 — Zero Rate Limiting Anywhere in the Application

| Field | Detail |
|-------|--------|
| **Severity** | **HIGH** |
| **Files** | Entire application |
| **Description** | There are no API routes, no server-side middleware, and no rate limiting of any kind. All operations go directly to Supabase. There is: |
| | • No rate limiting on login attempts (`signInWithPassword`) |
| | • No rate limiting on signup (`signUp`) |
| | • No rate limiting on password reset (`resetPasswordForEmail`) |
| | • No rate limiting on data creation operations |
| | • No CAPTCHA or anti-automation on any form |
| **Impact** | An attacker could brute-force login credentials (limited only by Supabase GoTrue defaults), spam password reset emails, enumerate valid email addresses, or flood the database with junk data. |

---

### H. Security Headers & Configuration

#### H1 — Missing `Content-Security-Policy` Header

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `next.config.ts` |
| **Description** | The security headers include `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` — which is good. But there is **no CSP header**. Given the `dangerouslySetInnerHTML` usage (Finding A1), a CSP would significantly limit the blast radius of any XSS. |

#### H2 — Missing `Strict-Transport-Security` (HSTS) Header

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `next.config.ts` |
| **Description** | No HSTS header. Users could be vulnerable to SSL stripping attacks on first visit. |

#### H3 — No CSRF Protection Mechanism

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Description** | Since all mutations go directly to Supabase (not through Next.js), CSRF protection relies on Supabase's `httpOnly` cookies with `SameSite` attributes. This is reasonable in modern browsers but there is no explicit CSRF token mechanism. |

#### H4 — Source Maps Not Explicitly Disabled

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | `next.config.ts` |
| **Description** | `productionBrowserSourceMaps` is not explicitly set to `false`. Next.js defaults to not exposing them, but explicit is better for defence-in-depth. |

---

### I. Information Leakage

#### I1 — Raw Supabase Error Messages Shown to Users

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `schools/page.tsx:89` · `scholarships/page.tsx:18` · `majors/page.tsx:21` |
| **Description** | Multiple pages render `error.message` from Supabase directly in the UI. These messages can leak table names, column names, RLS policy details, and constraint names. |

#### I2 — `console.error` Leaks Full Error Objects in Production

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | Multiple (`error.tsx`, `ResumeBuilderShell.tsx`, `AvatarUpload.tsx`, `DashboardShell.tsx`, `profile/page.tsx`) |
| **Description** | `console.error(error)` calls log full error objects (including stack traces and Supabase internal details) to the browser console in production. |

#### I3 — Overly Broad `.select("*")` Queries

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | Multiple API files |
| **Description** | Many queries use `.select("*")` on public tables. If new sensitive columns are added in the future, they would be automatically exposed to the frontend. |

---

### J. Dependency & Secrets Management

#### J1 — Test Credentials Hardcoded in E2E Setup

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | `tests/e2e/auth.setup.ts:11-12` |
| **Evidence** | `const TEST_EMAIL = "test@gmail.com"; const TEST_PASSWORD = "testtest123";` |
| **Description** | If this test account exists in production Supabase, anyone reading the repo has valid credentials. The `tests/` directory is not excluded from git. |

#### J2 — Environment Files Properly Excluded (Positive Finding)

| **Severity** | **N/A — GOOD** |
|-------|--------|
| Both `.gitignore` files exclude `.env*`. Only `NEXT_PUBLIC_` variables (anon key, URL) are exposed — this is correct. No service_role key exists anywhere in the codebase. |

#### J3 — Open Redirect Protection (Positive Finding)

| **Severity** | **N/A — GOOD** |
|-------|--------|
| The login form validates the `next` redirect parameter against `window.location.origin`, correctly preventing open redirects. |

---

## Summary Matrix

| ID | Category | Severity | Finding |
|----|----------|----------|---------|
| A1 | XSS | **HIGH** | Stored XSS via `dangerouslySetInnerHTML` in resume preview |
| A2 | XSS | **HIGH** | Additional `innerHTML` assignments for DOM measurement |
| A3 | XSS | MEDIUM | `javascript:` protocol URLs in href attributes |
| B1 | IDOR | **HIGH** | `deleteSection` has no user ownership check |
| B2 | IDOR | **HIGH** | `deleteResume` deletes sections without user scope |
| B3 | IDOR | **HIGH** | `saveResumeState` upserts sections without ownership check |
| B4 | IDOR | **HIGH** | `getDocumentSignedUrl` has no user ownership check |
| B5 | IDOR | MEDIUM | `deleteDocument`/`reuploadDocument` use client-supplied storage path |
| C1 | Injection | **HIGH** | PostgREST filter injection in school search |
| C2 | Injection | LOW | LIKE wildcards not escaped in application search |
| D1 | Auth | MEDIUM | Bookmark buttons use `getSession()` instead of `getUser()` |
| D2 | Auth | MEDIUM | All mutations run client-side, no server-side layer |
| D3 | Auth | LOW | Browser Supabase client used in server component |
| D4 | Auth | MEDIUM | `updateProfile` mass assignment risk |
| E1 | Upload | **HIGH** | File type validation is client-side only |
| E2 | Upload | MEDIUM | File size validation is client-side only |
| E3 | Upload | MEDIUM | No limit on total uploaded documents |
| E4 | Upload | MEDIUM | Avatar upload publicly accessible, no content validation |
| E5 | Upload | MEDIUM | Storage bucket policies not verifiable from code |
| F1 | Validation | MEDIUM | No input length validation on any form field |
| F2 | Validation | MEDIUM | Zod installed but never used |
| F3 | Validation | MEDIUM | No limit on data record creation |
| G1 | Rate Limit | **HIGH** | Zero rate limiting anywhere |
| H1 | Headers | MEDIUM | Missing Content-Security-Policy |
| H2 | Headers | MEDIUM | Missing Strict-Transport-Security |
| H3 | Headers | LOW | No explicit CSRF protection |
| H4 | Headers | LOW | Source maps not explicitly disabled |
| I1 | Leakage | MEDIUM | Raw Supabase errors shown to users |
| I2 | Leakage | LOW | `console.error` leaks details in production |
| I3 | Leakage | LOW | Overly broad `.select("*")` queries |
| J1 | Secrets | LOW | Test credentials hardcoded in E2E |

**Totals: 8 High · 14 Medium · 8 Low**

---

## Recommended Remediation Steps

### Priority 1 — Critical / High (address immediately)

#### 1a. Sanitise all HTML before rendering (A1, A2)
- Install `DOMPurify` and wrap every `dangerouslySetInnerHTML` and `innerHTML` assignment.
- In the guided editors (`ExperienceGuided.tsx`, `EducationGuided.tsx`), HTML-escape all user input before embedding in HTML strings. Create a shared `escapeHtml()` utility.
- Example: `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}`

#### 1b. Add user ownership checks to all resume section operations (B1, B2, B3)
- For `deleteSection`: query the section's parent `resume` first and verify `resume.user_id === userId`, OR add a `user_id` column to `resume_sections` and filter on it.
- For `deleteResume`: scope the section deletion with a subquery or verify ownership first.
- For `saveResumeState`: verify each section ID belongs to a resume owned by the current user before upserting.
- Additionally: **verify that Supabase RLS policies on `resume_sections` enforce ownership** through the parent `resumes` table. Do not rely solely on application code.

#### 1c. Add user ownership check to `getDocumentSignedUrl` (B4)
- Before generating a signed URL, verify the storage path starts with `${user.id}/` — or look up the document row first and confirm `user_id` matches.

#### 1d. Sanitise PostgREST filter input (C1)
- Escape PostgREST special characters (`.`, `,`, `(`, `)`) in `searchQuery` before interpolating, OR rewrite the school search to use multiple `.ilike()` calls instead of raw `.or()` string interpolation.

#### 1e. Add server-side file upload validation (E1)
- Create a Next.js API route or Supabase Edge Function that validates file type (by magic bytes, not just extension/MIME), file size, and filename before uploading to storage.
- Alternatively, configure Supabase Storage bucket policies to restrict allowed MIME types.
- Set `Content-Disposition: attachment` on document signed URLs to prevent browser rendering of uploaded HTML/SVG.

#### 1f. Implement rate limiting (G1)
- Add Next.js API route handlers for sensitive operations (login, signup, password reset) and apply rate limiting (e.g., `next-rate-limit`, Vercel Edge Middleware rate limits, or Upstash Redis).
- Configure Supabase Auth rate limits more aggressively in the Supabase dashboard.
- Add CAPTCHA (e.g., Cloudflare Turnstile) to login, signup, and password reset forms.

### Priority 2 — Medium (address in next sprint)

#### 2a. Replace `getSession()` with `getUser()` (D1)
- In all three bookmark button components, switch from `supabase.auth.getSession()` to `supabase.auth.getUser()` for server-validated user identity.

#### 2b. Add input validation with Zod (F1, F2)
- Create Zod schemas for every data model (profile, application, essay, resume section, scholarship, recommender, todo).
- Validate all data before database writes. Add `maxLength` constraints to all text inputs (both UI and schema).
- Suggested limits: names 100 chars, notes/descriptions 5000 chars, essay content 50000 chars, URLs 2048 chars.

#### 2c. Validate URL protocols (A3)
- Create a `safeHref()` utility that only allows `http:` and `https:` protocols. Apply to all `<a href={...}>` that render user-provided or database-sourced URLs.

#### 2d. Add record count limits (F3, E3)
- Implement per-user limits for data creation (e.g., max 50 bookmarks, max 20 applications, max 100 documents, max 10 resumes).
- Enforce in Supabase via RLS policies with row-count subqueries, or in a server-side API layer.

#### 2e. Fix storage path trust issues (B5)
- In `deleteDocument` and `reuploadDocument`, look up the document's `storage_path` from the database (scoped to `user_id`) rather than trusting the client-supplied object.

#### 2f. Whitelist fields in `updateProfile` (D4)
- Explicitly pick only allowed fields from the input object before passing to `.update()`. Do not pass arbitrary client-provided fields to the database.

#### 2g. Add security headers (H1, H2)
- Add `Content-Security-Policy` to `next.config.ts`. Start with: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://<your-supabase-url>.supabase.co data:; connect-src 'self' https://<your-supabase-url>.supabase.co`
- Add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

#### 2h. Sanitise error messages (I1)
- Display a generic "Something went wrong" message to users. Log the full Supabase error server-side or to an error reporting service (Sentry, etc.).

#### 2i. Verify Supabase storage bucket policies (E4, E5)
- In the Supabase dashboard, verify that `user-documents` bucket has RLS restricting access to the owning user's folder.
- Confirm that `profile-avatars` being public is intentional and that upload types are restricted.
- Add server-side file size limits in bucket policies.

### Priority 3 — Low (address when convenient)

#### 3a. Move test credentials to env vars (J1)
- Replace hardcoded `test@gmail.com` / `testtest123` with `process.env.TEST_EMAIL` / `process.env.TEST_PASSWORD`.

#### 3b. Use a server Supabase client in server components (D3)
- Create a server-side Supabase client using `createServerClient` for use in server components like `schools/page.tsx`.

#### 3c. Replace `.select("*")` with explicit column lists (I3)
- Audit all queries and specify only the columns needed by the frontend.

#### 3d. Remove `console.error` in production (I2)
- Use `process.env.NODE_ENV` guards or replace with a proper error reporting service.

#### 3e. Explicitly disable source maps (H4)
- Add `productionBrowserSourceMaps: false` to `next.config.ts`.

#### 3f. Escape LIKE wildcards in search (C2)
- Escape `%` and `_` in user search input before passing to `.ilike()`.

---

### Architectural Recommendation

The single most impactful long-term improvement is to **introduce a server-side layer** (Next.js API routes or Server Actions) between the browser and Supabase for all write operations. This would enable:

- Server-side input validation (Zod schemas)
- Rate limiting per endpoint
- Business logic enforcement (record limits, field whitelisting)
- Defence-in-depth beyond RLS alone
- Proper error sanitisation before returning to the client

This doesn't need to happen all at once — start with the most sensitive operations (auth, document uploads, resume mutations) and expand incrementally.
