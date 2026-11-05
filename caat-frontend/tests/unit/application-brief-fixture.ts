import type { ApplicationHub } from '@/app/(main)/applications/[id]/api';
export function briefHub(overrides: Partial<ApplicationHub> = {}): ApplicationHub {
 return {
  application:{id:'app',user_id:'owner',school_id:7,status:'applying',deadline_at:'2026-12-01',notes:'Private application notes',created_at:'2026-01-01',updated_at:'2026-10-01',intended_majors:['Law'],schools:{id:7,name:'Example University',country:'Australia'}},
  schoolId:7,schoolName:'Example University',schoolCountry:'Australia',targetMajor:'Global major not selected',intendedMajors:['Law'],
  readiness:{deadlineSet:true,essayDrafted:true,keyDocsUploaded:true,score:3},
  essaysForSchool:[{promptId:'p1',promptSlug:'why',title:'Why this school',status:'drafted',lastEdited:'2026-10-01'}],
  essaysShared:[{promptId:'p2',promptSlug:'personal',title:'Personal statement',status:'to-write',lastEdited:null}],
  schoolDocuments:[{id:'d1',fileName:'Transcript.pdf',status:'pending'}],
  sharedDocuments:[{label:'Passport / ID',category:'identity',status:'missing'}],
  savedScholarships:[],savedScholarshipsUnavailable:true,prepChecks:{},prepChecksUnavailable:true,scholarships:[],scholarshipsUnavailable:true,savedCourses:[],savedCoursesUnavailable:true,evidenceLinks:[],evidenceLinksUnavailable:true,
  ...overrides,
 };
}
