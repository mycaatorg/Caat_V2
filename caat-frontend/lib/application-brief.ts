import type {BriefCourse,BriefPersonalTask,BriefExtra} from '@/lib/application-brief-extras';
import type { ApplicationHub } from '@/app/(main)/applications/[id]/api';
import { STATUS_CONFIG } from '@/types/applications';
import { requirementsChecklist, type ChecklistItem } from '@/lib/requirements-checklist';
export type BriefRow = { key: string; title: string; scope: string; status: string };
export type BriefScholarship = {
 key: string; title: string; provider: string; status: string; sourceNote: string; inactive: boolean;
 items: (Pick<ChecklistItem, 'key' | 'label' | 'detail' | 'href' | 'source' | 'sourceSuffix'> & { tick: string })[];
};
export type BriefScholarshipSection = { state: 'unavailable' } | { state: 'ready'; awards: BriefScholarship[] };
export type ApplicationBrief = {
 schoolName: string; country: string | null; status: string; majors: string[]; deadline: string | null; preparedAt: string;
 checks: { label: string; recorded: boolean }[]; essays: BriefRow[]; documents: BriefRow[]; notes: string | null; scholarships: BriefScholarshipSection | null; courses:BriefExtra<BriefCourse>|null; personalTasks:BriefExtra<BriefPersonalTask>|null;
};
/** Explicit allowlist: never pass arbitrary hub data into the document/print tree. */
export function buildApplicationBrief(hub: ApplicationHub, { preparedAt, includeNotes = false, includeScholarships = false, courses = null, personalTasks = null }: { preparedAt: string; includeNotes?: boolean; includeScholarships?: boolean; courses?:BriefExtra<BriefCourse>|null; personalTasks?:BriefExtra<BriefPersonalTask>|null }): ApplicationBrief {
 const documentStatus = (status: string) => status === 'verified' ? 'Verified' : status === 'missing' ? 'Missing' : 'Pending review';
 return {
  courses, personalTasks,
  schoolName: hub.schoolName, country: hub.schoolCountry, status: STATUS_CONFIG[hub.application.status]?.label ?? 'Not recorded',
  majors: [...hub.intendedMajors], deadline: hub.application.deadline_at, preparedAt,
  checks: [{label:'Deadline recorded',recorded:hub.readiness.deadlineSet},{label:'Essay draft saved',recorded:hub.readiness.essayDrafted},{label:'Document added',recorded:hub.readiness.keyDocsUploaded}],
  essays: [...hub.essaysForSchool.map(e=>({key:`school:${e.promptId}`,title:e.title,scope:'This school',status:e.status==='drafted'?'Draft saved':'To write'})),...hub.essaysShared.map(e=>({key:`shared:${e.promptId}`,title:e.title,scope:'Shared',status:e.status==='drafted'?'Draft saved':'To write'}))],
  documents: [...hub.schoolDocuments.map(d=>({key:`school:${d.id}`,title:d.fileName,scope:'This school',status:documentStatus(d.status)})),...hub.sharedDocuments.map(d=>({key:`shared:${d.category}`,title:d.label,scope:'Shared checklist',status:documentStatus(d.status)}))],
  scholarships: includeScholarships ? scholarshipSection(hub, preparedAt) : null,
  notes: includeNotes ? hub.application.notes?.trim() || null : null,
 };
}
export function briefDate(value: string | null): string {
 if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Not recorded';
 const date=new Date(`${value}T00:00:00Z`);
 if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0,10)!==value) return 'Not recorded';
 return new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
}

function scholarshipSection(hub: ApplicationHub, preparedAt: string): BriefScholarshipSection {
 if (hub.savedScholarshipsUnavailable || hub.prepChecksUnavailable) return { state: 'unavailable' };
 const now = new Date(preparedAt);
 return { state: 'ready', awards: hub.savedScholarships.filter(row => row.schoolId === hub.schoolId).map(row => {
  const checklist = requirementsChecklist(row.checklist, now);
  const ticks = new Set(hub.prepChecks[row.id] ?? []);
  return {
   key: row.id, title: row.title, provider: row.provider, status: row.status.replaceAll('_', ' '),
   sourceNote: checklist.sourceNote, inactive: checklist.inactive,
   items: checklist.items.map(item => ({
    key: item.key, label: item.label, detail: item.detail, href: item.href,
    source: item.source, sourceSuffix: item.sourceSuffix,
    tick: ticks.has(item.key) ? item.kind === 'rule' ? 'Marked checked with the provider' : 'Marked prepared' : 'No preparation tick recorded',
   })),
  };
 }) };
}
