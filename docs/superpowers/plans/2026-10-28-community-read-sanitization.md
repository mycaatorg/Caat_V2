# Community stored HTML read-safety plan

> **For agentic workers:** Use superpowers:executing-plans inline and one fresh final review.

**Goal:** Community post rendering stays safe for legacy/direct-REST HTML that never passed the normal editor's sanitizer.
**Architecture:** Use the existing server-side allow-list on rich content inside shared enrichPosts. Preserve plain text unchanged for the existing client escape/newline renderer. All feed/detail/saved/group paths already use enrichment. No DB migration or permission changes.
**Tech Stack:** Next.js server actions, existing sanitize-html, Vitest, isolated Playwright/Supabase.
**Spec:** PROD-197, urgent read-boundary gap discovered during PROD-187 audit; user authorizes autonomous reviewed fixes.

## Constraints / review focus
- Untrusted stored markup, event handlers and unsafe URLs must not reach the HTML renderer.
- Preserve permitted formatting and safe link attributes.
- Preserve legacy ampersands, less-than text and newlines without double escaping.
- No production unsafe-markup probes; local synthetic rows only.
- Keep sanitizer out of the client bundle; preserve RLS, anonymity and narrow DTO.

## Task 1
- [x] Add enrichment/render unit cases for unsafe stored HTML, permitted rich formatting/links and legacy plain text; observe unsafe case RED.
- [x] Add isolated browser journey inserting harmless handler-marker HTML via authenticated REST; assert no unsafe tags/handlers or execution while safe formatting survives; clean exact post.
- [x] Apply existing server sanitizer only to HTML-looking stored content in enrichPosts and correct obsolete trust comments.
- [x] Run focused/full units, typecheck/lint and desktop/phone Chromium/WebKit journey; review screenshots.
- [ ] Actual Claude and independent review, then CI and normal develop/main release gates; verify live deployment and auth health.

Review resolution: unsupported wrappers can sanitize to entity-encoded tagless text. Preserve rich representation with a safe paragraph wrapper only in that case; actual renderer regression observed RED then GREEN. Claude confirmed comments use escaped React text. Final local suite: 1,335 units, typecheck, lint without errors, three cross-user desktop/phone browser journeys. Review/release evidence retained under ignored `.superpowers/sdd/2026-10-28-community-read-sanitization/`.
