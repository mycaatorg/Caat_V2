# Sequential local verification (PROD-242)

Add `npm run verify:local` in the frontend. Reuse the existing isolated-stack
preflight, then typecheck, lint, coverage and CI-mode browser entrypoints in
sequence with failure short-circuiting. CI-mode browser execution must build
production code and preserve retry-as-failure policy. No custom runner, new
dependencies, global locking, weakened checks, or claims to resolve PROD-145.

Document prerequisites and limits beside local-stack instructions. Verify a
missing isolated configuration fails before running checks, and a configured
disposable stack completes the command. No new unit tests that mirror package
script text; observed command behavior is the verification. Independent and
actual Claude review plus hosted CI gate merge.
