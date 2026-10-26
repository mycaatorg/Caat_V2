// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import {button,click,queryButton} from './dom-helpers';
const roots:Root[]=[];
async function render(element:React.ReactElement){
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const root=createRoot(document.body.appendChild(document.createElement('div')));roots.push(root);
 await act(async()=>root.render(element));return {rerender:async(next:React.ReactElement)=>{await act(async()=>root.render(next));}};
}
function cleanup(){roots.splice(0).forEach(root=>act(()=>root.unmount()));document.body.innerHTML='';}
const screen={
 getByRole:(role:string,options?:{name:string})=>role==='checkbox'?document.querySelector('input[type=checkbox]') as HTMLElement:button(options!.name),
 findByRole:async(_role:string,options:{name:string})=>{await act(async()=>{});return button(options.name);},
 queryByRole:(_role:string,options:{name:string})=>queryButton(options.name),
 findByText:async(text:string)=>{await act(async()=>{});expect(document.body.textContent).toContain(text);return true;},
 getByText:(text:RegExp)=>{expect(document.body.textContent).toMatch(text);return true;},
 queryByText:(text:string)=>document.body.textContent?.includes(text)?true:null,
};
const fireEvent=Object.assign(async(el:Document,event:Event)=>{await act(async()=>{el.dispatchEvent(event);});},{click});
async function waitFor(fn:()=>void){await act(async()=>{});fn();}
const mocks=vi.hoisted(()=>({read:vi.fn(),revoke:vi.fn(),prepare:vi.fn()}));
vi.mock('react-intersection-observer',()=>({useInView:()=>({ref:()=>{},inView:true})}));
vi.mock('@/app/(main)/communities/actions',()=>({readCommunityResumeAction:mocks.read,revokeCommunityResumeAction:mocks.revoke,prepareResumeShareAction:mocks.prepare}));
import { ResumeInlinePreview } from '@/components/communities/ResumeInlinePreview';
import { ResumeSharePicker } from '@/components/communities/ResumeSharePicker';
const snapshot={title:'Synthetic resume title',sections:[{label:'Experience',html:'<p>Final section content</p>'}]};
describe('community resume reader',()=>{
 beforeEach(()=>{mocks.read.mockReset();mocks.revoke.mockReset();mocks.prepare.mockReset();});
 afterEach(cleanup);
 it('shows errors honestly and supports retry, then opens the entire shared copy',async()=>{
  mocks.read.mockResolvedValueOnce({snapshot:null,error:'Could not load. Please try again.'}).mockResolvedValue({snapshot,error:null});
  await render(<ResumeInlinePreview postId="post" isOwner={false}/>);
  expect(await screen.findByText('Could not load. Please try again.')).toBeTruthy();expect(screen.queryByText('Empty resume')).toBeNull();
  await fireEvent.click(screen.getByRole('button',{name:'Retry resume'}));
  await fireEvent.click(await screen.findByRole('button',{name:'Read shared resume'}));
  expect(await screen.findByText('Final section content')).toBeTruthy();
 });
 it('ignores responses for a previous post',async()=>{
  let resolve!:(value:unknown)=>void;mocks.read.mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValue({snapshot:null,error:'Unavailable'});
  const view=await render(<ResumeInlinePreview postId="old" isOwner={false}/>);
  await view.rerender(<ResumeInlinePreview postId="new" isOwner={false}/>);
  await screen.findByText('Unavailable');await act(async()=>resolve({snapshot,error:null}));
  expect(screen.queryByText('Synthetic resume title')).toBeNull();
 });
 it('removes only after confirmation, clears the copy and does not claim a failed removal worked',async()=>{
  mocks.read.mockResolvedValue({snapshot,error:null});mocks.revoke.mockResolvedValueOnce({error:'Try again'}).mockResolvedValue({error:null});
  await render(<ResumeInlinePreview postId="post" isOwner/>);
  await fireEvent.click(await screen.findByRole('button',{name:'Remove shared copy'}));expect(mocks.revoke).not.toHaveBeenCalled();
  await fireEvent.click(screen.getByRole('button',{name:'Confirm removal'}));await screen.findByText('Try again');
  await fireEvent.click(screen.getByRole('button',{name:'Confirm removal'}));await screen.findByText('Shared copy removed.');
  expect(screen.queryByRole('button',{name:'Read shared resume'})).toBeNull();
 });
 it('keeps the rendered content stable during an unchanged access refresh',async()=>{
  mocks.read.mockImplementation(async()=>({snapshot:JSON.parse(JSON.stringify(snapshot)),error:null}));
  await render(<ResumeInlinePreview postId="post" isOwner={false}/>);await click(button('Read shared resume'));
  const content=document.querySelector('article p');expect(content?.textContent).toBe('Final section content');
  await act(async()=>{window.dispatchEvent(new Event('focus'));});
  expect(document.querySelector('article p')).toBe(content);
 });
 it('does not let an old removal response clear a different post',async()=>{
  let resolve!:(value:unknown)=>void;mocks.read.mockResolvedValue({snapshot,error:null});mocks.revoke.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const view=await render(<ResumeInlinePreview postId="old" isOwner/>);
  await click(button('Remove shared copy'));await click(button('Confirm removal'));
  await view.rerender(<ResumeInlinePreview postId="new" isOwner/>);
  await act(async()=>resolve({error:null}));
  expect(queryButton('Read shared resume')).not.toBeNull();expect(document.body.textContent).not.toContain('Shared copy removed.');
 });
 it('allows removal from management when the original post is no longer accessible',async()=>{
  mocks.read.mockResolvedValue({snapshot:null,error:'Unavailable'});mocks.revoke.mockResolvedValue({error:null});
  await render(<ResumeInlinePreview postId="post" isOwner management/>);
  await click(button('Remove shared copy'));await click(button('Confirm removal'));expect(document.body.textContent).toContain('Shared copy removed.');
 });
 it('clears content when the tab is hidden',async()=>{
  mocks.read.mockResolvedValue({snapshot,error:null});await render(<ResumeInlinePreview postId="post" isOwner={false}/>);
  await screen.findByRole('button',{name:'Read shared resume'});
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});await fireEvent(document,new Event('visibilitychange'));
  expect(screen.queryByRole('button',{name:'Read shared resume'})).toBeNull();
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
 });
});
describe('resume share consent',()=>{
 afterEach(cleanup);
 it('shows the exact copy and requires explicit consent; changed selection discards stale preview',async()=>{
  let resolve!:(value:unknown)=>void;mocks.prepare.mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValue({snapshot:{...snapshot,title:'Second resume'},error:null});const onChange=vi.fn();
  const view=await render(<ResumeSharePicker resumeId="first" onChange={onChange} anonymous/>);
  await fireEvent.click(screen.getByRole('button',{name:'Preview shared copy'}));
  await view.rerender(<ResumeSharePicker resumeId="second" onChange={onChange} anonymous/>);
  await act(async()=>resolve({snapshot,error:null}));expect(screen.queryByText('Synthetic resume title')).toBeNull();
  await fireEvent.click(screen.getByRole('button',{name:'Preview shared copy'}));await screen.findByText('Final section content');
  expect(screen.getByText(/can identify you/i)).toBeTruthy();
  expect(onChange.mock.lastCall?.[0]).toBeNull();
  await fireEvent.click(screen.getByRole('checkbox'));await waitFor(()=>expect(onChange.mock.lastCall?.[0]?.snapshot.title).toBe('Second resume'));
 });
});
