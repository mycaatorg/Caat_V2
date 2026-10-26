// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createMockSupabase} from './mock-supabase';
import {button,click} from './dom-helpers';
const mock=vi.hoisted(()=>({db:null as unknown,remove:vi.fn()}));
vi.mock('@/lib/supabase-server',()=>({createSupabaseServer:async()=>mock.db}));
vi.mock('@/app/(main)/communities/actions',()=>({removeOwnCommunityContentAction:mock.remove}));
import {listOwnCommunityContentAction,removeOwnCommunityContentAction} from '@/app/(main)/communities/actions/owned-content';
import {OwnedContentManager} from '@/components/communities/OwnedContentManager';
const id='550e8400-e29b-41d4-a716-446655440001';
const row={id,kind:'post' as const,content:'My private text',created_at:'2026-10-27T00:00:00Z',removed:false};
let root:Root|undefined;
async function render(){Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});root=createRoot(document.body.appendChild(document.createElement('div')));await act(async()=>root!.render(<OwnedContentManager rows={[row]}/>));}
afterEach(()=>{if(root)act(()=>root!.unmount());root=undefined;document.body.innerHTML='';});
beforeEach(()=>{mock.db=createMockSupabase({user:{id:'owner'},rpc:()=>({data:true})});mock.remove.mockReset();});
describe('own content actions',()=>{
 it('accepts PostgreSQL character-bounded Unicode rows including the pagination sentinel',async()=>{
  const unicode='a'.repeat(499)+'🎓';
  mock.db=createMockSupabase({user:{id:'owner'},rpc:()=>({data:Array.from({length:21},()=>({...row,content:unicode}))})});
  const result=await listOwnCommunityContentAction(0);expect(result.error).toBeNull();expect(result.rows[0].content).toBe(unicode);expect(result.more).toBe(true);
 });

 it('requires login and validates identity/kind/page before any removal',async()=>{
  expect((await removeOwnCommunityContentAction('other',id)).error).toBeTruthy();
  expect((await removeOwnCommunityContentAction('post','invalid')).error).toBeTruthy();
  expect((await listOwnCommunityContentAction(-1)).error).toBeTruthy();
  mock.db=createMockSupabase({user:null});expect((await removeOwnCommunityContentAction('post',id)).error).toMatch(/sign in/i);
 });
 it('distinguishes false/error/thrown removal from success without leaking internals',async()=>{
  for(const response of [{data:false},{error:{message:'secret db detail'}}]){mock.db=createMockSupabase({user:{id:'owner'},rpc:()=>response});const result=await removeOwnCommunityContentAction('post',id);expect(result.error).toBeTruthy();expect(result.error).not.toContain('secret');}
  mock.db=createMockSupabase({user:{id:'owner'},rpc:()=>{throw Error('secret');}});expect((await removeOwnCommunityContentAction('comment',id)).error).toMatch(/try again/i);
  mock.db=createMockSupabase({user:{id:'owner'},rpc:()=>({data:true})});expect((await removeOwnCommunityContentAction('comment',id)).error).toBeNull();
 });
 it('bounds listing and returns plain text only, with a next-page sentinel',async()=>{
  mock.db=createMockSupabase({user:{id:'owner'},rpc:()=>({data:Array.from({length:21},()=>({...row,content:'<p>Mine</p>',group_name:'SECRET'}))})});
  const result=await listOwnCommunityContentAction(0);expect(result.rows).toHaveLength(20);expect(result.more).toBe(true);expect(result.rows[0].content).toBe('Mine');expect(JSON.stringify(result)).not.toContain('SECRET');
 });
 it('returns honest listing errors',async()=>{mock.db=createMockSupabase({user:{id:'owner'},rpc:()=>({error:{message:'secret'}})});expect((await listOwnCommunityContentAction(0)).error).toMatch(/try again/i);});
});
describe('own content removal UI',()=>{
 it('requires confirmation and preserves text on failure, then clears it after retry',async()=>{
  mock.remove.mockResolvedValueOnce({error:'Try again'}).mockResolvedValue({error:null});await render();
  await click(button('Remove post'));expect(mock.remove).not.toHaveBeenCalled();await click(button('Confirm removal'));
  expect(document.body.textContent).toContain('My private text');expect(document.body.textContent).toContain('Try again');
  await click(button('Confirm removal'));expect(document.body.textContent).not.toContain('My private text');expect(document.body.textContent).toContain('Content removed');
 });
 it('disables repeat submissions while pending and recovers after a rejected request',async()=>{
  let reject!:(reason:Error)=>void;mock.remove.mockImplementation(()=>new Promise((_,r)=>{reject=r;}));await render();await click(button('Remove post'));await click(button('Confirm removal'));
  expect((button('Removing…') as HTMLButtonElement).disabled).toBe(true);await act(async()=>reject(Error('network')));
  expect(document.body.textContent).toContain('My private text');expect(document.body.textContent).toMatch(/try again/i);expect((button('Confirm removal') as HTMLButtonElement).disabled).toBe(false);
 });
});
