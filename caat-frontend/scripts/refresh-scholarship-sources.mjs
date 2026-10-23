#!/usr/bin/env node
// PROD-143: check each active scholarship's source page and record what was found.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/refresh-scholarship-sources.mjs \
//     [--apply] [--limit N] [--concurrency 4] [--timeout-ms 15000] [--url-prefix https://host/path]
//
// Dry run is the default: it reads and fetches, prints counts and a sample, and writes nothing.
// See docs/operations/scholarship-source-refresh.md. Rules this file keeps:
// - one scholarship_source_checks row per distinct URL (fragment removed) per run;
// - only an `unchanged` check advances scholarships.last_verified_at, to that check's checked_at;
// - `changed` sets source_last_synced_at only; `gone` (404/410 twice in a row) sets is_active=false
//   and records why in raw_payload; `unreachable` and `baseline` never touch scholarships;
// - nothing is deleted, no date is invented, no extracted field is changed.
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OUTCOMES = /** @type {const} */ (['baseline', 'unchanged', 'changed', 'unreachable', 'gone']);
export const USER_AGENT = 'CAAT-SourceCheck/1.0 (scholarship listing freshness check; one request per page per run)';
const PAGE_SIZE = 1000;
const SAMPLE_PER_OUTCOME = 3;

/** Absolute http(s) URL without its #fragment, or null. */
export function normaliseUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  return url.toString();
}

/** Map of normalised URL -> scholarship rows that point at it, in first-seen order. */
export function groupRowsByUrl(rows) {
  const groups = new Map();
  for (const r of rows) {
    const url = normaliseUrl(r.external_url);
    if (!url) continue;
    if (!groups.has(url)) groups.set(url, []);
    groups.get(url).push(r);
  }
  return groups;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (whole, name) => {
    const lower = name.toLowerCase();
    if (lower in ENTITIES) return ENTITIES[lower];
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16) || 32);
    if (lower.startsWith('#')) return String.fromCodePoint(Number(lower.slice(1)) || 32);
    return whole;
  });
}

function section(html, tag) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*)</${tag}>`, 'i'));
  return match ? match[1] : null;
}

/** Visible text of <main> (fallback <body>, then the whole document) without page chrome. */
export function extractVisibleText(html) {
  let text = String(html).replace(/<!--[\s\S]*?-->/g, ' ');
  text = text.replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1>/gi, ' ');
  text = section(text, 'main') ?? section(text, 'body') ?? text;
  text = text.replace(/<(nav|footer)\b[\s\S]*?<\/\1>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

/** sha256 over the normalised visible text for HTML, over the raw bytes otherwise. */
export function contentHash(body, contentType) {
  const isHtml = !contentType || /html|xml/i.test(contentType);
  const input = isHtml ? extractVisibleText(typeof body === 'string' ? body : Buffer.from(body).toString('utf8')) : body;
  return createHash('sha256').update(typeof input === 'string' ? input : Buffer.from(input)).digest('hex');
}

/**
 * previous: the most recent stored check for this URL (any outcome).
 * reference: the most recent stored check whose hash was accepted (baseline or unchanged).
 * A `changed` hash never becomes the reference, so a changed page stays `changed`
 * until it is re-extracted and re-baselined; it cannot drift back to `unchanged`.
 * @param {{
 *   status?: number | null, error?: string | null, hash?: string | null,
 *   previous?: { http_status?: number | null } | null,
 *   reference?: { content_hash?: string | null } | null,
 * }} input
 */
export function classifyCheck({ status, error, hash, previous, reference }) {
  if (error) return { outcome: 'unreachable', detail: String(error) };
  if (status === 404 || status === 410) {
    const before = previous?.http_status;
    if (before === 404 || before === 410) return { outcome: 'gone', detail: `HTTP ${status}; previous check HTTP ${before}` };
    return { outcome: 'unreachable', detail: `HTTP ${status}; first not-found strike, needs a second before gone` };
  }
  if (status === 429 || status >= 500) return { outcome: 'unreachable', detail: `HTTP ${status}` };
  if (!(status >= 200 && status < 300)) return { outcome: 'unreachable', detail: `HTTP ${status}; not a usable page` };
  if (!reference?.content_hash) return { outcome: 'baseline', detail: 'first stored content hash for this url' };
  return reference.content_hash === hash
    ? { outcome: 'unchanged', detail: null }
    : { outcome: 'changed', detail: 'content differs from the last accepted hash' };
}

const later = (candidate, current) => !current || Date.parse(candidate) > Date.parse(current);

/** Scholarship patches for one check. Only rows whose value would change get a patch. */
export function planScholarshipUpdates(rows, check) {
  const at = check.checked_at;
  if (!at) throw new Error('A check without checked_at cannot update scholarships.');
  if (check.outcome === 'unchanged') {
    return rows.filter(r => later(at, r.last_verified_at)).map(r => ({ id: r.id, patch: { last_verified_at: at } }));
  }
  if (check.outcome === 'changed') {
    return rows.filter(r => later(at, r.source_last_synced_at)).map(r => ({ id: r.id, patch: { source_last_synced_at: at } }));
  }
  if (check.outcome === 'gone') {
    return rows.filter(r => r.is_active !== false).map(r => ({
      id: r.id,
      patch: {
        is_active: false,
        raw_payload: {
          ...(r.raw_payload && typeof r.raw_payload === 'object' && !Array.isArray(r.raw_payload) ? r.raw_payload : {}),
          source_check: {
            outcome: 'gone', http_status: check.http_status ?? null, url: check.url ?? null, checked_at: at,
            run_id: check.run_id ?? null, reason: `Source page returned HTTP ${check.http_status} on two consecutive checks`,
          },
        },
      },
    }));
  }
  return [];
}

/** Fetch one URL with redirects, a timeout and a polite User-Agent. Never throws. */
export async function checkUrl(url, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetchImpl(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
    });
    const status = response.status;
    const finalUrl = response.url || url;
    if (status < 200 || status >= 300) {
      await response.body?.cancel?.().catch(() => {});
      return { status, finalUrl, hash: null, error: null };
    }
    const type = response.headers.get('content-type') ?? '';
    const body = /html|xml/i.test(type) || !type ? await response.text() : new Uint8Array(await response.arrayBuffer());
    return { status, finalUrl, hash: contentHash(body, type), error: null };
  } catch (err) {
    const cause = err?.cause?.code ?? err?.cause?.message;
    const error = timedOut ? `timeout after ${timeoutMs} ms` : `network error: ${err?.message ?? err}${cause ? ` (${cause})` : ''}`;
    return { status: null, finalUrl: null, hash: null, error };
  } finally {
    clearTimeout(timer);
  }
}

async function pool(items, concurrency, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

const must = (result, what) => {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
};

/** Data access through a service-role Supabase client. Reads and writes are separate methods. */
export function createSupabaseStore(client) {
  return {
    async loadActiveScholarships() {
      const rows = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const page = must(await client.from('scholarships')
          .select('id,external_url,last_verified_at,source_last_synced_at,is_active,raw_payload')
          .eq('is_active', true).not('external_url', 'is', null)
          .order('id').range(from, from + PAGE_SIZE - 1), 'load scholarships') ?? [];
        rows.push(...page);
        if (page.length < PAGE_SIZE) return rows;
      }
    },
    async latestChecks(url) {
      const previous = must(await client.from('scholarship_source_checks')
        .select('checked_at,http_status,content_hash,outcome').eq('url', url)
        .order('checked_at', { ascending: false }).limit(1), 'load previous check') ?? [];
      const reference = must(await client.from('scholarship_source_checks')
        .select('checked_at,content_hash,outcome').eq('url', url).in('outcome', ['baseline', 'unchanged'])
        .not('content_hash', 'is', null).order('checked_at', { ascending: false }).limit(1), 'load reference check') ?? [];
      return { previous: previous[0] ?? null, reference: reference[0] ?? null };
    },
    async startRun() {
      return must(await client.from('scholarship_import_runs').insert({ status: 'started' }).select('id,started_at').single(), 'start run');
    },
    async recordCheck(check) {
      return must(await client.from('scholarship_source_checks').insert(check).select('id,checked_at').single(), 'record check');
    },
    async updateScholarship(id, patch) {
      must(await client.from('scholarships').update(patch).eq('id', id), `update scholarship ${id}`);
    },
    async finishRun(id, patch) {
      must(await client.from('scholarship_import_runs').update(patch).eq('id', id), 'finish run');
    },
  };
}

/**
 * Run one refresh. In dry-run, store write methods are never called and planned
 * updates use the local fetch time only for counting; nothing is persisted.
 * @param {{
 *   store: {
 *     loadActiveScholarships: () => Promise<any[]>,
 *     latestChecks: (url: string) => Promise<{ previous: any, reference: any }>,
 *     startRun: () => Promise<{ id: string }>,
 *     recordCheck: (check: Record<string, unknown>) => Promise<{ checked_at: string }>,
 *     updateScholarship: (id: string, patch: Record<string, unknown>) => Promise<unknown>,
 *     finishRun: (id: string, patch: Record<string, unknown>) => Promise<unknown>,
 *   },
 *   fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>,
 *   apply?: boolean, limit?: number, concurrency?: number, timeoutMs?: number, urlPrefix?: string,
 *   log?: (message: string) => void,
 * }} options
 */
export async function runRefresh({ store, fetchImpl = globalThis.fetch, apply = false, limit, concurrency = 4, timeoutMs = 15000, urlPrefix, log = console.log }) {
  const groups = groupRowsByUrl(await store.loadActiveScholarships());
  if (urlPrefix) for (const url of [...groups.keys()]) if (!url.startsWith(urlPrefix)) groups.delete(url);
  const urls = [...groups.keys()].slice(0, limit ?? undefined);
  const counts = Object.fromEntries(OUTCOMES.map(o => [o, 0]));
  const sample = [];
  let plannedUpdates = 0;
  let scholarshipsUpdated = 0;
  const run = apply ? await store.startRun() : { id: randomUUID() };
  log(`${apply ? 'APPLY' : 'DRY RUN'}: ${urls.length} distinct source urls from ${[...groups.values()].reduce((n, g) => n + g.length, 0)} active scholarships (run ${run.id}${apply ? '' : ', not stored'}).`);

  try {
    await pool(urls, concurrency, async (url) => {
      const [{ previous, reference }, fetched] = await Promise.all([store.latestChecks(url), checkUrl(url, { fetchImpl, timeoutMs })]);
      const { outcome, detail } = classifyCheck({ ...fetched, previous, reference });
      counts[outcome] += 1;
      const check = {
        run_id: run.id, url, http_status: fetched.status, final_url: fetched.finalUrl,
        content_hash: fetched.hash, outcome, detail,
      };
      // checked_at comes from the stored check row (database clock at record time).
      // Dry-run never stores, so it uses the local fetch time purely for the plan.
      const checkedAt = apply ? (await store.recordCheck(check)).checked_at : new Date().toISOString();
      const plan = planScholarshipUpdates(groups.get(url), { ...check, checked_at: checkedAt });
      plannedUpdates += plan.length;
      if (apply) {
        for (const { id, patch } of plan) {
          await store.updateScholarship(id, patch);
          scholarshipsUpdated += 1;
        }
      }
      if (sample.filter(s => s.outcome === outcome).length < SAMPLE_PER_OUTCOME) {
        sample.push({ outcome, url, http_status: fetched.status, detail, rows: groups.get(url).length, updates: plan.length });
      }
    });
  } catch (err) {
    if (apply) {
      await store.finishRun(run.id, {
        status: 'failed', finished_at: new Date().toISOString(), error_message: String(err?.message ?? err).slice(0, 1000),
        records_seen: urls.length, records_inserted: 0, records_updated: scholarshipsUpdated, check_counts: counts,
      });
    }
    throw err;
  }

  if (apply) {
    await store.finishRun(run.id, {
      status: 'succeeded', finished_at: new Date().toISOString(), error_message: null,
      records_seen: urls.length, records_inserted: 0, records_updated: scholarshipsUpdated, check_counts: counts,
    });
  }
  return { mode: apply ? 'apply' : 'dry-run', runId: run.id, urls: urls.length, counts, plannedUpdates, scholarshipsUpdated, sample };
}

export function parseArgs(argv) {
  /** @type {{ apply: boolean, limit: number | undefined, concurrency: number, timeoutMs: number, urlPrefix?: string }} */
  const options = { apply: false, limit: undefined, concurrency: 4, timeoutMs: 15000 };
  const positiveInt = (name, value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) throw new Error(`${name} needs a positive whole number, got ${value}`);
    return n;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split('=', 2);
    const value = () => inline ?? argv[++i];
    if (flag === '--apply') options.apply = true;
    else if (flag === '--dry-run') options.apply = false;
    else if (flag === '--limit') options.limit = positiveInt(flag, value());
    else if (flag === '--concurrency') options.concurrency = positiveInt(flag, value());
    else if (flag === '--timeout-ms') options.timeoutMs = positiveInt(flag, value());
    else if (flag === '--url-prefix') {
      const prefix = value();
      if (!prefix || !normaliseUrl(prefix)) throw new Error(`--url-prefix needs an http(s) url, got ${prefix}`);
      options.urlPrefix = prefix;
    }
    else throw new Error(`Unknown argument ${argv[i]}`);
  }
  return options;
}

export function formatSummary(summary) {
  const lines = [`${summary.mode}: ${summary.urls} urls checked (run ${summary.runId}${summary.mode === 'apply' ? '' : ', not stored'})`];
  for (const outcome of OUTCOMES) lines.push(`  ${outcome.padEnd(11)} ${summary.counts[outcome]}`);
  lines.push(summary.mode === 'apply'
    ? `  scholarship rows updated: ${summary.scholarshipsUpdated}`
    : `  scholarship rows that --apply would update: ${summary.plannedUpdates} (nothing written)`);
  lines.push('sample:');
  for (const s of summary.sample) lines.push(`  ${s.outcome.padEnd(11)} ${String(s.http_status ?? '-').padEnd(4)} ${s.url} rows=${s.rows} updates=${s.updates}${s.detail ? ` (${s.detail})` : ''}`);
  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const summary = await runRefresh({ store: createSupabaseStore(client), ...options });
  console.log(formatSummary(summary));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`${err?.message ?? err}\n`);
    process.exitCode = 1;
  });
}
