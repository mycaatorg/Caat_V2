# Document usage refresh reliability — PROD-166

Keep the student's last loaded application links useful while checking newer data. Each document action must expose its count, unknown state or refresh failure in its accessible description. After a failed refresh, retain the count and explicitly label it last loaded; never present failed reads as zero links.

Known positive delete warnings remain visible during refresh and failure, labelled as last loaded. A stale zero remains unconfirmed. The database remains the authority for whether deletion is permitted.

One abort controller owns each vault-wide paginated refresh. Superseding a refresh or unmounting cancels it; sequence guards still reject late results. Manual retry responds immediately. Only deliberate refresh/retry and initial unknown loading use live announcements; automatic background checks remain visible without repeatedly interrupting screen readers.

Document usage reads allow at most 100 pages of 200 rows, then fail visibly rather than return partial counts. This is a safety ceiling (20,000 rows), not a silently truncated result. Other pagination consumers retain their current behavior. No database, permission or dependency changes.

Review focus: stale zero vs known positive delete warnings; late abort responses; unmount and mount cleanup; manual failure/retry focus; pagination boundary and partial-result rejection; accessible descriptions for both known and unknown data.
