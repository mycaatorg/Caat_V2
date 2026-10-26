// @vitest-environment jsdom
import React,{act} from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {mountComponent,unmountAll,click,button,deferred} from './dom-helpers';
const api=vi.hoisted(()=>({loadShareCandidates:vi.fn(),loadShares:vi.fn(),previewShare:vi.fn(),createShare:vi.fn(),replaceShare:vi.fn(),revokeShare:vi.fn(),removeShare:vi.fn(),readSharedShortlist:vi.fn()}));
vi.mock('@/lib/shortlist-sharing',()=>api);
vi.mock('@/lib/shared-shortlist-reader',()=>api);
import {ShareManager} from '@/components/shortlist/share-manager';
import {SharedShortlist} from '@/components/shortlist/shared-shortlist';
const item={kind:'course' as const,id:'course-1',title:'Engineering',details:['Example University'],sourceUrl:null};
const snapshot={items:[item],created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()};
const record={...snapshot,id:'share-1',user_id:'owner',token_hash:'hash',revision:'revision',revoked_at:null};
beforeEach(()=>{vi.resetAllMocks();api.loadShareCandidates.mockResolvedValue([{kind:item.kind,id:item.id,label:item.title,description:'Example University'}]);api.loadShares.mockResolvedValue([]);api.previewShare.mockResolvedValue([item]);api.createShare.mockResolvedValue(record);api.readSharedShortlist.mockResolvedValue(snapshot);window.location.hash='a'.repeat(64);Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});});
afterEach(()=>{unmountAll();vi.useRealTimers();window.location.hash='';});
async function preview(){await click(document.querySelector('input[type=checkbox]')!);await click(button('Preview selected items'));}
it('requires selection and exact preview before publishing, with a selectable fallback for blocked clipboard',async()=>{
 await mountComponent(<ShareManager/>);expect(button('Preview selected items').disabled).toBe(true);await preview();
 expect(document.querySelector('[data-share-preview]')?.textContent).toContain('Engineering');await click(button('Create shared link'));
 expect(api.createShare).toHaveBeenCalledWith([{kind:'course',id:'course-1'}],[item],expect.stringMatching(/^[a-f0-9]{64}$/));
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error('blocked'))}});
 await click(button('Copy link'));expect(document.body.textContent).toContain('Select and copy');expect((document.querySelector('[aria-label="Shared link"]') as HTMLInputElement).value).toContain('/share/shortlist#');
});
it('keeps the preview after a failed publish and retries with the same capability',async()=>{
 api.createShare.mockRejectedValueOnce(new Error('Could not confirm the link change.'));await mountComponent(<ShareManager/>);await preview();await click(button('Create shared link'));expect(document.body.textContent).toContain('Could not confirm');await click(button('Create shared link'));expect(api.createShare.mock.calls[0][2]).toBe(api.createShare.mock.calls[1][2]);
});
it('still permits managing existing links when saved items fail to load',async()=>{
 api.loadShareCandidates.mockRejectedValue(new Error('Saved items unavailable'));api.loadShares.mockResolvedValue([record]);api.revokeShare.mockResolvedValue({...record,revoked_at:new Date().toISOString()});await mountComponent(<ShareManager/>);await click(button('Revoke link'));expect(api.revokeShare).toHaveBeenCalledWith('share-1');expect(document.body.textContent).toContain('Revoked');
});
it('clears recipient content when refresh finds a revoked link',async()=>{
 await mountComponent(<SharedShortlist/>);expect(document.body.textContent).toContain('Engineering');api.readSharedShortlist.mockResolvedValue(null);await click(button('Refresh link'));expect(document.body.textContent).not.toContain('Engineering');expect(document.body.textContent).toContain('Link unavailable');
});
it('ignores an earlier response after the capability changes',async()=>{
 const old=deferred<typeof snapshot|null>();api.readSharedShortlist.mockReturnValueOnce(old.promise).mockResolvedValue(null);await mountComponent(<SharedShortlist/>);
 await act(async()=>{window.location.hash='b'.repeat(64);window.dispatchEvent(new Event('hashchange'));});await act(async()=>old.resolve(snapshot));expect(document.body.textContent).not.toContain('Engineering');
});
it('clears on hidden and does not restore from an in-flight response',async()=>{
 await mountComponent(<SharedShortlist/>);const pending=deferred<typeof snapshot|null>();api.readSharedShortlist.mockReturnValue(pending.promise);
 await act(async()=>window.dispatchEvent(new Event('focus')));
 await act(async()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});await act(async()=>pending.resolve(snapshot));expect(document.body.textContent).not.toContain('Engineering');
});
it('clears recipient data on an unsuccessful refresh rather than retaining stale content',async()=>{
 await mountComponent(<SharedShortlist/>);api.readSharedShortlist.mockRejectedValue(new Error('offline'));await click(button('Refresh link'));expect(document.body.textContent).not.toContain('Engineering');expect(document.body.textContent).toContain('Could not check this link');
});
it('clears the snapshot at expiry without waiting for a poll',async()=>{
 vi.useFakeTimers();api.readSharedShortlist.mockResolvedValue({...snapshot,expires_at:new Date(Date.now()+1000).toISOString()});await mountComponent(<SharedShortlist/>);expect(document.body.textContent).toContain('Engineering');await act(async()=>vi.advanceTimersByTimeAsync(1001));expect(document.body.textContent).not.toContain('Engineering');expect(document.body.textContent).toContain('Link unavailable');
});
it('ignores a refresh result from history started before revocation',async()=>{
 api.loadShares.mockResolvedValue([record]);api.revokeShare.mockResolvedValue({...record,revoked_at:new Date().toISOString()});await mountComponent(<ShareManager/>);const stale=deferred<typeof record[]>();api.loadShares.mockReturnValue(stale.promise);await click(button('Refresh links'));await click(button('Revoke link'));await act(async()=>stale.resolve([record]));expect(document.body.textContent).toContain('Revoked');expect(document.body.textContent).not.toContain('Active until');
});
