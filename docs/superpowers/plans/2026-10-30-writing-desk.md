# Writing desk implementation plan
Use executing-plans inline. Spec: docs/superpowers/specs/2026-10-30-writing-desk-design.md. Base126cc8f (PROD224 pendingPR271); rebase only225commits after224 merges.

## Review focus
Owner switch cannot display old writing; missing prompt/school metadata remains understandable; private custom prompt titles never leak; newest/oldest invalid dates sort last; current/other filters must never classify resumes as drafts; exact links remain ownerchecked by destination; no reader writes or content projections.

## Task1 reader and selectors
lib/writing-desk.ts: WritingItem{id,kind,title,context,schoolId,schoolName,isCurrent:boolean|null,updatedAt,href}; readWritingDesk(client,userId), selectWriting(items,{query,kind,school,status,sort}). Complete evidencePages per source orderedid; draftprojection id,prompt_id,label,school_id,is_current,updated_at,schools(name); customprompt id,title owner; publicessayprompts id,title; resume id,title,updated_at owner. Publiccontextmap cannot overwrite ownedcustom title. No partial return onfailure. Sort dates invalidlast bothdirections, title/kind/idtie. Selectorimmutable.
RED tests cap2/5records,ownerprivateprojections,missingcontext/latererror and combinations. ImplementGREEN,typecheck,commit.

## Task2 overview UI
PageHeader+client AuthContext keybyuser. Currenteffect activeflag+refreshversion, readonly; allresultcounts onlyloaded. Labeled search/type/school/status/sort, clearfilters,20itempagination. Native links/preloadfalse. Rows show type/context/school/status/date, currentdraft terminology onlyessays. Empty/retry states. Sidebar and editorheaderWritingdesklinks. registryrouteguard. RED UItests forfilterpagination/reset/errorretry/accountstaleresponse;GREEN/fullsuite/build/lint/type.

## Task3 user journeys and release
Isolatedowner+peerfixtures prompt+current/otherdrafts andresumes; desktopAndroidiPhone browse/search/type/school/status/date/pagination,exactdestination/reload,errorretry,nooverflow,screenshot,ownercleanup. Test51draftsreadableunderreal50cap and addgatejourney ifneeded. ActualClaude+freshindependentwholebranchreview; ImportantREDGREENthenfullsuite,no rereview. PR/develop/release/exactmainCI/READYaliases/providerreadonlylive; updateLinearbeforeDone.
