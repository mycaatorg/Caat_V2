# Complete attached scholarship preparation (PROD-260)

Use the existing evidencePages helper for saved scholarship attachments and preparation ticks. Order saved rows by scholarship_id and ticks by scholarship_id/item_key; both keys are unique within the owner filter. Continue through short pages until an empty page; fail the entire source on any page error. Preserve mapping, ownership, write behavior and the existing separate source retry states. No schema, permission or dependency changes.

This is a prerequisite to PROD-261: optional attached scholarship checklists in the private application brief. That feature is separate and must not print a truncated source.

1. Add a capped mock backend and observe failures for incomplete attachments/ticks and later-page errors. Preserve existing write tests.
2. Implement bounded complete reads. Add a real isolated application-hub journey with more than 50 records/ticks, tail assertions, later-page failures and recovery. Include it in the existing actual row-cap gate.
3. Run focused/full unit coverage, types, lint, build, desktop/Android/iPhone journey and actual cap gate. Review pinned delta with actual Claude and one fresh independent reviewer. Require hosted CI, release and exact production verification before Done.

Review focus: owner filtering on every page, stable composite ordering, short-page continuation, null nested scholarship records, later-page failures discard partial data, no changes to attachment/tick writes, scoped fixture cleanup, no production student writes. Offset reads are a bounded snapshot approximation, not a cross-query database transaction; concurrent changes may require refresh.
