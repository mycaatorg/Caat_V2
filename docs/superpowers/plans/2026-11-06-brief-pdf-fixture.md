# Stable application-brief PDF fixture (PROD-243)

Execute inline with executing-plans, one fresh whole-branch review, and actual Claude review.

The full release browser gate intermittently expected four PDF pages but received three. A controlled experiment on the same complete 51-document brief changed only the six-character random filename suffix: iiiiii produced three pages and wwwwww produced four. Fonts were loaded and all 56 table rows remained present. No product defect or missing content was established.

Add a fixed layout-fixture segment to this journey's unique marker so narrow and wide suffixes both wrap onto two printed lines. Keep the strict four-page assertion, all-record/tail assertions, privacy checks, scoped cleanup and exact navigation. Attach the generated PDF before asserting its count so future failures retain evidence. No product CSS change, relaxed assertion, production write or new dependency.

Validation: reproduce the width extremes before and after; run the whole existing workspace journey on desktop/Android/iPhone, typecheck/lint, then the combined release verification and CI. Keep all original failed logs. Review and release through normal feature/develop/main gates.
