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
it('keeps the successful-save dialog open until refresh finishes so focus can return to an enabled opener',async()=>{
 await mountComponent(<Screen/>);
 const opener=button('Link supporting work: Essay required');opener.focus();await click(opener);
 await click(document.querySelector('input[type="radio"]')!);
 let resolve!: (value:unknown)=>void;
 io.load.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));io.add.mockResolvedValue(linked);
 await click(button('Link selected work'));
 expect(document.querySelector('[role="dialog"]')).not.toBeNull();
 const {act}=await import('react');await act(async()=>{resolve({links:[linked],sources:[source]});});
 expect(document.querySelector('[role="dialog"]')).toBeNull();await vi.waitFor(()=>expect(document.activeElement).toBe(opener));
});
it('refreshes known same-page source changes and cascaded removals immediately',async()=>{
 io.load.mockResolvedValue({links:[linked],sources:[source]});await mountComponent(<Screen/>);
 expect(document.querySelector('[data-requirement-link="r1"]')).not.toBeNull();
 io.load.mockResolvedValue({links:[],sources:[]});
 const {act}=await import('react');await act(async()=>{window.dispatchEvent(new Event('caat:requirement-work-changed'));});
 expect(document.querySelector('[data-requirement-link="r1"]')).toBeNull();
});
it('returns focus to a pointer opener even when Safari did not focus it on click (PROD-176)',async()=>{
 await mountComponent(<Screen/>);
 const opener=button('Link supporting work: Essay required');
 expect(document.activeElement).not.toBe(opener);
 await click(opener);await click(document.querySelector('input[type="radio"]')!);
 io.add.mockResolvedValue(linked);io.load.mockResolvedValue({links:[linked],sources:[source]});
 await click(button('Link selected work'));
 await vi.waitFor(()=>expect(document.activeElement).toBe(opener));
});

it('confirms a saved link after refresh fails and retries only the read',async()=>{
 await mountComponent(<Screen/>);const opener=button('Link supporting work: Essay required');await click(opener);
 await click(document.querySelector('input[type="radio"]')!);
 io.add.mockResolvedValue(linked);io.load.mockRejectedValueOnce(new Error('Offline'));
 await click(button('Link selected work'));
 expect(document.querySelector('[role="dialog"]')).toBeNull();
 expect(document.querySelector('[role="status"]')?.textContent).toMatch(/supporting link saved/i);
 expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/could not load supporting work/i);
 expect(opener.disabled).toBe(true);
 await vi.waitFor(()=>expect(document.activeElement).toBe(document.querySelector('[aria-label="Supporting work"]')));
 io.load.mockResolvedValue({links:[linked],sources:[source]});await click(button('Refresh supporting work'));
 expect(document.querySelector('[data-requirement-link="r1"]')).not.toBeNull();
 expect(document.querySelector('[role="alert"]')).toBeNull();expect(io.add).toHaveBeenCalledTimes(1);
 await click(opener);expect(document.querySelector<HTMLInputElement>('input[type="radio"]')?.disabled).toBe(true);
 expect(button('Link selected work').disabled).toBe(true);
});
it('finishes a confirmed save when a known change supersedes its refresh',async()=>{
 await mountComponent(<Screen/>);await click(button('Link supporting work: Essay required'));await click(document.querySelector('input[type="radio"]')!);
 const {deferred}=await import('./dom-helpers');const old=deferred<unknown>(),newer=deferred<unknown>();
 io.add.mockResolvedValue(linked);io.load.mockImplementationOnce(()=>old.promise).mockImplementationOnce(()=>newer.promise);
 await click(button('Link selected work'));
 const {act}=await import('react');await act(async()=>{window.dispatchEvent(new Event('caat:requirement-work-changed'));});
 await act(async()=>{old.resolve({links:[linked],sources:[source]});});
 expect(document.querySelector('[role="dialog"]')).toBeNull();
 expect(hasText(/Supporting link saved/i)).toBe(true);
 await vi.waitFor(()=>expect(document.activeElement).toBe(document.querySelector('[aria-label="Supporting work"]')));
 await act(async()=>{newer.resolve({links:[],sources:[]});});
 expect(document.querySelector('[data-requirement-link="r1"]')).toBeNull();expect(io.add).toHaveBeenCalledTimes(1);
 expect(button('Link supporting work: Essay required').disabled).toBe(false);
});
it('confirms removal separately from an unavailable refreshed list',async()=>{
 io.load.mockResolvedValue({links:[linked],sources:[source]});io.remove.mockResolvedValue(undefined);
 await mountComponent(<Screen/>);io.load.mockRejectedValueOnce(new Error('Offline'));
 await click(button('Remove supporting link: My tailored award'));
 expect(hasText(/Supporting link removed/i)).toBe(true);
 expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/could not load supporting work/i);
 io.load.mockResolvedValue({links:[],sources:[source]});await click(button('Refresh supporting work'));
 expect(document.querySelector('[data-requirement-link="r1"]')).toBeNull();expect(io.remove).toHaveBeenCalledTimes(1);
});
