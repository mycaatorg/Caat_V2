# Supporting work for scholarship requirements — PROD-161

Students can explicitly connect supporting work to an attached scholarship's checklist items. Linking does not tick preparation, establish eligibility, change status/score or submit an application.

The picker offers documents and library items already linked to this application, preserving their application-specific tailoring, and the student's saved essay drafts. It explains how to add missing documents/items through the application's existing cards. Each association stores the requirement label observed at linking. Changed labels are flagged; removed rule keys remain in a review section with unlink controls. Supporting work follows its current source; it is not a submitted snapshot. The preview explains this.

One new `requirement_evidence_links` table stores immutable identities: owner, application, school, scholarship, checklist key, label snapshot, and exactly one application evidence link or essay draft. Composite foreign keys enforce same owner, application and attached scholarship, including concurrent movement. Unique source indexes prevent duplicates. Owners can select/insert/delete; no update or anonymous access. Removing source links/drafts cascades associations only. Detaching/moving a scholarship clears its old associations while preserving source work and preparation ticks. Application deletion and account deletion must still work.

Batch, paginated owner-filtered reads load associations and source choices for one application. UI has explicit loading, unavailable/retry and no-work states; no silent success on zero-row writes. The modal is keyboard accessible and returns focus. Desktop and phone journeys verify persistence and unchanged ticks. Export includes associations and the previously omitted evidence library items.

Out of scope: new course requirement data, auto-completion, automatic attachment, provider submission, source verification, or the real student pilot. Existing PROD-77 and PROD-78 remain open for their remaining work.
