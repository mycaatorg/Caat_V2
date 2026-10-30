# Low-row-cap CI gate (PROD-210)

Students must receive all their records even when PostgREST returns fewer rows than requested. The existing account-export, Today and calendar browser regressions prove this locally; make them a blocking CI phase after the normal browser suite.

Use the same disposable loopback Supabase stack and already-built app, starting a fresh local server from that build. Run only the three cap-sensitive journeys sequentially under a real 50-row database-role override. Their API assertions must prove the cap is active before checking the UI/export.

The runner consumes the private local status file, validates isolated test mode, app/API/database loopback addresses and matching test ports before touching the database, and never exposes admin credentials to Playwright or command arguments. Read the prior override, restore it in finally even if applying the override partially fails, and verify restoration. Test, cleanup, restoration and interruption failures must remain failures. SIGINT/SIGTERM stop the browser process group and separately owned app server before restoration; cancellation during restoration must remain a failure after cleanup; SIGKILL/machine loss cannot run finally and the disposable runner stack is the containment boundary.

Preserve separate default and low-cap reports on failure. Keep existing coverage, retry and flaky-test gates. No production credentials, database operations, application behaviour, dependencies or schema changes. Implementation choices: Node runner with existing PostgreSQL client; the runner owns the production app server and a small Playwright config fixes project selection; no additional build.
