// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mountComponent,unmountAll,button,click,hasText} from './dom-helpers';
const io=vi.hoisted(()=>({load:vi.fn(),add:vi.fn(),remove:vi.fn()}));
vi.mock('@/lib/supabase/client',()=>({supabase:{}}));
vi.mock('@/lib/requirement-evidence',async original=>({...await original<typeof import('@/lib/requirement-evidence')>(),fetchRequirementWork:io.load,linkRequirementWork:io.add,unlinkRequirementWork:io.remove}));
import {RequirementWorkProvider,RequirementSupportingWork,RemovedRequirementWork} from '@/components/applications/requirement-supporting-work';
const item={key:'essay',label:'Essay required'};
const source={kind:'evidence' as const,id:'e1',title:'My tailored award',category:'award',body:'My application wording',href:'/profile',tailored:true};
const linked={id:'r1',user_id:'u1',application_id:'a1',school_id:1,scholarship_id:'s1',item_key:'essay',requirement_label:'Essay required',evidence_link_id:'e1',essay_draft_id:null,created_at:'2026-10-25'};
function Screen(){return <RequirementWorkProvider applicationId='a1' schoolId={1}><RequirementSupportingWork scholarshipId='s1' item={item}/><RemovedRequirementWork scholarshipId='s1' items={[item]}/></RequirementWorkProvider>;}
beforeEach(()=>{vi.clearAllMocks();io.load.mockResolvedValue({links:[],sources:[source]});});
afterEach(unmountAll);
it('shows unavailable and retries without claiming no supporting work',async()=>{
 io.load.mockRejectedValueOnce(new Error('Offline'));
 await mountComponent(<Screen/>);
 expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/load supporting work/i);
 expect(button('Link supporting work: Essay required').disabled).toBe(true);
 await click(button('Refresh supporting work'));
 expect(button('Link supporting work: Essay required').disabled).toBe(false);
});
it('previews tailored text and links the association without a completion control',async()=>{
 await mountComponent(<Screen/>);
 await click(button('Link supporting work: Essay required'));
 await click(document.querySelector('input[type="radio"]')!);
 expect(hasText('My application wording')).toBe(true);
 expect(hasText(/Application-specific version/)).toBe(true);
 io.add.mockResolvedValue(linked);io.load.mockResolvedValue({links:[linked],sources:[source]});
 await click(button('Link selected work'));
 expect(io.add).toHaveBeenCalledWith({applicationId:'a1',schoolId:1,scholarshipId:'s1',itemKey:'essay',label:'Essay required',source:{kind:'evidence',id:'e1'}});
 expect(document.querySelector('[role="dialog"]')).toBeNull();
 expect(document.querySelector('input[type="checkbox"]')).toBeNull();
});
it('keeps the picker and selection when a write fails',async()=>{
 io.add.mockRejectedValue(new Error('Scholarship moved. Refresh.'));
 await mountComponent(<Screen/>);await click(button('Link supporting work: Essay required'));
 await click(document.querySelector('input[type="radio"]')!);await click(button('Link selected work'));
 expect(document.querySelector('[role="dialog"]')).not.toBeNull();
 expect(document.querySelector<HTMLInputElement>('input[type="radio"]')?.checked).toBe(true);
 expect(hasText('Scholarship moved. Refresh.')).toBe(true);
});
it('retains changed and removed requirements for review; unlink errors do not hide work',async()=>{
 io.load.mockResolvedValue({links:[{...linked,requirement_label:'Previously recorded essay'},{...linked,id:'old',item_key:'rule:01234567',requirement_label:'Previous rule'}],sources:[source]});
 io.remove.mockRejectedValue(new Error('Could not remove link'));
 await mountComponent(<Screen/>);
 expect(hasText(/Requirement changed/)).toBe(true);expect(hasText(/Requirements no longer listed/)).toBe(true);expect(hasText('Previous rule')).toBe(true);
 await click(document.querySelector<HTMLButtonElement>('[data-requirement-link="r1"] button')!);
 expect(hasText('Could not remove link')).toBe(true);
 expect(document.querySelector('[data-requirement-link="r1"]')).not.toBeNull();
});
