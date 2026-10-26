# Library dialog focus and preparation announcements

PROD-167 and PROD-185 finish two reviewed accessibility gaps. Existing React/Radix components and the current appearance remain; no dependency, database, or permission changes.

Library add/edit/import and application item picker/tailoring dialogs must restore focus to the actual opening button after pointer or keyboard opening, on Close, Escape, Cancel or successful save. Safari pointer activation does not necessarily focus the button, so capture the event's currentTarget explicitly. If an edit changes an item's kind and removes it from the current filter, focus the stable, labelled library region instead. Application dialogs have their own stable region fallback. Preserve pending-write protections and failed-save drafts. Audit every LibraryDialog caller; those already supplying explicit refs keep their current behavior.

After a preparation write refreshes, announce the status rendered for that row. A missing check for a still-saved, active course at the application's university means Not started; an absent row means no longer shown. Preserve existing source-review and focus behavior.

Verify with failing component regressions, desktop Chromium and phone Chromium/WebKit journeys, whole unit suite, typecheck/lint, fresh independent review, actual Claude review, feature/release CI and production deployment checks. Automated accessibility evidence does not replace PROD-81's human screen-reader pilot.
