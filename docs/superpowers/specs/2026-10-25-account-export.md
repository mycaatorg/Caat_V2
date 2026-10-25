# PROD-162 — Complete account downloads

Students downloading their account currently miss saved courses and several community records; most existing collections stop at one API page. Preserve existing JSON keys and add the omitted readable records.

Every collection uses an explicit caller-owner filter, stable primary-key order and 200-row pages. Composite primary keys order all components. Resume sections and test subjects use only the caller’s paginated parent IDs, in batches of 100, with pages per batch. Any query error rejects the whole download with a generic error and no-store headers.

Include saved courses, own likes/comment likes/saves/poll votes/group requests/profile settings, outgoing follows and blocks. Exclude other users’ activity, moderation reports (no owner SELECT policy), authentication secrets and uploaded file contents. Uploaded document metadata remains included. Explain these limits in Settings and additive JSON scope metadata. Preserve export_version 1 because existing keys and row shapes stay compatible.

No schema changes or privilege elevation. Offset paging follows existing infrastructure; this is a current-data export, not a transactional snapshot during concurrent edits. Tests cover stable accounts and failures. Large exports remain buffered JSON; future asynchronous exports are outside this bounded fix.
