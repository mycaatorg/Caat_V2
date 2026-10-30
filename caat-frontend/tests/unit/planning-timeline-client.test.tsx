// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {button,change,click,deferred,flush,mountComponent,unmountAll} from './dom-helpers';
import type {TimelineData} from '@/lib/planning-timeline';
const io=vi.hoisted(()=>({read:vi.fn(),auth:{user:{id:'owner'} as {id:string}|null,loading:false}}));
vi.mock('@/lib/planning-timeline-data',()=>({loadPlanningTimeline:io.read}));
vi.mock('@/lib/supabase/client',()=>({supabase:{}}));
vi.mock('@/components/providers/AuthContext',()=>({useAuth:()=>io.auth}));
import PlannerClient from '@/app/(main)/workspace/planner/client';
const data=():TimelineData=>({items:Array.from({length:21},(_,i)=>({id:`task-${i}`,title:`Task ${i}`,dateISO:'2099-12-01',source:'task',href:'/today?view=todos'})),undatedTasks:2});
beforeEach(()=>{vi.clearAllMocks();io.auth={user:{id:'owner'},loading:false};io.read.mockResolvedValue(data());});
afterEach(()=>unmountAll());
it('paginates complete results and resets on search/source changes',async()=>{
 await mountComponent(<PlannerClient/>);await flush();expect(document.querySelectorAll('[data-timeline-item]')).toHaveLength(20);
 await click(button('Next timeline page'));expect(document.querySelectorAll('[data-timeline-item]')).toHaveLength(1);expect(document.body.textContent).toContain('Task 20');
 await change(document.querySelector('input[aria-label="Search timeline"]')!,'Task 0');expect(document.body.textContent).toContain('1 item');expect(document.querySelectorAll('[data-timeline-item]')).toHaveLength(1);
 await change(document.querySelector('select[aria-label="Source"]')!,'app');expect(document.body.textContent).toContain('No dates match these filters');expect(document.querySelectorAll('[data-timeline-item]')).toHaveLength(0);
});
it('removes old counts on failed refresh, retries and clamps a shorter result page',async()=>{
 await mountComponent(<PlannerClient/>);await flush();await click(button('Next timeline page'));
 io.read.mockRejectedValueOnce(new Error('private'));await click(button('Refresh timeline'));await flush();expect(document.querySelectorAll('[data-timeline-item]')).toHaveLength(0);expect(document.body.textContent).not.toContain('21 items');expect(document.body.textContent).not.toContain('private');
 io.read.mockResolvedValueOnce({...data(),items:data().items.slice(0,1)});await click(button('Retry timeline'));await flush();expect(document.querySelectorAll('[data-timeline-item]')).toHaveLength(1);expect(document.body.textContent).toContain('Page 1 of 1');
});
it('discards an old account read and clears private data on sign-out',async()=>{
 const pending=deferred<TimelineData>();io.read.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({...data(),items:[{id:'new',title:'New owner',dateISO:'2099-01-01',source:'app',href:'/applications/new'}]});
 const c=document.createElement('div');document.body.append(c);const root=createRoot(c);
 try{await act(async()=>root.render(<PlannerClient/>));io.auth.user={id:'new'};await act(async()=>root.render(<PlannerClient/>));await flush();await act(async()=>pending.resolve(data()));expect(document.body.textContent).toContain('New owner');expect(document.body.textContent).not.toContain('Task 20');io.auth.user=null;await act(async()=>root.render(<PlannerClient/>));expect(document.body.textContent).not.toContain('New owner');}finally{act(()=>root.unmount());c.remove();}
});
