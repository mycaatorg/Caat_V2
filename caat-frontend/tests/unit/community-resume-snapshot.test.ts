import { describe, expect, it } from 'vitest';
import { buildResumeSnapshot, sanitizeResumeSnapshot } from '@/lib/community-resume-snapshot';

const row = (patch = {}) => ({section_key:'custom',label:'Experience',mode:'free',content_html:'<p>Shared work</p>',structured_data:{privateNote:'never share'},...patch});
describe('community resume snapshot', () => {
 it('strips active HTML, unsafe links, arbitrary CSS and metadata before preview/read', () => {
  const snapshot = buildResumeSnapshot('My resume', [row({content_html:'<p style="position:fixed" onclick="evil()"><strong>Work</strong></p><img src=x onerror="evil()"><script>evil()</script><a href="javascript:evil()">bad</a><a href="https://example.com">safe</a>'})]);
  const json=JSON.stringify(snapshot);
  expect(json).not.toMatch(/onclick|onerror|javascript:|<script|<img|position:fixed|privateNote/);
  expect(snapshot.sections[0].html).toContain('<strong>Work</strong>');
  expect(snapshot.sections[0].html).toContain('noopener noreferrer nofollow');
  expect(Object.keys(snapshot.sections[0])).toEqual(['label','html']);
  expect(sanitizeResumeSnapshot(snapshot)).toEqual(snapshot);
 });
 it('shares only published guided content and never the inactive free draft', () => {
  const result=buildResumeSnapshot('Resume',[row({section_key:'education',mode:'guided',content_html:'<p>SECRET INACTIVE DRAFT</p>',structured_data:{entries:[{institution:'University',degree:'BSc',startDate:'2024',current:true,description:'<p>Note<img src=x onerror=evil()></p>'}],privateNote:'SECRET METADATA'}})]);
  expect(result.sections[0].html).toContain('University');
  expect(result.sections[0].html).toContain('Present');
  expect(JSON.stringify(result)).not.toMatch(/SECRET|<img|onerror/);
 });
 it('shares only free content when inactive guided data exists', () => {
  expect(JSON.stringify(buildResumeSnapshot('Resume',[row({structured_data:{entries:[{institution:'SECRET'}]}})]))).not.toContain('SECRET');
 });
 it('renders personal details as escaped text without invented placeholders', () => {
  const result=buildResumeSnapshot('Resume',[row({section_key:'personal',mode:'guided',structured_data:{fullName:'<img src=x>',email:'student@example.com',privateNote:'SECRET'}})]);
  expect(result.sections[0].html).toContain('&lt;img');
  expect(result.sections[0].html).toContain('student@example.com');
  expect(JSON.stringify(result)).not.toMatch(/SECRET|JOHN DOE|john@example|Sydney/);
 });
 it('rejects malformed structured arrays rather than exposing raw fallback drafts', () => {
  expect(()=>buildResumeSnapshot('Resume',[row({section_key:'education',mode:'guided',structured_data:{entries:[null]},content_html:'SECRET'})])).toThrow();
 });
 it('rejects oversize, empty and malformed snapshots', () => {
  expect(()=>sanitizeResumeSnapshot({title:'Resume',sections:[]})).toThrow();
  expect(()=>sanitizeResumeSnapshot({title:'Resume',sections:[{label:'x',html:'x'.repeat(20001)}]})).toThrow();
  expect(()=>sanitizeResumeSnapshot({title:'Resume',sections:[{label:'x',html:'<script>evil()</script>'}]})).toThrow();
  expect(()=>sanitizeResumeSnapshot({title:'Resume',sections:[null]})).toThrow();
 });
 it('sanitizes supplied snapshots again and strips extra fields', () => {
  const result=sanitizeResumeSnapshot({title:'Resume',ownerId:'secret',sections:[{label:'Work',html:'<p onclick="bad()">Safe</p>',structuredData:{secret:1}}]});
  expect(result).toEqual({title:'Resume',sections:[{label:'Work',html:'<p>Safe</p>'}]});
 });
});
