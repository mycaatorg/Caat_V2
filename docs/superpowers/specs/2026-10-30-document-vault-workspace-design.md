# Document Vault workspace (PROD-222)

Students need to locate a particular file, find review requests, and use document actions on a phone without scrolling a desktop table sideways. Build on existing Next/React/Supabase components and keep storage/review permissions unchanged.

Use complete owner-filtered reads for both server first paint and client recovery. Stable uploaded_at descending/id ascending pagination must continue beyond short API pages; a later error publishes no partial list. Shared reader avoids server/client disagreement.

Add case-insensitive filename search, existing category controls, status filter (All, Pending review, Verified, Needs attention), and sort (Newest uploaded default, Oldest uploaded, Name). Compose filters and sort before existing eight-row pagination; filter changes reset page1, deletion still clamps page. Reset restores all controls. Show matching/total counts only after a complete read, distinguish no files from no matches, hide unknown counts on loading/error.

One responsive DOM: desktop retains aligned columns; phone rows become document cards with wrapped names, labelled date and reachable existing actions. Preserve preview, usage, upload/replacement/delete dialogs and failure recovery. No duplicated menus/dialogs or student-editable review status. Category controls wrap instead of forcing sideways navigation.

Prevent creation while initial load is in flight so a late read cannot erase the new row. Preserve existing recovery that allows upload after a failed load and then reloads the complete list. School-linked auto-open may show its draft but cannot submit during loading. Ignore stale read completions after unmount/new request.

No schema/environment/dependency changes. Unit regressions, real local desktop/Android/iPhone workflows with failures and overflow checks, actual Claude and independent review, hosted normal/low-cap gates and production verification. Human/AT pilot remains separate.
