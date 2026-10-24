# PROD-164 — Where documents are used

Replace count-only document usage with a keyboard-accessible action opening a compact list of named application links. Each entry states whether it uses tailored wording or library details, and opens the existing application hub. Existing source files, tailoring, unlink and deletion rules remain intact.

One owner-filtered paginated request sequence per library, joining application/school names and preserving stable link-ID order. No per-document queries, no schema changes. De-duplicate applications defensively; absent school names use Application fallback. No read failure may mean unused.

Initial loading, true empty, failure/retry and refresh states are distinct. Keep loaded links operable while refreshing; label them last-loaded on failure. Refresh on window focus and known evidence mutations; stale request results cannot overwrite newer results. Modal closes with Escape and returns focus to its stable opener, even while a refresh is pending. Delete warning uses unknown state when current usage cannot be established; database constraints remain authoritative.

Verify service pagination/error/owner filters, modal navigation/tailoring/empty/retry/focus, refresh races, and actual desktop/phone two-application usage with unlink and injected read failure. No real student pilot claim.
