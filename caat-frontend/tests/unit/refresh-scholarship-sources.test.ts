import { describe, expect, it, vi } from 'vitest';
import {
  classifyCheck,
  contentHash,
  createSupabaseStore,
  extractVisibleText,
  groupRowsByUrl,
  normaliseUrl,
  parseArgs,
  planScholarshipUpdates,
  runRefresh,
} from '@/scripts/refresh-scholarship-sources.mjs';
import { createMockSupabase } from './mock-supabase';

type Row = { id: string; external_url: string | null; last_verified_at: string | null; source_last_synced_at: string | null; is_active: boolean; raw_payload: Record<string, unknown> | null };
const row = (id: string, external_url: string | null, extra: Partial<Row> = {}): Row => ({
  id, external_url, last_verified_at: '2026-06-01T00:00:00.000Z', source_last_synced_at: '2026-06-01T00:00:00.000Z', is_active: true, raw_payload: { title: 'Kept' }, ...extra,
});

const page = (main: string, chrome = '') => `<!doctype html><html><head><title>t</title><style>.a{}</style></head><body>
  <nav>${chrome}Home | Apply</nav><script>window.x=${chrome.length}</script>
  <main>${main}</main><footer>${chrome} Copyright</footer></body></html>`;

describe('url normalisation', () => {
  it('drops the fragment, trims, and keeps only http(s)', () => {
    expect(normaliseUrl('  https://uni.example/award#apply ')).toBe('https://uni.example/award');
    expect(normaliseUrl('https://uni.example/award?id=2#x')).toBe('https://uni.example/award?id=2');
    expect(normaliseUrl('mailto:office@uni.example')).toBeNull();
    expect(normaliseUrl('not a url')).toBeNull();
    expect(normaliseUrl('')).toBeNull();
    expect(normaliseUrl(null)).toBeNull();
  });

  it('groups rows that differ only by fragment under one url', () => {
    const groups = groupRowsByUrl([
      row('a', 'https://uni.example/awards#one'),
      row('b', 'https://uni.example/awards#two'),
      row('c', 'https://uni.example/other'),
      row('d', null),
      row('e', 'ftp://uni.example/file'),
    ]);
    expect([...groups.keys()]).toEqual(['https://uni.example/awards', 'https://uni.example/other']);
    expect(groups.get('https://uni.example/awards')!.map((r: Row) => r.id)).toEqual(['a', 'b']);
  });
});

describe('content hash', () => {
  it('uses <main> and ignores scripts, styles, nav, footer and whitespace', () => {
    expect(extractVisibleText(page('<h1>Award</h1>\n  <p>Value:   $5,000&nbsp;a year</p>'))).toBe('Award Value: $5,000 a year');
    const a = contentHash(page('<h1>Award</h1><p>Value $5,000</p>', 'v1'), 'text/html');
    const b = contentHash(page('<h1>Award</h1>\n\n   <p>Value    $5,000</p>', 'version two of the chrome'), 'text/html; charset=utf-8');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('falls back to <body> when there is no <main>', () => {
    const html = '<html><body><nav>menu</nav><div>Closing date 1 March</div><footer>f</footer></body></html>';
    expect(extractVisibleText(html)).toBe('Closing date 1 March');
  });

  it('changes when the content changes', () => {
    expect(contentHash(page('<p>Value $5,000</p>'), 'text/html')).not.toBe(contentHash(page('<p>Value $6,000</p>'), 'text/html'));
    expect(contentHash(page('<p>Closes 1 March</p>'), 'text/html')).not.toBe(contentHash(page('<p>Closes 2 March</p>'), 'text/html'));
  });

  it('hashes non-HTML bodies as raw bytes', () => {
    expect(contentHash('%PDF-1 a', 'application/pdf')).not.toBe(contentHash('%PDF-1  a', 'application/pdf'));
  });
});

describe('classification', () => {
  const ok = { status: 200, hash: 'h1' };
  it('baseline when no reference hash exists', () => {
    expect(classifyCheck({ ...ok, reference: null, previous: null }).outcome).toBe('baseline');
  });
  it('unchanged and changed against the reference hash', () => {
    expect(classifyCheck({ ...ok, reference: { content_hash: 'h1' }, previous: null }).outcome).toBe('unchanged');
    expect(classifyCheck({ ...ok, reference: { content_hash: 'h0' }, previous: null }).outcome).toBe('changed');
  });
  it('unreachable on network errors, timeouts, 5xx, 429 and other non-2xx', () => {
    expect(classifyCheck({ error: 'timeout after 15000 ms', reference: null, previous: null }).outcome).toBe('unreachable');
    for (const status of [500, 502, 503, 429, 403, 401]) {
      expect(classifyCheck({ status, reference: { content_hash: 'h1' }, previous: null }).outcome).toBe('unreachable');
    }
  });
  it('gone needs a 404/410 on this run and the previous stored check', () => {
    expect(classifyCheck({ status: 404, reference: null, previous: null })).toMatchObject({ outcome: 'unreachable', detail: expect.stringMatching(/first/) });
    expect(classifyCheck({ status: 410, reference: null, previous: { http_status: 200 } }).outcome).toBe('unreachable');
    expect(classifyCheck({ status: 404, reference: null, previous: { http_status: 503 } }).outcome).toBe('unreachable');
    expect(classifyCheck({ status: 404, reference: null, previous: { http_status: 410 } }).outcome).toBe('gone');
    expect(classifyCheck({ status: 410, reference: null, previous: { http_status: 404 } }).outcome).toBe('gone');
  });
});

describe('scholarship updates', () => {
  const checkedAt = '2026-10-24T01:02:03.000Z';
  const rows = [
    row('old', 'https://u.example/a', { last_verified_at: '2026-06-01T00:00:00.000Z' }),
    row('same', 'https://u.example/a#x', { last_verified_at: checkedAt }),
    row('null', 'https://u.example/a', { last_verified_at: null }),
  ];
  it('only unchanged advances last_verified_at, and only rows whose value would change', () => {
    const plan = planScholarshipUpdates(rows, { outcome: 'unchanged', checked_at: checkedAt });
    expect(plan).toEqual([
      { id: 'old', patch: { last_verified_at: checkedAt } },
      { id: 'null', patch: { last_verified_at: checkedAt } },
    ]);
  });
  it('never moves last_verified_at backwards', () => {
    const plan = planScholarshipUpdates([row('newer', 'https://u.example/a', { last_verified_at: '2026-10-25T00:00:00.000Z' })], { outcome: 'unchanged', checked_at: checkedAt });
    expect(plan).toEqual([]);
  });
  it('changed sets source_last_synced_at only', () => {
    const plan = planScholarshipUpdates(rows, { outcome: 'changed', checked_at: checkedAt });
    expect(plan).toHaveLength(3);
    for (const { patch } of plan) expect(patch).toEqual({ source_last_synced_at: checkedAt });
  });
  it('gone deactivates and merges the reason into raw_payload without dropping fields', () => {
    const plan = planScholarshipUpdates([rows[0]], { outcome: 'gone', checked_at: checkedAt, http_status: 404, url: 'https://u.example/a', run_id: 'run-1' });
    expect(plan).toEqual([{ id: 'old', patch: {
      is_active: false,
      raw_payload: { title: 'Kept', source_check: { outcome: 'gone', http_status: 404, url: 'https://u.example/a', checked_at: checkedAt, run_id: 'run-1', reason: expect.stringMatching(/404/) } },
    } }]);
  });
  it('unreachable and baseline write nothing', () => {
    expect(planScholarshipUpdates(rows, { outcome: 'unreachable', checked_at: checkedAt })).toEqual([]);
    expect(planScholarshipUpdates(rows, { outcome: 'baseline', checked_at: checkedAt })).toEqual([]);
  });
});

function fakeStore(rows: Row[], history: Record<string, { previous?: object | null; reference?: object | null }> = {}) {
  let n = 0;
  return {
    loadActiveScholarships: vi.fn(async () => rows),
    latestChecks: vi.fn(async (url: string) => ({ previous: history[url]?.previous ?? null, reference: history[url]?.reference ?? null })),
    startRun: vi.fn(async () => ({ id: 'run-1' })),
    recordCheck: vi.fn(async () => ({ checked_at: `2026-10-24T00:00:0${n++}.000Z` })),
    updateScholarship: vi.fn(async () => undefined),
    finishRun: vi.fn(async () => undefined),
  };
}

function stubFetch(pages: Record<string, { status: number; body?: string } | Error>) {
  return vi.fn(async (url: string) => {
    const hit = pages[url];
    if (!hit) throw new Error(`unexpected fetch ${url}`);
    if (hit instanceof Error) throw hit;
    return new Response(hit.body ?? '', { status: hit.status, headers: { 'content-type': 'text/html' } });
  });
}

describe('runRefresh', () => {
  const body = page('<p>Award</p>');
  const hash = contentHash(body, 'text/html');
  const rows = [
    row('u1', 'https://u.example/same#a'), row('u2', 'https://u.example/same#b'),
    row('c1', 'https://u.example/changed'),
    row('g1', 'https://u.example/gone'),
    row('d1', 'https://u.example/down'),
    row('b1', 'https://u.example/new'),
  ];
  const history = {
    'https://u.example/same': { reference: { content_hash: hash }, previous: { http_status: 200 } },
    'https://u.example/changed': { reference: { content_hash: 'old' }, previous: { http_status: 200 } },
    'https://u.example/gone': { previous: { http_status: 404 } },
  };
  const pages = {
    'https://u.example/same': { status: 200, body },
    'https://u.example/changed': { status: 200, body },
    'https://u.example/gone': { status: 404 },
    'https://u.example/down': new Error('ECONNRESET'),
    'https://u.example/new': { status: 200, body },
  };

  it('dry-run fetches each distinct url once and makes no writes', async () => {
    const store = fakeStore(rows, history);
    const fetchImpl = stubFetch(pages);
    const summary = await runRefresh({ store, fetchImpl, apply: false, log: () => {} });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(summary.counts).toEqual({ baseline: 1, unchanged: 1, changed: 1, unreachable: 1, gone: 1 });
    expect(summary.mode).toBe('dry-run');
    expect(summary.plannedUpdates).toBe(4);
    for (const write of [store.startRun, store.recordCheck, store.updateScholarship, store.finishRun]) expect(write).not.toHaveBeenCalled();
  });

  it('apply writes one check per url and scholarship updates stamped with that check\'s checked_at', async () => {
    const store = fakeStore(rows, history);
    const summary = await runRefresh({ store, fetchImpl: stubFetch(pages), apply: true, concurrency: 1, log: () => {} });
    expect(store.recordCheck).toHaveBeenCalledTimes(5);
    for (const [check] of store.recordCheck.mock.calls as unknown as [Record<string, unknown>][]) {
      expect(check.run_id).toBe('run-1');
      expect(check).not.toHaveProperty('checked_at');
    }
    const updates = Object.fromEntries((store.updateScholarship.mock.calls as unknown as [string, Record<string, unknown>][]).map(([id, patch]) => [id, patch]));
    expect(Object.keys(updates).sort()).toEqual(['c1', 'g1', 'u1', 'u2']);
    expect(updates.u1).toEqual({ last_verified_at: '2026-10-24T00:00:00.000Z' });
    expect(updates.c1).toEqual({ source_last_synced_at: '2026-10-24T00:00:01.000Z' });
    expect(updates.g1).toMatchObject({ is_active: false });
    expect(store.finishRun).toHaveBeenCalledWith('run-1', expect.objectContaining({
      status: 'succeeded', records_seen: 5, records_inserted: 0, records_updated: 4,
      check_counts: { baseline: 1, unchanged: 1, changed: 1, unreachable: 1, gone: 1 },
    }));
    expect(summary.scholarshipsUpdated).toBe(4);
  });

  it('respects --limit on distinct urls', async () => {
    const fetchImpl = stubFetch(pages);
    await runRefresh({ store: fakeStore(rows, history), fetchImpl, apply: false, limit: 2, log: () => {} });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('scopes a run to --url-prefix', async () => {
    const fetchImpl = stubFetch(pages);
    const summary = await runRefresh({ store: fakeStore(rows, history), fetchImpl, apply: false, urlPrefix: 'https://u.example/ch', log: () => {} });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(summary.counts.changed).toBe(1);
  });

  it('marks the run failed and rethrows when a write fails', async () => {
    const store = fakeStore(rows, history);
    store.updateScholarship.mockRejectedValueOnce(new Error('boom'));
    await expect(runRefresh({ store, fetchImpl: stubFetch(pages), apply: true, concurrency: 1, log: () => {} })).rejects.toThrow('boom');
    expect(store.finishRun).toHaveBeenCalledWith('run-1', expect.objectContaining({ status: 'failed', error_message: 'boom' }));
  });

  it('times out a hanging fetch as unreachable', async () => {
    const hang = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const summary = await runRefresh({ store: fakeStore([row('h', 'https://u.example/hang')]), fetchImpl: hang, apply: false, timeoutMs: 20, log: () => {} });
    expect(summary.counts.unreachable).toBe(1);
    expect(summary.sample[0].detail).toMatch(/timeout/);
    const init = hang.mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe('follow');
    expect(new Headers(init.headers).get('user-agent')).toMatch(/CAAT/);
  });
});

describe('supabase store in dry-run', () => {
  it('only reads through the client', async () => {
    const supabase = createMockSupabase({
      resolver: (ctx) => {
        if (ctx.table === 'scholarships') return { data: [row('a', 'https://u.example/a')], error: null };
        return { data: [], error: null };
      },
    });
    const store = createSupabaseStore(supabase);
    await runRefresh({ store, fetchImpl: stubFetch({ 'https://u.example/a': { status: 200, body: page('x') } }), apply: false, log: () => {} });
    expect(supabase.queries.length).toBeGreaterThan(0);
    expect(supabase.queries.every(q => q.op === 'select')).toBe(true);
  });
});

describe('arguments', () => {
  it('defaults to a dry run with concurrency 4 and a 15 s timeout', () => {
    expect(parseArgs([])).toEqual({ apply: false, limit: undefined, concurrency: 4, timeoutMs: 15000 });
    expect(parseArgs(['--apply', '--limit', '10', '--concurrency=2', '--timeout-ms', '500'])).toEqual({ apply: true, limit: 10, concurrency: 2, timeoutMs: 500 });
    expect(() => parseArgs(['--limit', 'x'])).toThrow();
    expect(() => parseArgs(['--bogus'])).toThrow();
    expect(parseArgs(['--url-prefix', 'https://u.example/a']).urlPrefix).toBe('https://u.example/a');
    expect(() => parseArgs(['--url-prefix', 'nope'])).toThrow();
  });
});
