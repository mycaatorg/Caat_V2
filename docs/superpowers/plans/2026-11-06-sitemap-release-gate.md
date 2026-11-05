# Public sitemap smoke gate (PROD-254)

Extend the existing read-only public smoke suite to request sitemap.xml. Parse XML with the real browser DOMParser; require successful HTTP/XML content, correct sitemap namespace, at least one award URL, and uniqueness. When CAAT_EXPECTED_SITEMAP_AWARDS is explicitly provided, require a positive safe integer and exact award count. Omission means structural coverage, never database parity. Keep query strings so duplicate slugs with distinct award IDs remain distinct.

Prove the guard catches a static-only sitemap by temporarily fulfilling the browser request with valid XML containing only the home URL, then restore the test and require success on the deployed sitemap. Also run with a wrong expected count and malformed configuration, requiring failure; correct authoritative count3,466 must pass. Never mutate production or inspect secrets.

Run the complete public smoke suite, types/lint and hosted full CI. Actual Claude and one independent review before merge; preserve release sequencing so develop stays pinned while release309 is open. No production implementation changes, dependencies or database migrations.
