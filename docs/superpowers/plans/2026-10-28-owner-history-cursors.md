# PROD-190: stable owner history

Spec: Linear PROD-190. User approved continued building, testing and release.

## Constraints
Owner-only DTO and authentication remain intact. Keep old offset RPC/action for deployment compatibility. Add cursor RPC with 20 visible rows and a 21st sentinel, timestamp/UUID/kind total ordering, bounded branch scans and full owner/time indexes. Preserve timestamp microseconds. No fixed history ceiling. Invalid cursor offers newest-content recovery. Preserve ignored evidence.

## Task 1: database contract
Write isolated REST/RPC test for >5000 comments, tied timestamps/UUID across kinds, concurrent insertion, reverse navigation, deleted anchors, owner privacy and invalid arguments. Run RED against missing RPC. Add additive migration and indexes. Run GREEN and existing owner contract. Register in fresh-database CI bootstrap.

## Task 2: action and route
Write action tests for cursor validation, precision, directions, bounded DTO and errors. Implement new cursor action and route links; retain existing removal behavior. Test browser history traversal, invalid-cursor recovery and insertion while paging on desktop and phone browsers.

## Task 3: verification and release
Run unit suite, typecheck, lint, SQL contracts and browser journeys. Actual Claude review plus one fresh independent whole-branch review. Fix material findings with RED/GREEN. Apply additive production migration after metadata inspection, create/attach feature PR, await CI, merge develop, create/attach release PR, await CI, merge main. Verify exact-main CI, auth probe, Vercel aliases and read-only live smoke. Update Linear only to Done when gates pass.

## Review Focus
Microsecond precision; post/comment UUID ties; deletions and concurrent inserts; reverse paging sentinel handling; invalid browser query types; owner isolation and bounded SQL scans; old deployment compatibility.
