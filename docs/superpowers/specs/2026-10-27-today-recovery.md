# Today task recovery — PROD-172

A confirmed missing task remains in the editor with copyable read-only draft text. Save is unavailable. Closing the editor removes only that row from Today, invalidates stale Undo for that row, announces removal, clamps pagination, and focuses a stable labelled Today section/heading. Never replace local completion state with reload/server props. Failed or cancelled reloads never remove a row; a later successful reload clears missing state.

Validation identifies the offending text/date field with aria-invalid/describedby and focuses it. Request failures still focus Save for retry. Save stays focusable while busy with aria-disabled and visibly unavailable styling; existing synchronous duplicate-write guard stays. A disabled/disappeared opener falls back to the relevant stable region. Sign-in recovery retains only the current Today view/page via a same-origin route, and continues warning that unsaved edits must be copied.

The task edit RPC trims the same ECMAScript whitespace characters as String.trim and applies the existing 1–1000 UTF-16 code-unit limit (supplementary characters consume two). No direct-table permissions widen, no existing rows are rewritten, no completion/priority fields change, and optimistic original text/date guards remain exact. Null, whitespace-only and oversized edits fail. Generate current local DB types as evidence and reconcile this function's unchanged signature without replacing unrelated hand-refined schema types.

Review focus: missing row vs failed read; draft preservation; pending completion/Undo races; last-page removal/focus; request cancellation; partial native dates; sign-in redirect safety; non-BMP and whitespace normalization; invoker/RLS/grants unchanged.
