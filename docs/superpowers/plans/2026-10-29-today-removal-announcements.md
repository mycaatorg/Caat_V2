# PROD-194: repeated missing-task announcements

Use a cumulative per-visit removal count in the existing named task live region. Each confirmed missing task closed by the student changes the status text, including identically named tasks. Keep drafts copyable before close, remove only the missing row, preserve completion/Undo behavior, and retain existing focus restoration.

1. Add overview and expanded-list regression cases with two identically named missing tasks; observe unchanged second status fail.
2. Replace fixed notice state with a functional count update and derived singular/plural copy. Run focused Today tests, typecheck, lint and whole-source coverage.
3. Actual browser journey for two missing rows; actual Claude and fresh whole-branch independent review; PR/CI and release gates.

Review focus: live region remains mounted, duplicate task names, functional state updates, no draft loss before explicit close. Browser assertions prove changing accessible DOM, not human screen-reader output; include repeated removal in PROD-81 pilot.
