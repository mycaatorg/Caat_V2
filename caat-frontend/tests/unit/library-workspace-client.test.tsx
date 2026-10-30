// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { button, change, click, deferred, flush, mountComponent, unmountAll, get } from './dom-helpers';
import type { EvidenceItem } from '@/lib/evidence-items';
const io=vi.hoisted(()=>({list:vi.fn(),usage:vi.fn(),update:vi.fn(),remove:vi.fn(),auth:{user:{id:'owner'} as {id:string}|null,loading:false}}));
vi.mock('@/lib/supabase/client',()=>({supabase:{}}));
vi.mock('@/components/providers/AuthContext',()=>({useAuth:()=>io.auth}));
vi.mock('@/lib/evidence-items',async original=>({...await original<typeof import('@/lib/evidence-items')>(),listEvidenceItems:io.list,fetchItemUsage:io.usage,updateEvidenceItem:io.update,deleteEvidenceItem:io.remove}));
import LibraryClient from '@/app/(main)/workspace/library/client';
const item=(i:number):EvidenceItem=>({id:String(i),user_id:'owner',kind:i%2?'award':'activity',title:`Item ${String(i).padStart(2,'0')}`,organisation:'School',role:'Captain',start_date:null,end_date:null,is_current:false,description:'Team leadership',origin_key:null,revision:'v1',created_at:'2026-01-01'});
const search=()=>document.querySelector('input[aria-label="Search library"]') as HTMLInputElement;
const select=(label:string)=>document.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;
beforeEach(()=>{vi.clearAllMocks();io.auth={user:{id:'owner'},loading:false};io.list.mockResolvedValue(Array.from({length:25},(_,i)=>item(i)));io.usage.mockResolvedValue({'24':[{applicationId:'app',schoolName:'Sydney',tailored:true}]});});
afterEach(unmountAll);
it('searches and filters complete items with bounded pages and application links',async()=>{
 const c=await mountComponent(<LibraryClient/>);await flush();
 expect(c.querySelectorAll('[data-library-item]')).toHaveLength(12);
 await click(button('Next library items'));expect(c.querySelectorAll('[data-library-item]')).toHaveLength(12);
 await change(select('Application use'),'linked');expect(c.querySelectorAll('[data-library-item]')).toHaveLength(1);
 expect(c.querySelector('a[href="/applications/app"]')).not.toBeNull();expect(button('Delete Item 24').disabled).toBe(true);
 await change(select('Library type'),'award');expect(c.textContent).toContain('No library items match');
 await click(button('Clear library filters'));await change(search(),'item 24');expect(c.querySelectorAll('[data-library-item]')).toHaveLength(1);expect(button('Previous library items').disabled).toBe(true);expect(button('Next library items').disabled).toBe(true);
});
it('clamps pagination after deleting the final result on the last page',async()=>{
 io.usage.mockResolvedValue({});io.remove.mockResolvedValue(undefined);
 const c=await mountComponent(<LibraryClient/>);await flush();await change(select('Sort library'),'name');
 await click(button('Next library items'));await click(button('Next library items'));await click(button('Delete Item 24'));await click(button('Confirm delete item'));
 expect(c.querySelectorAll('[data-library-item]')).toHaveLength(12);expect(c.textContent).toContain('Page 2 of 2');
});
it('usage failure hides results and disables mutation until retry succeeds',async()=>{
 io.usage.mockRejectedValueOnce(new Error('secret backend'));const c=await mountComponent(<LibraryClient/>);await flush();
 expect(c.textContent).toContain('Could not load your library');expect(c.textContent).not.toContain('secret backend');expect(c.querySelectorAll('[data-library-item]')).toHaveLength(0);expect(button('Add library item').disabled).toBe(true);
 await click(button('Retry library'));await flush();expect(c.querySelectorAll('[data-library-item]')).toHaveLength(12);
});
it('returns focus to the library if an edited item no longer matches the search',async()=>{
 const c=await mountComponent(<LibraryClient/>);await flush();await change(search(),'Item 24');await click(button('Edit Item 24'));
 io.update.mockResolvedValue({...item(24),title:'Renamed'});await change(get('label','Title').querySelector('input')!,'Renamed');await click(button('Save item'));
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
 expect(c.querySelectorAll('[data-library-item]')).toHaveLength(0);expect(document.activeElement?.getAttribute('aria-label')).toBe('Activities, awards and experience library');
});
it('account change clears an open editor and ignores a previous account response',async()=>{
 io.list.mockResolvedValueOnce([item(24)]);
 const c=document.createElement('div');document.body.append(c);const root=createRoot(c);
 try{
  await act(async()=>root.render(<LibraryClient/>));await flush();await click(button('Edit Item 24'));
  const pending=deferred<EvidenceItem[]>();io.list.mockReturnValueOnce(pending.promise);io.auth={user:{id:'second'},loading:false};await act(async()=>root.render(<LibraryClient/>));await flush();
  expect(document.querySelector('[role="dialog"]')).toBeNull();expect(c.textContent).not.toContain('Item 24');
  io.list.mockResolvedValueOnce([item(90)]);io.auth={user:{id:'third'},loading:false};await act(async()=>root.render(<LibraryClient/>));await flush();
  await act(async()=>pending.resolve([item(80)]));expect(c.textContent).toContain('Item 90');expect(c.textContent).not.toContain('Item 80');
 }finally{act(()=>root.unmount());c.remove();}
});
