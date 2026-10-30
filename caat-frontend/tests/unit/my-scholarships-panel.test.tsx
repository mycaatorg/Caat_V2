// @vitest-environment jsdom
import React,{act} from 'react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {mountComponent,unmountAll,flush,button,queryButton,click,change,hasText,deferred} from './dom-helpers';
import type {UserScholarship} from '@/app/(main)/scholarships/user-scholarships-api';
const io=vi.hoisted(()=>({fetch:vi.fn(),add:vi.fn(),update:vi.fn(),remove:vi.fn(),toast:{success:vi.fn(),error:vi.fn()}}));
vi.mock('@/app/(main)/scholarships/user-scholarships-api',()=>({fetchUserScholarships:io.fetch,addUserScholarship:io.add,updateUserScholarship:io.update,deleteUserScholarship:io.remove}));
vi.mock('sonner',()=>({toast:io.toast}));
vi.mock('next/link',()=>({default:({href,children,...props}:React.PropsWithChildren<{href:string}>)=><a href={href} {...props}>{children}</a>}));
import MyScholarshipsPanel from '@/app/(main)/scholarships/my-scholarships-panel';
const row=(id:string,title:string,deadline_at:string|null):UserScholarship=>({id,title,deadline_at,user_id:'u',provider_name:'Rotary',country:'Australia',created_at:'2026-01-01',updated_at:'2026-01-01',description:null,amount_display:null,amount_value:null,amount_currency:'AUD',awards_count:null,frequency:null,study_level:[],funding_type:[],eligible_countries:[],external_url:null,notes:null});
const rows=()=>[row('a','Future Award','2099-12-01'),row('b','Past Award','2000-01-01'),row('c','Undated Award',null)];
const card=(title:string)=>[...document.querySelectorAll('h3')].find(h=>h.textContent===title)!.closest('[data-slot="card"]') as HTMLElement;
const dialog=()=>document.querySelector('[role="dialog"]') as HTMLElement;
const field=(id:string)=>document.getElementById(id) as HTMLInputElement;
const titles=()=>[...document.querySelectorAll('h3')].map(h=>h.textContent);
beforeEach(()=>{vi.resetAllMocks();io.fetch.mockResolvedValue(rows());io.remove.mockResolvedValue(undefined);});
afterEach(()=>unmountAll());
async function mount(){await mountComponent(<MyScholarshipsPanel/>);await flush();}
it('shows a retryable load error without false empty state or counts',async()=>{
 io.fetch.mockRejectedValueOnce(new Error('offline'));await mount();
 expect(hasText('Could not load your scholarships.')).toBe(true);
 expect(hasText('No scholarships added yet')).toBe(false);
 expect(document.querySelector('[aria-label="Your scholarship deadlines"]')).toBeNull();
 await click(button('Try again'));await flush();expect(titles()).toHaveLength(3);
});
it('blocks creation while the initial collection is loading',async()=>{
 const read=deferred<UserScholarship[]>();io.fetch.mockReturnValueOnce(read.promise);await mount();
 const add=queryButton('Add Scholarship');expect(add===null||add.disabled).toBe(true);
 await act(async()=>read.resolve(rows()));expect(button('Add Scholarship').disabled).toBe(false);
});
it('filters and searches the personal collection, sorts and resets',async()=>{
 await mount();expect(titles()).toEqual(['Past Award','Future Award','Undated Award']);
 await click(button('Upcoming'));expect(titles()).toEqual(['Future Award']);
 await change(document.querySelector('input[aria-label="Search my scholarships"]') as HTMLInputElement,'missing');
 expect(hasText('No scholarships match your search and filters.')).toBe(true);
 await click(button('Reset filters'));expect(titles()).toHaveLength(3);
 await change(document.querySelector('select[aria-label="Sort my scholarships"]') as HTMLSelectElement,'name');
 expect(titles()).toEqual(['Future Award','Past Award','Undated Award']);
});
it('retains failed edit text with inline feedback and saves on retry',async()=>{
 await mount();await click(button('Edit scholarship',card('Future Award')));
 await change(field('s-title'),'My revised award');io.update.mockRejectedValueOnce(new Error('outage'));
 await click(button('Save Changes',dialog()));await flush();
 expect(field('s-title').value).toBe('My revised award');
 expect(dialog().querySelector('[role="alert"]')?.textContent).toContain('Could not save');
 io.update.mockResolvedValueOnce({...rows()[0],title:'My revised award'});
 await click(button('Save Changes',dialog()));await flush();expect(dialog()).toBeNull();expect(titles()).toContain('My revised award');
});
it('prevents duplicate submit and close while saving',async()=>{
 const save=deferred<UserScholarship>();io.update.mockReturnValueOnce(save.promise);await mount();await click(button('Edit scholarship',card('Future Award')));
 const form=dialog().querySelector('form')!;
 await act(async()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 expect(io.update).toHaveBeenCalledTimes(1);
 expect(field('s-title').matches(':disabled')).toBe(true);
 await click(button('Close scholarship form',dialog()));expect(dialog()).not.toBeNull();
 await act(async()=>save.resolve(rows()[0]));await flush();expect(dialog()).toBeNull();
});
it('keeps a scholarship visible if confirmed deletion fails',async()=>{
 io.remove.mockRejectedValueOnce(new Error('missing'));await mount();
 await click(button('Delete scholarship',card('Future Award')));await click(button('Delete',card('Future Award')));await flush();
 expect(titles()).toContain('Future Award');expect(io.toast.error).toHaveBeenCalled();
});
it('renders invalid legacy dates honestly without crashing or counting them as upcoming', async () => {
 io.fetch.mockResolvedValueOnce([row('bad','Invalid legacy award','2026-02-30')]); await mount();
 expect(card('Invalid legacy award').textContent).toContain('Check deadline');
 await click(button('Upcoming')); expect(titles()).toEqual([]);
 await click(button('No deadline')); expect(titles()).toEqual(['Invalid legacy award']);
});
it('ignores a stale read after unmount and remount', async () => {
 const old = deferred<UserScholarship[]>(); io.fetch.mockReturnValueOnce(old.promise); await mount();
 await unmountAll(); await mount();
 await act(async () => old.resolve([row('old','Stale award',null)]));
 expect(titles()).not.toContain('Stale award'); expect(titles()).toHaveLength(3);
});
it('retains a failed new scholarship draft and retries a single creation', async () => {
 await mount(); await click(button('Add Scholarship'));
 await change(field('s-title'),'New award'); await change(field('s-provider'),'My provider');
 io.add.mockRejectedValueOnce(new Error('offline'));
 await click(button('Add Scholarship',dialog())); await flush();
 expect(field('s-title').value).toBe('New award'); expect(dialog().querySelector('[role="alert"]')).not.toBeNull();
 io.add.mockResolvedValueOnce(row('new','New award',null));
 await click(button('Add Scholarship',dialog())); await flush();
 expect(titles().filter(title => title === 'New award')).toHaveLength(1);
 expect(dialog()).toBeNull();
});
it('keeps calendar download failures and empty calendars inside the workspace', async () => {
 const fetcher = vi.fn().mockResolvedValueOnce(new Response(null,{status:503})).mockResolvedValueOnce(new Response(null,{status:204}));
 vi.stubGlobal('fetch',fetcher);
 try {
  await mount(); await click(button('Download deadline calendar')); await flush();
  expect(hasText('Could not prepare your calendar. Please try again.')).toBe(true);
  expect(titles()).toHaveLength(3);
  await click(button('Download deadline calendar')); await flush();
  expect(hasText('No upcoming application or scholarship deadlines. Add a due date to get started.')).toBe(true);
  expect(hasText('Could not prepare your calendar. Please try again.')).toBe(false);
 } finally { vi.unstubAllGlobals(); }
});
