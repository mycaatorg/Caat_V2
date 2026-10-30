# Browser shutdown contract repair (PROD-223)

Use executing-plans inline. Fix the exact-main safety failure before closing the release tickets. Existing user authorization covers testing/review/release.

The low-cap runner already owns server and Playwright groups separately. Its obsolete integration test instead asks generic runChild to contain a Playwright-detached webServer, an architecture intentionally replaced in PROD210. Preserve assertions, use the real supported topology.

1. Reproduce original failure deterministically with the detached server ignoring graceful interruption. Keep evidence, not this unsupported guarantee in the final suite.
2. Replace integration with actual Playwright under runBrowserPhase, externally owned HTTP server and stubborn cancellation. Verify test body started, server heartbeat positive, cancellation rejects, heartbeat stops and port closes before runLowCap restoration. Assert actual low-cap config disables Playwright webServer to guard topology.
3. Run full safety suite and repeated focused test. Actual Claude and independent review of this incremental patch, important fixes RED→GREEN, no rereview. Preserve all evidence. Hosted feature/develop/release/main CI and READY/provider/live gates before Done.

No schema, dependency, credentials or product behavior change. Review focus: test topology matches main; assertion cannot pass without real running processes; cleanup waits before SQL restore; fallback cleanup cannot conceal a leak; no signal/timeout weakening.
