# Prefer the Ubuntu archive in hosted browser CI (PROD-257)

Release309 spent 9m50s fetching 16.1MB of fonts from the Azure Ubuntu mirror. Browser binaries were fast. Keep the entire Playwright dependency set and every CI gate; prefer the existing HTTPS Ubuntu archive by swapping priorities in the exact known GitHub mirror list. Preserve Azure and security fallbacks, package signatures and source configuration. Only apply on GitHub-hosted CI; missing or changed mirror layouts keep their defaults.

1. Write fixture tests for exact known list, preservation of comments/blank lines, idempotence, unknown/missing/extra/duplicate entries and non-hosted refusal; observe RED.
2. Implement the narrow transformation and a hosted-only fixed-path entry point. Run before Playwright's unchanged installation. No local apt mutation; fixture files only in tests.
3. Run all bootstrap contracts and inspect workflow diff. Have Claude and one fresh independent reviewer review the pinned branch. Require hosted full CI; compare actual install logs/timings before any performance claim.

Review focus: mirror metadata semantics (lower numbers first), avoiding changes on future runner layouts, preserved fallbacks/signatures, sudo/Node path, no secrets or new permissions. Local fixtures cannot prove hosted network speed. HTTPS archive can also be slow; this mitigation is not an availability guarantee.

Sources: https://github.com/actions/runner-images/issues/14823 ; https://github.com/actions/runner-images/blob/main/images/ubuntu/scripts/build/configure-apt-sources.sh ; https://manpages.ubuntu.com/manpages/noble/man1/apt-transport-mirror.1.html
