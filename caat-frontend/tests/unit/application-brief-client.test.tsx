// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {button,click,deferred,flush,mountComponent,unmountAll} from './dom-helpers';
import {briefHub} from './application-brief-fixture';
const io=vi.hoisted(()=>({read:vi.fn(),auth:{user:{id:'owner'} as {id:string}|null,loading:false}}));
vi.mock('@/app/(main)/applications/[id]/api',()=>({fetchApplicationHub:io.read}));
vi.mock('@/components/providers/AuthContext',()=>({useAuth:()=>io.auth}));
import ApplicationBriefClient from '@/app/(main)/applications/[id]/brief/client';
const preview=()=>document.querySelector('[data-application-brief-preview]')!;
const portal=()=>document.querySelector('[data-print-application]');
beforeEach(()=>{vi.clearAllMocks();io.auth={user:{id:'owner'},loading:false};io.read.mockResolvedValue(briefHub());vi.spyOn(window,'print').mockImplementation(()=>{});});
afterEach(()=>{unmountAll();vi.restoreAllMocks();});
it('previews the same notes choice that the print portal uses, without including notes by default',async()=>{
 await mountComponent(<ApplicationBriefClient applicationId="app"/>);await flush();expect(preview().textContent).toContain('Example University');expect(portal()?.textContent).not.toContain('Private application notes');
 await click(document.querySelector('input[type=checkbox]')!);expect(preview().textContent).toContain('Private application notes');expect(portal()?.textContent).toContain('Private application notes');
 await click(button('Print / Save PDF'));expect(window.print).toHaveBeenCalledTimes(1);
 await click(document.querySelector('input[type=checkbox]')!);expect(preview().textContent).not.toContain('Private application notes');expect(portal()?.textContent).not.toContain('Private application notes');
});
it('does not create a print portal on failure and recovers on retry',async()=>{
 io.read.mockRejectedValueOnce(new Error('private backend'));await mountComponent(<ApplicationBriefClient applicationId="app"/>);await flush();expect(portal()).toBeNull();expect(document.body.textContent).not.toContain('private backend');
 await click(button('Retry brief'));await flush();expect(portal()).not.toBeNull();expect(button('Print / Save PDF').disabled).toBe(false);
});
it.each(['account','application'])('discards an older %s response and removes the portal on sign-out',async(kind)=>{
 const pending=deferred<ReturnType<typeof briefHub>>();io.read.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(briefHub({schoolName:'New school'}));
 const c=document.createElement('div');document.body.append(c);const root=createRoot(c);
 try{
  await act(async()=>root.render(<ApplicationBriefClient applicationId="app"/>));expect(portal()).toBeNull();
  if(kind==='account')io.auth.user={id:'new-owner'};
  const id=kind==='application'?'new-app':'app';await act(async()=>root.render(<ApplicationBriefClient applicationId={id}/>));await flush();
  await act(async()=>pending.resolve(briefHub()));expect(portal()?.textContent).toContain('New school');expect(portal()?.textContent).not.toContain('Example University');
  io.auth.user=null;await act(async()=>root.render(<ApplicationBriefClient applicationId={id}/>));expect(portal()).toBeNull();expect(document.body.textContent).not.toContain('New school');
 }finally{act(()=>root.unmount());c.remove();}
});

import { scholarshipBriefHub } from './application-brief-fixture';
const scholarshipChoice=()=>document.querySelector<HTMLInputElement>('input[name="includeScholarships"]')!;
it('includes scholarship checklists only on explicit selection in both preview and print',async()=>{
 io.read.mockResolvedValue(scholarshipBriefHub());await mountComponent(<ApplicationBriefClient applicationId="app"/>);await flush();
 expect(preview().textContent).not.toContain('Attached award');await click(scholarshipChoice());
 expect(preview().textContent).toContain('Attached award');expect(portal()?.textContent).toContain('Attached award');expect(portal()?.textContent).not.toContain('Other application award');
 expect(portal()?.textContent).not.toContain('Private application notes');await click(scholarshipChoice());expect(portal()?.textContent).not.toContain('Attached award');
});
it.each(['savedScholarshipsUnavailable','prepChecksUnavailable'] as const)('blocks requested incomplete checklists for %s and lets the student exclude them',async key=>{
 io.read.mockResolvedValue(scholarshipBriefHub({[key]:true}));await mountComponent(<ApplicationBriefClient applicationId="app"/>);await flush();await click(scholarshipChoice());
 expect(document.querySelector('[role=alert]')?.textContent).toContain('Could not load the attached scholarship checklists');
 expect(button('Print / Save PDF').disabled).toBe(true);expect(portal()).toBeNull();expect(preview().textContent).not.toContain('Attached award');
 await click(scholarshipChoice());expect(button('Print / Save PDF').disabled).toBe(false);expect(portal()).not.toBeNull();
});
it('refreshes unavailable optional data without printing stale snapshots, then keeps the requested choice',async()=>{
 const pending=deferred<ReturnType<typeof briefHub>>();io.read.mockResolvedValueOnce(scholarshipBriefHub({prepChecksUnavailable:true})).mockReturnValueOnce(pending.promise);
 await mountComponent(<ApplicationBriefClient applicationId="app"/>);await flush();await click(scholarshipChoice());await click(button('Refresh brief'));
 expect(portal()).toBeNull();expect(document.querySelector('[data-application-brief-preview]')).toBeNull();
 await act(async()=>pending.resolve(scholarshipBriefHub()));expect((scholarshipChoice() as HTMLInputElement).checked).toBe(true);expect(portal()?.textContent).toContain('Attached award');expect(button('Print / Save PDF').disabled).toBe(false);
});
it.each(['account','application'])('resets scholarship and notes choices on an %s change',async kind=>{
 io.read.mockResolvedValue(scholarshipBriefHub());const c=document.createElement('div');document.body.append(c);const root=createRoot(c);
 try {
  await act(async()=>root.render(<ApplicationBriefClient applicationId="app"/>));await flush();await click(scholarshipChoice());await click(c.querySelector<HTMLInputElement>('input[type=checkbox]')!);
  expect(portal()?.textContent).toContain('Attached award');expect(portal()?.textContent).toContain('Private application notes');
  if(kind==='account')io.auth.user={id:'other-owner'};
  await act(async()=>root.render(<ApplicationBriefClient applicationId={kind==='application'?'new-app':'app'}/>));await flush();
  expect((scholarshipChoice() as HTMLInputElement).checked).toBe(false);expect(portal()?.textContent).not.toContain('Attached award');expect(portal()?.textContent).not.toContain('Private application notes');
 }finally{act(()=>root.unmount());c.remove();}
});
