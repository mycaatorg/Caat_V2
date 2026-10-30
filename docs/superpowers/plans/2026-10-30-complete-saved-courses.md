# Complete saved-course reads implementation plan

> Execute inline with superpowers:executing-plans and one fresh whole-branch review.

Goal: PROD-232 makes the application hub include every owned saved course for its school under PostgREST row caps below the requested200.
Architecture: replace readSavedCourses manual200/short-page loop with existing bounded evidencePages and unchanged normalization. Preserve all owner/school filters, course_id order, inactive rows and unsafe-link handling, optional unavailable/retry semantics. No schema/dependency/production catalogue changes.

Task1: reproduce five rows behind a cap2, assert offsets0/2/4/5 and same ownership filters; error after first short page must reject/no partial card. Update mocks to honor ranges/terminal empties, retain201-row and malformed-row tests. RED then implementation GREEN; fullunits/types/zero-warninglint/build.

Task2: dedicated disposable school900232 and51catalog offerings in seed-courses.sql, neverproduction. Browser signs in as testowner, temporarily bookmarks synthetic51courses and creates owned application, verifies all51 plus tail afterreload, forces optional readfailure and retries, removes all created bookmarks/application under scopedcleanup. Reuse existing localcapgate, extend selector to232. Three desktop/Android/iPhone journeys and actual50cap; isolatedSQL seed only with loopbackguard. Normal browser pipeline applies seed automatically. Fullsafety guard tests.

Review actualClaude plus fresh independent; single RED/GREEN blocker pass, evidence preserved, finalCI/develop/release/main/provider/live beforeDone. User alreadyauthorizes implementation/push/merge/release. No human/AT or production ownerCRUD claim.
