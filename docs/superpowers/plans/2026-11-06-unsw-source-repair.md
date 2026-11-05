# Reviewed UNSW source repair (PROD-244)

Execute inline with executing-plans and a fresh whole-branch review, plus actual Claude review. User authorised continued tested production improvements and catalogue recovery; no approval pause for the reviewed repair.

## Scope and evidence
The November6 read-only audit found13 failed UNSW source URLs. Seventeen exact existing records have confirmed replacement official pages:7 exchange awards by code,4 international awards by code,2 refugee/asylum awards by code, and4 single awards by exact title. Current source pages return200. Preserve the exact existing IDs, slugs, natural keys, award facts, imports and verification dates. Link repair is not field verification. UGTR1048 is absent from the current exchange page and excluded; other unmatched404 rows remain untouched.

TEST11 is a duplicate of the already-active John Monash Scholarship, not proof of a bogus programme. Its stored description and amount match the canonical record and official page. Correct the duplicate's display title/source link and mark only that row inactive, preserving its ID, student saves/statuses and old public slug. Add an audit pointer to the canonical row. Require the active canonical row with exact source identity before archiving. No reparenting of student data or deleting rows.

## Design
One transactional SQL migration with5-second lock timeout. Guard each present target's ID/source/external-id/title/URL/activity before any writes; reject unexpected drift. Local fresh databases without these production IDs are a no-op. Exact already-repaired state is a no-op, including updated_at. Merge audit metadata into existing object raw_payload. Never advance last_verified_at or source_last_synced_at. Production preflight separately requires all expected targets and records aggregate bookmark counts; migration itself permits absent IDs for clean local bootstrap.

## Verification
First write a loopback-only real-Postgres harness and observe missing implementation failure. Insert isolated fixtures using target identities, an unrelated row and a disposable student's bookmarks. Apply actual migration; compare every protected field and bookmark; verify17 URLs and one archived duplicate. Replay must preserve complete rows including timestamps. Identity/URL drift and missing/inactive canonical replacement must abort atomically. Clean only created fixtures. Wire this check into CI bootstrap.

Run isolated check, bootstrap safety tests, types/lint and hosted CI. Actual Claude and independent review; one red-green review fix pass. Merge/release through normal gates. Apply the exact reviewed SQL to production only after matching preflight; verify IDs/counts/facts/timestamps/bookmarks and source URLs afterward. No mass import or verified-date backfill.
