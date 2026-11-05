# Reactive owner shared-link expiry (PROD-252)

The owner link manager currently reads Date.now only when something else renders. A link may keep its Active label and active-only controls after expiry. Recipient expiry and server authorization already protect access and remain unchanged.

Implement a stable external-store snapshot of the latest reached expiration timestamp among loaded records. Subscribe to the next future deadline (bounded to the browser timer maximum), focus and visibility changes; clean all timers/listeners on unsubscribe. Recompute when records change. Derive each row's expired status from the snapshot, preserving revoked status priority. Avoid database polling, a continuously ticking clock, and render-time Date.now. Keep all existing sharing operations and history race protection.

1. Add an owner management regression with a synthetic link expiring in one second. Observe stale Active label/controls after advancing time.
2. Add a small expiry hook, integrate with manager, remove the purity exception. Tests cover initial expired rows, staggered deadlines, changed deadlines, suspended timer/focus refresh, cleanup and revoked priority. Verify no extra history reads.
3. Run focused RED/GREEN, full units/coverage, types, lint and production build, then existing isolated sharing browser journeys on desktop and emulated phones.
4. Actual Claude and one fresh independent branch review, hosted CI and separately verified deployment.

Review focus: stale callbacks after records change; >24-day timer overflow; stable snapshots; invalid dates; SSR hydration; revoked rows; no new authorization claim. The browser clock governs display only; server checks continue governing access. User authorizes continued development and releases; no permission pause.
