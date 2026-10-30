# Workspace Search Implementation Plan

Use superpowers:executing-plans inline. Goal: find and open exact personal work from one place. Architecture: four complete metadata reads through current authenticated Supabase client; pure selection plus a dedicated page; safe existing-editor deep links. Existing stack. Spec: docs/superpowers/specs/2026-10-30-workspace-search-design.md.

## Global constraints
Owner predicate every page; no content/storage paths in index; no schema/dependencies. Failure never presents partial results. Exact missing targets never create a resume or select unrelated writing.20results/page, minimum2querycharacters. Preserve editor save queues and existing navigation.

## Review focus
Slow old index response cannot replace refresh; foreign/missing target cannot cause writes; exact draft beyond list cap still opens; empty targeted resume remains empty; same-screen query changes cannot silently discard unsaved work.

### Task1: Metadata reader and selector
- Create lib/workspace-search.ts exports WorkspaceKind application/document/essay/resume, WorkspaceItem{id,kind,title,detail,href}, readWorkspaceIndex(client:Pick<SupabaseClient,'from'>,userId:string):Promise<WorkspaceItem[]>, selectWorkspaceItems(items,query,kind='all').
- Query explicit metadata: applications id,schools(name,country); documents id,file_name,category; essay_drafts id,prompt_id,label; resumes id,title. orderid+range viaevidencePages everyowner; Promiseall rejectsanyfailure. Map hrefs containing only internal paths and encodedids. Search literallowercase title/detail, stabletitle/kind/id sort; ownarray.
- RED tests allfourtableownercalls/metadataexclusion, cap2over5, latererror, selectorpunctuation/min2/type/mutation. Implement, runGREEN,typecheck,commit.

### Task2: Exact destinations
- Documents client consume document UUID on initialnavigation with selectedfilter/reset; no signed URL retrieval untiluseraction. Tests exactsecondrow, missingid, reset.
- Essays api new owned fetchDraftForPrompt(promptId,draftId), initialdeep-link selection in shell with target captured once per mount. Fetch target directly, augment loaded list if beyondcap. Missingtarget shows no unrelatedactive draft plus recovery. Tests targetreadownership, exactsecondtarget,missingno fallback, legacyqueue suite.
- Resume shell capture resume UUID initially; use loadResumeById instead of loadOrCreateResumeState for explicittarget, null→loaderror, no defaults seeding on targetedemptyresume. Tests exactsecond/no creation/missing/retry; existingautosavesuite. On same-screen query changes retain original editor to avoid silentdraft loss; links from dedicated search mount neweditor.
- RED→GREEN each; fullunits/type/lint/build thencommit.

### Task3: Search page and verification
- Add app/(main)/workspace/search/page.tsx and client.tsx, using PageHeader and input/filters/pagination. Clientread wrapper getClientUserId; sequenceguard; honestloading/retry/noindexfailurecounts. Native links withtype/context; refreshbutton. Add sidebarprimary Searchmywork and sharedheaderlink withaccessiblelabel. Add route-coverage registry.
- UI RED tests literalquery/min2/groupcounts/pagination/reset/retry/staleresponse; implement. Browserseedownedfourkindrecords, otherstudentexcluded, selectexactsecondwriting/selecteddocument, missingtargetnoinsert, failurethenretry; desktopAndroidiPhone screenshots/nooverflow. Ensurefixturecleanup.
- Final fullverification, actualClaude+freshindependentreview, findingsRED→GREEN(no rereview), PR/release/productiongates. Rebaseonly224commits after269merges.
