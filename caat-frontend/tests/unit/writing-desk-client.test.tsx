// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { button, change, click, deferred, flush, mountComponent, unmountAll } from './dom-helpers';
import type { WritingItem } from '@/lib/writing-desk';
const io = vi.hoisted(() => ({ read: vi.fn(), auth: { user: { id: 'owner' } as { id: string } | null, loading: false } }));
vi.mock('@/lib/writing-desk', async original => ({ ...await original<typeof import('@/lib/writing-desk')>(), readWritingDesk: io.read }));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/providers/AuthContext', () => ({ useAuth: () => io.auth }));
import WritingDeskClient from '@/app/(main)/workspace/writing/client';
const item=(i:number):WritingItem=>({id:String(i),kind:'essay',title:`Draft ${String(i).padStart(2,'0')}`,context:'Personal statement',schoolId:i%2?'9':null,schoolName:i%2?'Sydney':null,isCurrent:i%2===0,updatedAt:'2026-01-01T00:00:00Z',href:`/essays?prompt=p&draft=${i}`});
const input=()=>document.querySelector('input[aria-label="Search writing"]') as HTMLInputElement;
const select=(label:string)=>document.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;
beforeEach(()=>{vi.clearAllMocks();io.auth={user:{id:'owner'},loading:false};io.read.mockResolvedValue(Array.from({length:25},(_,i)=>item(i)));});
afterEach(unmountAll);
it('browses without a query, combines school/status filters and resets pages and filters',async()=>{
 const c=await mountComponent(<WritingDeskClient/>);await flush();
 expect(c.textContent).toContain('25 pieces of writing');expect(c.querySelectorAll('[data-writing-item]')).toHaveLength(20);
 await click(button('Next writing'));expect(c.querySelectorAll('[data-writing-item]')).toHaveLength(5);
 await change(select('University'),'9');expect(c.querySelectorAll('[data-writing-item]')).toHaveLength(12);
 await change(select('Draft status'),'current');expect(c.textContent).toContain('No writing matches');
 await click(button('Clear filters'));expect(c.querySelectorAll('[data-writing-item]')).toHaveLength(20);
 await change(input(),'Draft 24');expect(c.querySelector('[data-writing-item] a')?.getAttribute('href')).toBe('/essays?prompt=p&draft=24');
});
it('shows missing dates honestly and only classifies essays as current or other drafts',async()=>{
 io.read.mockResolvedValue([item(0),{...item(1),kind:'resume',isCurrent:null,updatedAt:'invalid',schoolId:null,schoolName:null}]);
 const c=await mountComponent(<WritingDeskClient/>);await flush();
 await change(select('Writing type'),'resume');
 expect(c.querySelectorAll('[data-writing-item]')).toHaveLength(1);expect(c.textContent).toContain('Update date unavailable');
 expect(c.querySelector('[data-writing-item]')?.textContent).not.toContain('Current draft');
 await change(select('Draft status'),'current');expect(c.querySelectorAll('[data-writing-item]')).toHaveLength(0);
});
it('retries a failed index without exposing backend details or false empty counts',async()=>{
 io.read.mockRejectedValueOnce(new Error('secret backend'));const c=await mountComponent(<WritingDeskClient/>);await flush();
 expect(c.textContent).toContain('Could not load your writing');expect(c.textContent).not.toContain('0 pieces');expect(c.textContent).not.toContain('secret backend');
 await click(button('Retry'));await flush();expect(c.textContent).toContain('25 pieces of writing');
});
it('clears filters/results on account change and ignores the previous owner response',async()=>{
 const pending=deferred<WritingItem[]>();io.read.mockReturnValueOnce(pending.promise).mockResolvedValueOnce([item(90)]);
 const c=document.createElement('div');document.body.append(c);const root=createRoot(c);
 try{
  await act(async()=>root.render(<WritingDeskClient/>));await change(input(),'old query');
  io.auth={user:{id:'other'},loading:false};await act(async()=>root.render(<WritingDeskClient/>));await flush();
  expect(input().value).toBe('');expect(c.textContent).toContain('Draft 90');
  await act(async()=>pending.resolve([item(1)]));await flush();expect(c.textContent).not.toContain('Draft 01');
  io.auth={user:null,loading:false};await act(async()=>root.render(<WritingDeskClient/>));expect(c.textContent).not.toContain('Draft 90');expect(c.textContent).toContain('Sign in');
 }finally{act(()=>root.unmount());}
});
it('empty writing offers existing tools and refresh discards the previous list while loading',async()=>{
 io.read.mockResolvedValueOnce([]);const c=await mountComponent(<WritingDeskClient/>);await flush();
 expect(c.textContent).toContain('Your writing starts here');
 expect(c.querySelector('a[href="/essays"]')).not.toBeNull();expect(c.querySelector('a[href="/resume-builder"]')).not.toBeNull();
 const pending=deferred<WritingItem[]>();io.read.mockReturnValueOnce(pending.promise);await click(button('Refresh writing'));
 expect(c.textContent).not.toContain('Your writing starts here');expect(c.textContent).toContain('Loading your writing');
 await act(async()=>pending.resolve([item(1)]));await flush();expect(c.textContent).toContain('Draft 01');
});
