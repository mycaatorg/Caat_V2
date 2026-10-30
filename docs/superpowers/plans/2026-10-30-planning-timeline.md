# Planning timeline implementation plan

> Execute inline with superpowers:executing-plans; one fresh whole-branch reviewer.

Goal: PROD-233 combines recorded upcoming application/scholarship/customscholarship/event dates and open dated tasks in a searchable month-grouped timeline. Reuse existing complete fetchUnifiedDeadlines semantics; no source refresh, official eligibility claim, automatic reminder or outbound messaging.
Design: /workspace/planner, sidebar Planning timeline and Today agenda link. Quiet monthheaders, datecolumn, sourcebadge and directmanagementlink; responsive singlecolumn phone, clear empty/error/retry states, 20rows/page. Search titles, sourcefilter, next7/30/90days/allupcoming/pastdue tasks. Undated open taskcountlinksTodaytodos. Date-onlylabels stable UTC; today uses browsertimezone withSydneyfallback and snapshotRefresh; show date/zone context. Dates remain recorded dates, checkofficialclosingtimes.
Architecture: pure timeline model/filter/group helpers, loadPlanningTimeline ownerfiltered complete source reads plusopen todos. Account-keyed clienteffects discardstale reads; refresh removesoldcontent anderrorsnotpartial. Complete source errors hide counts. Notes/bodies/storagepathsneverselected.

Task1: pure tests source distinctions/datevalidation/order/rangebounds/search/sourcefilters/no mutation; readtests complete2rowcap + ownerfilters + null/error no partialdata. RED→GREENimplementation.
Task2: clienttests filters/pageclamp/loading/failure/retry/accountswitchstaleresponse, responsiveUI, route+registry/sidebar/Todaylink. Fullunits/types/strictlint/build. Browser51tasks+personaldeadline+pastdue/undatedownedfixturesandpeerprivacy, searchlateitem, filters/range/paging/refreshrecovery, desktopAndroidiPhone andauthguards. Extendactualcapgate. No fake humanATclaim.
Task3: actualClaude and independent review, one blockerfixpassRED→GREEN+fullsuite. FinalCI/develop/release/main/READY/provider/live beforeDone. Preserve evidence perstandinginstruction. No schema/dependencychanges.
