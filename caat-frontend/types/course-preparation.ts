import type { Json } from '@/types/database';
export type PreparationKey = 'prerequisites' | 'assumed_knowledge' | 'application_route';
export type PreparationAction = 'start' | 'reviewed' | 'reopen' | 'acknowledge';
export type PreparationCheck = { id:string; user_id:string; application_id:string; school_id:number; course_id:string; item_key:PreparationKey; snapshot:Json; reviewed:boolean; revision:string; created_at:string; updated_at:string };
export type PreparationWork = { id:string; user_id:string; application_id:string; check_id:string; evidence_link_id:string|null; essay_draft_id:string|null; created_at:string };
