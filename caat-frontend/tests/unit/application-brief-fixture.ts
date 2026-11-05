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

export function scholarshipBriefHub(overrides: Partial<ApplicationHub> = {}): ApplicationHub {
 const scholarship = {
  id:'award',title:'Attached award',provider:'Example Foundation',amount:'$5000',status:'interested' as const,
  schoolId:7,attachedSchoolName:'Example University',scholarshipSchoolName:'Example University',
  checklist:{id:'award',requires_essay:true,deadline_at:'2027-06-01',external_url:'https://example.test/award',application_requirements:{must_meet:['Check the residency rule']},eligibility_summary:null,last_verified_at:'2025-01-01',source_last_synced_at:null,school_name:'Example University',is_active:false},
 };
 return briefHub({savedScholarships:[scholarship,{...scholarship,id:'other',title:'Other application award',schoolId:8},{...scholarship,id:'suggestion',title:'Unattached suggestion',schoolId:null}],savedScholarshipsUnavailable:false,prepChecks:{award:['deadline']},prepChecksUnavailable:false,...overrides});
}
