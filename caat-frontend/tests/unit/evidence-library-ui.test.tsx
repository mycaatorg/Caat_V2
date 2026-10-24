// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountComponent, unmountAll, button, change, click, link, get, hasText } from './dom-helpers';
import type { EvidenceItem } from '@/lib/evidence-items';
const io=vi.hoisted(()=>({list:vi.fn(),usage:vi.fn(),update:vi.fn(),create:vi.fn(),remove:vi.fn(),links:vi.fn(),unlink:vi.fn(),tailor:vi.fn(),keep:vi.fn(),reset:vi.fn()}));
vi.mock('@/lib/supabase/client',()=>({supabase:{}}));
vi.mock('@/lib/evidence-items',async original=>({...await original<typeof import('@/lib/evidence-items')>(),listEvidenceItems:io.list,fetchItemUsage:io.usage,updateEvidenceItem:io.update,createEvidenceItem:io.create,deleteEvidenceItem:io.remove}));
vi.mock('@/lib/evidence-item-links',async original=>({...await original<typeof import('@/lib/evidence-item-links')>(),fetchItemLinks:io.links,unlinkItem:io.unlink,tailorItem:io.tailor,keepItemTailoring:io.keep,resetItemTailoring:io.reset}));
import { EvidenceLibraryCard } from '@/components/profile/EvidenceLibraryCard';
import { HubEvidenceItems } from '@/components/applications/hub-evidence-items';
const source:EvidenceItem={id:'i1',user_id:'u1',kind:'activity',title:'Debate',organisation:'Club',role:'Captain',description:'Source text',start_date:null,end_date:null,is_current:false,origin_key:null,revision:'v2',created_at:'2026-10-24'};
const linked={id:'l1',applicationId:'a1',itemId:'i1',item:source,revision:'r1',sourceRevision:'v1',tailoredAt:'2026-10-23',tailoredTitle:'My application title',tailoredBody:'My preserved text'};
beforeEach(()=>{vi.clearAllMocks();io.list.mockResolvedValue([source]);io.usage.mockResolvedValue({});io.links.mockResolvedValue([linked]);});
afterEach(unmountAll);
it('shows unavailable instead of empty and retry recovers',async()=>{
 io.list.mockRejectedValueOnce(new Error('Offline'));
 await mountComponent(<EvidenceLibraryCard/>);
 expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/could not load/i);
 expect(hasText(/Your library is empty/i)).toBe(false);
 await click(button('Retry library'));
 expect(hasText('Debate')).toBe(true);
});
it('preserves an edit draft when saving fails',async()=>{
 io.update.mockRejectedValue(new Error('Changed in another tab'));
 await mountComponent(<EvidenceLibraryCard/>);
 await click(button('Edit Debate'));
 const input=get('label','Title').querySelector('input')!;
 await change(input,'My unsaved title');
 await click(button('Save item'));
 expect(document.querySelector('[role="alert"]')?.textContent).toContain('Changed in another tab');
 expect(input.value).toBe('My unsaved title');
});
it('explains linked-source protection and shows the application',async()=>{
 io.usage.mockResolvedValue({i1:[{applicationId:'a1',schoolName:'Alpha University',tailored:true}]});
 await mountComponent(<EvidenceLibraryCard/>);
 expect(button('Delete Debate').disabled).toBe(true);
 expect(link(/Alpha University/).getAttribute('href')).toBe('/applications/a1');
 expect(hasText(/Unlink from these applications before deleting/i)).toBe(true);
});
it('keeps tailored text visible when its source changed',async()=>{
 await mountComponent(<HubEvidenceItems applicationId='a1' schoolName='Alpha University'/>);
 expect(hasText('My preserved text')).toBe(true);
 expect(hasText(/Library version updated/)).toBe(true);
 expect(hasText('Source text')).toBe(false);
});
it('requires unlink confirmation and retains the row on failure',async()=>{
 io.unlink.mockRejectedValue(new Error('Could not unlink'));
 await mountComponent(<HubEvidenceItems applicationId='a1' schoolName='Alpha University'/>);
 await click(button('Unlink My application title'));
 expect(io.unlink).not.toHaveBeenCalled();
 await click(button('Confirm unlink item'));
 expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not unlink');
 expect(hasText('My preserved text')).toBe(true);
 io.unlink.mockResolvedValue(undefined);
 await click(button('Confirm unlink item'));
 expect(hasText('My preserved text')).toBe(false);
 expect(hasText(/No library items linked yet/i)).toBe(true);
});
it('closes an older reset confirmation after keeping the latest tailoring',async()=>{
 io.keep.mockResolvedValue({...linked,revision:'r2',sourceRevision:'v2'});
 await mountComponent(<HubEvidenceItems applicationId='a1' schoolName='Alpha University'/>);
 await click(button('Use library version'));
 await click(button('Keep mine'));
 expect(document.querySelector('[aria-label="Reset item tailoring"]')).toBeNull();
 expect(hasText('My preserved text')).toBe(true);
});
