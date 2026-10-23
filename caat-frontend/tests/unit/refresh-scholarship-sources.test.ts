import { describe, expect, it, vi } from 'vitest';
import {
  ANCHOR_TOLERANCE_MS,
  classifyCheck,
  isAnchored,
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

// Imported 15 Oct: two days before the 17 Oct baselines used below, inside the anchor tolerance.
const FRESH = '2026-10-15T00:00:00.000Z';
const STALE = '2026-05-01T00:00:00.000Z';
type Row = { id: string; external_url: string | null; last_verified_at: string | null; source_last_synced_at: string | null; is_active: boolean; raw_payload: Record<string, unknown> | null };
const row = (id: string, external_url: string | null, extra: Partial<Row> = {}): Row => ({
  id, external_url, last_verified_at: '2026-06-01T00:00:00.000Z', source_last_synced_at: FRESH, is_active: true, raw_payload: { title: 'Kept' }, ...extra,
});

const page = (main: string, chrome = '') => `<!doctype html><html><head><title>t</title><style>.a{}</style></head><body>
  <nav>${chrome}Home | Apply</nav><script>window.x=${chrome.length}</script>
  <main>${main}</main><footer>${chrome} Copyright</footer></body></html>`;

// Shape of a sydney.edu.au (AEM) scholarship page: no <main>; content sits in div.content-container.
const usyd = (content: string, chrome = '') => `<html><body>
  <div class="m-global-desktop-nav"><nav class="m-utility-nav">${chrome}Study</nav><header class="m-grid">${chrome} Search</header></div>
  <div class="col-xs-12 fullWidthColumn" id="skip-to-content">
    <div class="breadcrumbsModule">Home / Scholarships ${chrome}</div>
    <div class="content-container b-single-column"><div class="contentContainerMediaObjectModule"><div>${content}</div></div></div>
  </div>
  <div class="b-js-global-footer-csi">${chrome} Footer links</div></body></html>`;
const USYD = 'https://www.sydney.edu.au/scholarships/a/example.html';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-24T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('url normalisation', () => {
  it('drops the fragment, trims, and keeps only http(s)', () => {
    expect(normaliseUrl('  https://uni.example/award#apply ')).toBe('https://uni.example/award');
    expect(normaliseUrl('https://uni.example/award?id=2#x')).toBe('https://uni.example/award?id=2');
    expect(normaliseUrl('HTTPS://Uni.Example/award')).toBe('https://uni.example/award');
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

  it('never leaks attribute values, even ones containing ">"', () => {
    expect(extractVisibleText('<main><div data-tracking="id > 42 leaked" title=\'x > y\'>Text</div></main>')).toBe('Text');
    expect(contentHash('<main><p data-session="a > 1">Award</p></main>', 'text/html')).toBe(contentHash('<main><p data-session="b > 2">Award</p></main>', 'text/html'));
  });

  it('reads the AEM content container on sydney.edu.au pages', () => {
    expect(extractVisibleText(usyd('<h1>Award</h1><p>Value $5,000</p>'), USYD)).toBe('Award Value $5,000');
    expect(contentHash(usyd('<p>Value $5,000</p>', 'v1'), 'text/html', USYD)).toBe(contentHash(usyd('<p>Value $5,000</p>', 'redesigned'), 'text/html', USYD));
    expect(contentHash(usyd('<p>Value $5,000</p>'), 'text/html', USYD)).not.toBe(contentHash(usyd('<p>Value $6,000</p>'), 'text/html', USYD));
  });

  it('falls back to <main>/<body> when the host selector is absent', () => {
    expect(extractVisibleText(page('<p>Award</p>'), USYD)).toBe('Award');
  });

  it('hashes non-HTML bodies as raw bytes', () => {
    expect(contentHash('%PDF-1 a', 'application/pdf')).not.toBe(contentHash('%PDF-1  a', 'application/pdf'));
  });
});

describe('classification', () => {
  const url = 'https://u.example/a';
  const base = { url, now: NOW, rows: [row('r', url)] };
  const ok = { ...base, status: 200, hash: 'h1', finalUrl: url };
  const reference = { content_hash: 'h1', checked_at: ago(7 * DAY) };

  it('baseline when no reference hash exists', () => {
    expect(classifyCheck({ ...ok, reference: null, previous: null }).outcome).toBe('baseline');
  });
  it('unchanged and changed against the reference hash', () => {
    expect(classifyCheck({ ...ok, reference, previous: null }).outcome).toBe('unchanged');
    expect(classifyCheck({ ...ok, reference: { ...reference, content_hash: 'h0' }, previous: null }).outcome).toBe('changed');
  });
  it('re-baselines a changed page when a row was re-imported after the baseline', () => {
    const rows = [row('r', url, { source_last_synced_at: ago(DAY) })];
    expect(classifyCheck({ ...ok, rows, reference: { ...reference, content_hash: 'h0' }, previous: null })).toMatchObject({ outcome: 'baseline', detail: expect.stringMatching(/re-import/) });
    expect(classifyCheck({ ...ok, rows: [row('r', url, { source_last_synced_at: ago(30 * DAY) })], reference: { ...reference, content_hash: 'h0' }, previous: null }).outcome).toBe('changed');
  });
  it('an unchanged page whose rows were imported before the baseline is unanchored', () => {
    const stale = [row('r', url, { source_last_synced_at: STALE })];
    expect(classifyCheck({ ...ok, rows: stale, reference, previous: null })).toMatchObject({ outcome: 'unanchored', detail: expect.stringMatching(/predate/) });
    const mixed = [row('r', url), row('s', url, { source_last_synced_at: STALE })];
    expect(classifyCheck({ ...ok, rows: mixed, reference, previous: null })).toMatchObject({ outcome: 'unchanged', detail: expect.stringMatching(/1 of 2/) });
  });
  it('anchoring allows imports up to the tolerance before the baseline, and is per row', () => {
    const at = '2026-10-17T00:00:00.000Z';
    expect(ANCHOR_TOLERANCE_MS).toBe(7 * DAY);
    expect(isAnchored({ source_last_synced_at: new Date(Date.parse(at) - 7 * DAY).toISOString() }, at)).toBe(true);
    expect(isAnchored({ source_last_synced_at: new Date(Date.parse(at) - 7 * DAY - 1000).toISOString() }, at)).toBe(false);
    expect(isAnchored({ source_last_synced_at: null }, at)).toBe(false);
    expect(isAnchored({ source_last_synced_at: FRESH }, null)).toBe(false);
  });
  it('a redirect to another url is unreachable and never a baseline', () => {
    const moved = classifyCheck({ ...ok, finalUrl: 'https://u.example/new-home', reference: null, previous: null });
    expect(moved).toEqual({ outcome: 'unreachable', detail: 'redirected to https://u.example/new-home' });
    expect(classifyCheck({ ...ok, finalUrl: `${url}#top`, reference, previous: null }).outcome).toBe('unchanged');
  });
  it('unreachable on network errors, timeouts, 5xx, 429 and other non-2xx', () => {
    expect(classifyCheck({ ...base, error: 'timeout after 15000 ms', reference: null, previous: null }).outcome).toBe('unreachable');
    for (const status of [500, 502, 503, 429, 403, 401]) {
      expect(classifyCheck({ ...base, status, finalUrl: url, reference, previous: null }).outcome).toBe('unreachable');
    }
  });
  it('gone needs a 404/410 now and on a previous check at least 24 h earlier', () => {
    const nf = { ...base, finalUrl: url, reference: null };
    expect(classifyCheck({ ...nf, status: 404, previous: null })).toMatchObject({ outcome: 'unreachable', detail: expect.stringMatching(/first/) });
    expect(classifyCheck({ ...nf, status: 410, previous: { http_status: 200, checked_at: ago(2 * DAY) } }).outcome).toBe('unreachable');
    expect(classifyCheck({ ...nf, status: 404, previous: { http_status: 503, checked_at: ago(2 * DAY) } }).outcome).toBe('unreachable');
    expect(classifyCheck({ ...nf, status: 404, previous: { http_status: 404, checked_at: ago(DAY - 60_000) } })).toMatchObject({ outcome: 'unreachable', detail: expect.stringMatching(/24 h/) });
    expect(classifyCheck({ ...nf, status: 404, previous: { http_status: 410, checked_at: ago(DAY) } }).outcome).toBe('gone');
    expect(classifyCheck({ ...nf, status: 410, previous: { http_status: 404, checked_at: ago(3 * DAY) } }).outcome).toBe('gone');
  });
  it('a previous 404 reached through a redirect is not a strike', () => {
    expect(classifyCheck({ ...base, status: 404, finalUrl: url, reference: null, previous: { http_status: 404, checked_at: ago(2 * DAY), final_url: 'https://u.example/elsewhere' } }).outcome).toBe('unreachable');
  });
});

describe('scholarship updates', () => {
  const checkedAt = '2026-10-24T01:02:03.000Z';
  const baselineAt = '2026-10-17T00:00:00.000Z';
  const rows = [
    row('old', 'https://u.example/a', { last_verified_at: '2026-06-01T00:00:00.000Z' }),
    row('same', 'https://u.example/a#x', { last_verified_at: checkedAt }),
    row('null', 'https://u.example/a', { last_verified_at: null }),
  ];
  it('only unchanged advances last_verified_at, and only rows whose value would change', () => {
    expect(planScholarshipUpdates(rows, { outcome: 'unchanged', checked_at: checkedAt, baseline_at: baselineAt })).toEqual([
      { id: 'old', action: 'verify', at: checkedAt },
      { id: 'null', action: 'verify', at: checkedAt },
    ]);
  });
  it('never moves last_verified_at backwards', () => {
    expect(planScholarshipUpdates([row('newer', 'https://u.example/a', { last_verified_at: '2026-10-25T00:00:00.000Z' })], { outcome: 'unchanged', checked_at: checkedAt, baseline_at: baselineAt })).toEqual([]);
  });
  it('old import + baseline + unchanged page verifies nothing', () => {
    const stale = [row('old', 'https://u.example/a', { source_last_synced_at: STALE })];
    expect(planScholarshipUpdates(stale, { outcome: 'unchanged', checked_at: checkedAt, baseline_at: baselineAt })).toEqual([]);
    expect(planScholarshipUpdates(stale, { outcome: 'unanchored', checked_at: checkedAt, baseline_at: baselineAt })).toEqual([]);
  });
  it('two rows on one url: only the re-imported one verifies', () => {
    const shared = [row('reimported', 'https://u.example/a#x', { source_last_synced_at: '2026-10-23T00:00:00.000Z' }), row('old', 'https://u.example/a#y', { source_last_synced_at: STALE })];
    expect(planScholarshipUpdates(shared, { outcome: 'unchanged', checked_at: checkedAt, baseline_at: baselineAt })).toEqual([{ id: 'reimported', action: 'verify', at: checkedAt }]);
  });
  it('refuses to verify without the baseline time', () => {
    expect(() => planScholarshipUpdates(rows, { outcome: 'unchanged', checked_at: checkedAt })).toThrow(/baseline/);
  });
  it('changed, unreachable and baseline write nothing to scholarships', () => {
    for (const outcome of ['changed', 'unreachable', 'baseline', 'unanchored']) expect(planScholarshipUpdates(rows, { outcome, checked_at: checkedAt })).toEqual([]);
  });
  it('gone deactivates active rows and carries the reason', () => {
    const plan = planScholarshipUpdates([rows[0], row('off', 'https://u.example/a', { is_active: false })], { outcome: 'gone', checked_at: checkedAt, http_status: 404, url: 'https://u.example/a', run_id: 'run-1' });
    expect(plan).toEqual([{ id: 'old', action: 'deactivate', sourceCheck: {
      outcome: 'gone', http_status: 404, url: 'https://u.example/a', checked_at: checkedAt, run_id: 'run-1', reason: expect.stringMatching(/404/),
    } }]);
  });
});

function fakeStore(rows: Row[], history: Record<string, { previous?: object | null; reference?: object | null }> = {}) {
  let n = 0;
  return {
    assertReady: vi.fn(async () => undefined),
    loadActiveScholarships: vi.fn(async () => rows),
    latestChecks: vi.fn(async (url: string) => ({ previous: history[url]?.previous ?? null, reference: history[url]?.reference ?? null, missing: false })),
    startRun: vi.fn(async () => ({ id: 'run-1' })),
    recordCheck: vi.fn<(check: Record<string, unknown>) => Promise<{ checked_at: string }>>(async () => ({ checked_at: `2026-10-24T00:00:0${n++}.000Z` })),
    verifyScholarship: vi.fn<(id: string, at: string) => Promise<boolean>>(async () => true),
    deactivateScholarship: vi.fn<(id: string, check: object) => Promise<boolean>>(async () => true),
    finishRun: vi.fn<(id: string, patch: object) => Promise<void>>(async () => undefined),
  };
}

function stubFetch(pages: Record<string, { status: number; body?: string; delay?: number } | Error>) {
  return vi.fn(async (url: string) => {
    const hit = pages[url];
    if (!hit) throw new Error(`unexpected fetch ${url}`);
    if (hit instanceof Error) throw hit;
    if (hit.delay) await new Promise((r) => setTimeout(r, hit.delay));
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
    'https://u.example/same': { reference: { content_hash: hash, checked_at: ago(7 * DAY) }, previous: { http_status: 200, checked_at: ago(7 * DAY) } },
    'https://u.example/changed': { reference: { content_hash: 'old', checked_at: ago(7 * DAY) }, previous: { http_status: 200, checked_at: ago(7 * DAY) } },
    'https://u.example/gone': { previous: { http_status: 404, checked_at: ago(2 * DAY) } },
  };
  const pages = {
    'https://u.example/same': { status: 200, body },
    'https://u.example/changed': { status: 200, body },
    'https://u.example/gone': { status: 404 },
    'https://u.example/down': new Error('ECONNRESET'),
    'https://u.example/new': { status: 200, body },
  };
  const quiet = { log: () => {}, now: () => NOW };

  it('dry-run fetches each distinct url once and makes no writes', async () => {
    const store = fakeStore(rows, history);
    const fetchImpl = stubFetch(pages);
    const summary = await runRefresh({ store, fetchImpl, apply: false, ...quiet });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(summary.counts).toEqual({ baseline: 1, unchanged: 1, changed: 1, unreachable: 1, gone: 1, unanchored: 0, unanchored_rows: 0 });
    expect(summary.mode).toBe('dry-run');
    expect(summary.plannedUpdates).toBe(3);
    for (const write of [store.assertReady, store.startRun, store.recordCheck, store.verifyScholarship, store.deactivateScholarship, store.finishRun]) expect(write).not.toHaveBeenCalled();
  });

  it('apply writes one check per url and verifies with that check\'s checked_at', async () => {
    const store = fakeStore(rows, history);
    const summary = await runRefresh({ store, fetchImpl: stubFetch(pages), apply: true, concurrency: 1, ...quiet });
    expect(store.assertReady).toHaveBeenCalledBefore(store.startRun);
    expect(store.recordCheck).toHaveBeenCalledTimes(5);
    for (const [check] of store.recordCheck.mock.calls as unknown as [Record<string, unknown>][]) {
      expect(check.run_id).toBe('run-1');
      expect(check).not.toHaveProperty('checked_at');
    }
    expect(store.verifyScholarship.mock.calls).toEqual([['u1', '2026-10-24T00:00:00.000Z'], ['u2', '2026-10-24T00:00:00.000Z']]);
    expect(store.deactivateScholarship.mock.calls.map(([id]) => id)).toEqual(['g1']);
    expect(store.finishRun).toHaveBeenCalledWith('run-1', expect.objectContaining({
      status: 'succeeded', records_seen: 5, records_inserted: 0, records_updated: 3,
      check_counts: { baseline: 1, unchanged: 1, changed: 1, unreachable: 1, gone: 1, unanchored: 0, unanchored_rows: 0 },
    }));
    expect(summary.scholarshipsUpdated).toBe(3);
  });

  it('counts only rows the guarded update actually changed', async () => {
    const store = fakeStore(rows, history);
    store.verifyScholarship.mockResolvedValueOnce(false);
    const summary = await runRefresh({ store, fetchImpl: stubFetch(pages), apply: true, concurrency: 1, ...quiet });
    expect(summary.scholarshipsUpdated).toBe(2);
    expect(store.finishRun).toHaveBeenCalledWith('run-1', expect.objectContaining({ records_updated: 2 }));
  });

  it('respects --limit on distinct urls', async () => {
    const fetchImpl = stubFetch(pages);
    await runRefresh({ store: fakeStore(rows, history), fetchImpl, apply: false, limit: 2, ...quiet });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('makes the unanchored gap visible and writes nothing for it', async () => {
    const stale = [
      row('s1', 'https://u.example/same#a', { source_last_synced_at: STALE }),
      row('f1', 'https://u.example/same#b'),
      row('s2', 'https://u.example/old', { source_last_synced_at: STALE }),
    ];
    const hist = {
      'https://u.example/same': history['https://u.example/same'],
      'https://u.example/old': { reference: { content_hash: hash, checked_at: ago(7 * DAY) } },
    };
    const store = fakeStore(stale, hist);
    const summary = await runRefresh({ store, fetchImpl: stubFetch({ 'https://u.example/same': { status: 200, body }, 'https://u.example/old': { status: 200, body } }), apply: true, concurrency: 1, ...quiet });
    expect(summary.counts).toMatchObject({ unchanged: 1, unanchored: 1, unanchored_rows: 2 });
    expect(store.verifyScholarship.mock.calls.map(([id]) => id)).toEqual(['f1']);
    expect(store.recordCheck.mock.calls.map(([c]) => c.outcome)).toEqual(['unchanged', 'unanchored']);
  });

  it('counts an outcome only after its check is stored', async () => {
    const store = fakeStore(rows, history);
    store.recordCheck.mockRejectedValueOnce(new Error('insert failed'));
    await expect(runRefresh({ store, fetchImpl: stubFetch(pages), apply: true, concurrency: 1, ...quiet })).rejects.toThrow('insert failed');
    expect(store.finishRun).toHaveBeenCalledWith('run-1', expect.objectContaining({ status: 'failed', records_seen: 5, check_counts: expect.objectContaining({ unchanged: 0 }) }));
  });

  it('matches --url-prefix only on a path boundary', async () => {
    const r = [row('a', 'https://u.example/path'), row('b', 'https://u.example/pathology'), row('c', 'https://u.example/path/sub')];
    const fetchImpl = stubFetch({ 'https://u.example/path': { status: 200, body }, 'https://u.example/path/sub': { status: 200, body } });
    const summary = await runRefresh({ store: fakeStore(r), fetchImpl, apply: false, urlPrefix: 'https://u.example/path', ...quiet });
    expect(summary.urls).toBe(2);
    expect(fetchImpl.mock.calls.map(([u]) => u).sort()).toEqual(['https://u.example/path', 'https://u.example/path/sub']);
  });

  it('scopes a run to a normalised --url-prefix', async () => {
    const fetchImpl = stubFetch(pages);
    const summary = await runRefresh({ store: fakeStore(rows, history), fetchImpl, apply: false, urlPrefix: 'HTTPS://U.Example/changed#x', ...quiet });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(summary.counts.changed).toBe(1);
  });

  it('stops starting urls after a failure, waits for in-flight work, and reports accurate counts', async () => {
    const many = Array.from({ length: 6 }, (_, i) => row(`r${i}`, `https://u.example/p${i}`));
    const hist = Object.fromEntries(many.map((r) => [r.external_url!, { reference: { content_hash: hash, checked_at: ago(7 * DAY) } }]));
    const pg = Object.fromEntries(many.map((r, i) => [r.external_url!, { status: 200, body, delay: i === 1 ? 30 : 0 }]));
    const store = fakeStore(many, hist);
    store.verifyScholarship.mockImplementation(async (id: string) => {
      if (id === 'r0') throw new Error('boom');
      return true;
    });
    const fetchImpl = stubFetch(pg);
    await expect(runRefresh({ store, fetchImpl, apply: true, concurrency: 2, ...quiet })).rejects.toThrow('boom');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(store.verifyScholarship).toHaveBeenCalledTimes(2);
    expect(store.finishRun).toHaveBeenCalledTimes(1);
    expect(store.finishRun).toHaveBeenCalledWith('run-1', expect.objectContaining({ status: 'failed', error_message: 'boom', records_updated: 1 }));
    expect(store.finishRun.mock.invocationCallOrder[0]).toBeGreaterThan(store.verifyScholarship.mock.invocationCallOrder[1]);
  });

  it('never leaves a run at started when the final write fails', async () => {
    const store = fakeStore(rows, history);
    store.finishRun.mockRejectedValueOnce(new Error('column check_counts does not exist'));
    await expect(runRefresh({ store, fetchImpl: stubFetch(pages), apply: true, concurrency: 1, ...quiet })).rejects.toThrow('check_counts');
    expect(store.finishRun).toHaveBeenCalledTimes(2);
    expect(store.finishRun.mock.calls[1][1]).toMatchObject({ status: 'failed', error_message: expect.stringMatching(/check_counts/) });
    expect(store.finishRun.mock.calls[1][1]).not.toHaveProperty('check_counts');
  });

  it('apply refuses to start when the store is not ready', async () => {
    const store = fakeStore(rows, history);
    store.assertReady.mockRejectedValueOnce(new Error('scholarship_source_checks is missing'));
    await expect(runRefresh({ store, fetchImpl: stubFetch(pages), apply: true, ...quiet })).rejects.toThrow('missing');
    expect(store.startRun).not.toHaveBeenCalled();
  });

  it('times out a hanging fetch as unreachable', async () => {
    const hang = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const summary = await runRefresh({ store: fakeStore([row('h', 'https://u.example/hang')]), fetchImpl: hang, apply: false, timeoutMs: 20, ...quiet });
    expect(summary.counts.unreachable).toBe(1);
    expect(summary.sample[0].detail).toMatch(/timeout/);
    const init = hang.mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe('follow');
    expect(new Headers(init.headers).get('user-agent')).toMatch(/CAAT/);
  });

  it('records a redirect as unreachable with its target', async () => {
    const fetchImpl = vi.fn(async () => {
      const response = new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
      Object.defineProperty(response, 'url', { value: 'https://u.example/landing' });
      return response;
    });
    const summary = await runRefresh({ store: fakeStore([row('m', 'https://u.example/moved')]), fetchImpl, apply: false, ...quiet });
    expect(summary.sample[0]).toMatchObject({ outcome: 'unreachable', detail: 'redirected to https://u.example/landing' });
  });
});

describe('supabase store', () => {
  const scholarships = { data: [row('a', 'https://u.example/a')], error: null };

  it('dry-run only reads through the client', async () => {
    const supabase = createMockSupabase({ resolver: (ctx) => (ctx.table === 'scholarships' ? scholarships : { data: [], error: null }) });
    await runRefresh({ store: createSupabaseStore(supabase), fetchImpl: stubFetch({ 'https://u.example/a': { status: 200, body: page('x') } }), apply: false, log: () => {} });
    expect(supabase.queries.length).toBeGreaterThan(0);
    expect(supabase.queries.every((q) => q.op === 'select')).toBe(true);
  });

  it('dry-run treats a missing checks table as no history', async () => {
    const supabase = createMockSupabase({
      resolver: (ctx) => (ctx.table === 'scholarships' ? scholarships : { data: null, error: { message: 'relation not found', code: 'PGRST205' } as { message: string } }),
    });
    const logs: string[] = [];
    const summary = await runRefresh({ store: createSupabaseStore(supabase), fetchImpl: stubFetch({ 'https://u.example/a': { status: 200, body: page('x') } }), apply: false, log: (m: string) => logs.push(m) });
    expect(summary.counts.baseline).toBe(1);
    expect(logs.join('\n')).toMatch(/scholarship_source_checks does not exist/);
  });

  it('apply fails clearly before writing when the checks table is missing', async () => {
    const supabase = createMockSupabase({
      resolver: (ctx) => (ctx.table === 'scholarships' ? scholarships : { data: null, error: { message: 'relation does not exist', code: '42P01' } as { message: string } }),
    });
    await expect(runRefresh({ store: createSupabaseStore(supabase), fetchImpl: stubFetch({}), apply: true, log: () => {} })).rejects.toThrow(/20261024090000_scholarship_source_checks/);
    expect(supabase.queries.every((q) => q.op === 'select')).toBe(true);
  });

  it('guards verification in SQL so it never moves backwards', async () => {
    const supabase = createMockSupabase({ resolver: () => ({ data: [{ id: 'a' }], error: null }) });
    expect(await createSupabaseStore(supabase).verifyScholarship('a', '2026-10-24T01:02:03.123456+00:00')).toBe(true);
    const update = supabase.queries[0];
    expect(update.op).toBe('update');
    expect(update.calls).toContainEqual({ method: 'update', args: [{ last_verified_at: '2026-10-24T01:02:03.123456+00:00' }] });
    expect(update.calls).toContainEqual({ method: 'or', args: ['last_verified_at.is.null,last_verified_at.lt."2026-10-24T01:02:03.123456+00:00"'] });
  });

  it('deactivates in one statement through scholarship_mark_gone', async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const supabase = createMockSupabase({ rpc: (name, args) => { calls.push([name, args]); return { data: name === 'scholarship_mark_gone' && calls.length === 1 ? 'a' : null, error: null }; } });
    const store = createSupabaseStore(supabase);
    const sourceCheck = { outcome: 'gone', http_status: 410 };
    expect(await store.deactivateScholarship('a', sourceCheck)).toBe(true);
    expect(await store.deactivateScholarship('a', sourceCheck)).toBe(false);
    expect(calls[0]).toEqual(['scholarship_mark_gone', { p_id: 'a', p_check: sourceCheck }]);
    expect(supabase.queries).toEqual([]);
  });
});

describe('arguments', () => {
  it('defaults to a dry run with concurrency 4 and a 15 s timeout', () => {
    expect(parseArgs([])).toEqual({ apply: false, limit: undefined, concurrency: 4, timeoutMs: 15000 });
    expect(parseArgs(['--apply', '--limit', '10', '--concurrency=2', '--timeout-ms', '500'])).toEqual({ apply: true, limit: 10, concurrency: 2, timeoutMs: 500 });
    expect(() => parseArgs(['--limit', 'x'])).toThrow();
    expect(() => parseArgs(['--bogus'])).toThrow();
  });
  it('normalises --url-prefix like source urls', () => {
    expect(parseArgs(['--url-prefix', 'HTTPS://U.Example/a#frag']).urlPrefix).toBe('https://u.example/a');
    expect(parseArgs(['--url-prefix=https://u.example/a?id=2&x=y']).urlPrefix).toBe('https://u.example/a?id=2&x=y');
    expect(() => parseArgs(['--url-prefix', 'nope'])).toThrow();
  });
});
