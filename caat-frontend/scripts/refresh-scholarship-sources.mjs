#!/usr/bin/env node
// PROD-143: check each active scholarship's source page and record what was found.
//
//   node --env-file=<file outside the repo> scripts/refresh-scholarship-sources.mjs \
//     [--apply] [--limit N] [--concurrency 4] [--timeout-ms 15000] [--url-prefix https://host/path]
//
// Dry run is the default: it reads and fetches, prints counts and a sample, and writes nothing.
// See docs/operations/scholarship-source-refresh.md. Rules this file keeps:
// - one scholarship_source_checks row per distinct URL (fragment removed) per run;
// - only an `unchanged` check advances scholarships.last_verified_at, to that check's checked_at,
//   and only for rows whose stored fields were imported from the content the baseline hashed
//   ("anchored"); an unchanged page whose rows all predate the baseline is `unanchored`;
// - `gone` (404/410 now and on a check at least 24 h earlier) sets is_active=false and records why
//   in raw_payload; `changed`, `unreachable`, `unanchored` and `baseline` never touch scholarships;
// - nothing is deleted, no date is invented, no extracted field is changed.
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OUTCOMES = /** @type {const} */ (['baseline', 'unchanged', 'changed', 'unreachable', 'gone', 'unanchored']);
export const USER_AGENT = 'CAAT-SourceCheck/1.0 (scholarship listing freshness check; one request per page per run)';
export const GONE_GAP_MS = 24 * 60 * 60 * 1000;
// A baseline hash proves something about a row only if the row's fields were extracted from that
// content. The scraper stamps source_last_synced_at with its run's start time, and a run (plus the
// manual load after it) can take days, so an import up to 7 days before the baseline still counts as
// extracted from the page the baseline hashed. Anything older predates the baseline: unanchored.
export const ANCHOR_TOLERANCE_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const SAMPLE_PER_OUTCOME = 3;
const MIGRATION = 'supabase/migrations/20261024090000_scholarship_source_checks.sql';
const MISSING_TABLE_CODES = new Set(['PGRST205', '42P01']);

// Hosts whose pages have no <main>: the element that holds the page's own content.
// UNSW pages use <main>, so they take the default path.
export const HOST_CONTENT = {
  'www.sydney.edu.au': { tag: 'div', className: 'content-container' }, // AEM template
};

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

// A whole tag, with quoted attribute values (which may contain ">") kept inside it.
const TAG = /<\/?[a-zA-Z][^\s/>]*(?:"[^"]*"|'[^']*'|[^'">])*>/g;

/**
 * Offsets of the first `tag` element whose opening tag passes `test`, depth-balanced:
 * { start, innerStart, innerEnd, end }. An unclosed element runs to the end. Null if absent.
 */
function elementRange(html, tag, test = () => true) {
  const re = new RegExp(TAG.source, 'g');
  const name = tag.toLowerCase();
  let depth = 0;
  let start = -1;
  let innerStart = -1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const raw = m[0];
    const closing = raw.startsWith('</');
    if (raw.slice(closing ? 2 : 1).match(/^[^\s/>]+/)[0].toLowerCase() !== name) continue;
    if (start < 0) {
      if (!closing && test(raw)) { start = m.index; innerStart = re.lastIndex; depth = 1; }
    } else if (closing) {
      depth -= 1;
      if (depth === 0) return { start, innerStart, innerEnd: m.index, end: re.lastIndex };
    } else if (!raw.endsWith('/>')) {
      depth += 1;
    }
  }
  return start >= 0 ? { start, innerStart, innerEnd: html.length, end: html.length } : null;
}

function element(html, tag, test) {
  const r = elementRange(html, tag, test);
  return r ? html.slice(r.innerStart, r.innerEnd) : null;
}

function removeElements(html, tag) {
  let out = html;
  for (let r = elementRange(out, tag); r; r = elementRange(out, tag)) out = `${out.slice(0, r.start)} ${out.slice(r.end)}`;
  return out;
}

const hasClass = (className) => (openTag) => {
  const m = openTag.match(/\sclass\s*=\s*("([^"]*)"|'([^']*)')/i);
  return Boolean(m && (m[2] ?? m[3]).split(/\s+/).includes(className));
};

/** Visible text of the page's content (host selector, else <main>, else <body>) without chrome. */
export function extractVisibleText(html, url) {
  let text = String(html).replace(/<!--[\s\S]*?-->/g, ' ');
  text = text.replace(/<(script|style|noscript|template|svg|head)\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi, ' ');
  let host = null;
  try { host = url ? new URL(url).hostname : null; } catch { host = null; }
  const rule = host ? HOST_CONTENT[host] : undefined;
  text = (rule && element(text, rule.tag, hasClass(rule.className))) ?? element(text, 'main') ?? element(text, 'body') ?? text;
  for (const chrome of ['nav', 'footer']) text = removeElements(text, chrome);
  text = text.replace(TAG, ' ');
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

/** sha256 over the normalised visible text for HTML, over the raw bytes otherwise. */
export function contentHash(body, contentType, url) {
  const isHtml = !contentType || /html|xml/i.test(contentType);
  const input = isHtml ? extractVisibleText(typeof body === 'string' ? body : Buffer.from(body).toString('utf8'), url) : body;
  return createHash('sha256').update(typeof input === 'string' ? input : Buffer.from(input)).digest('hex');
}

const sameUrl = (a, b) => !a || normaliseUrl(a) === b;

/** True when the row was imported no earlier than ANCHOR_TOLERANCE_MS before the baseline. */
export function isAnchored(row, baselineAt) {
  if (!row?.source_last_synced_at || !baselineAt) return false;
  return Date.parse(row.source_last_synced_at) >= Date.parse(baselineAt) - ANCHOR_TOLERANCE_MS;
}

/**
 * previous: the most recent stored check for this URL (any outcome).
 * reference: the most recent `baseline` check: its hash is the accepted content and its
 * checked_at is the time rows are anchored against. `unchanged`/`unanchored` checks repeat
 * that hash, and a `changed` hash never becomes the reference, so a changed page stays
 * `changed` until a re-import (a row's source_last_synced_at later than the baseline)
 * re-baselines it.
 * @param {{
 *   url: string, status?: number | null, error?: string | null, hash?: string | null, finalUrl?: string | null,
 *   previous?: { http_status?: number | null, checked_at?: string | null, final_url?: string | null } | null,
 *   reference?: { content_hash?: string | null, checked_at?: string | null } | null,
 *   rows?: Array<{ source_last_synced_at?: string | null }>, now?: number,
 * }} input
 */
export function classifyCheck({ url, status, error, hash, finalUrl, previous, reference, rows = [], now = Date.now() }) {
  if (error) return { outcome: 'unreachable', detail: String(error) };
  if (!sameUrl(finalUrl, url)) return { outcome: 'unreachable', detail: `redirected to ${finalUrl}` };
  if (status === 404 || status === 410) {
    const before = previous?.http_status;
    if ((before === 404 || before === 410) && sameUrl(previous?.final_url, url)) {
      const gap = now - Date.parse(previous?.checked_at ?? '');
      if (gap >= GONE_GAP_MS) return { outcome: 'gone', detail: `HTTP ${status}; previous check HTTP ${before} at ${previous?.checked_at}` };
      return { outcome: 'unreachable', detail: `HTTP ${status}; previous not-found strike is less than 24 h old` };
    }
    return { outcome: 'unreachable', detail: `HTTP ${status}; first not-found strike, needs a second at least 24 h later` };
  }
  if (status === 429 || (status ?? 0) >= 500) return { outcome: 'unreachable', detail: `HTTP ${status}` };
  if (!(status && status >= 200 && status < 300)) return { outcome: 'unreachable', detail: `HTTP ${status}; not a usable page` };
  if (!reference?.content_hash) return { outcome: 'baseline', detail: 'first stored content hash for this url' };
  if (reference.content_hash !== hash) {
    const baselineAt = Date.parse(reference.checked_at ?? '');
    if (rows.some((r) => r.source_last_synced_at && Date.parse(r.source_last_synced_at) > baselineAt)) {
      return { outcome: 'baseline', detail: 're-imported since the baseline; new baseline' };
    }
    return { outcome: 'changed', detail: 'content differs from the baseline hash' };
  }
  const anchored = rows.filter((r) => isAnchored(r, reference.checked_at)).length;
  if (anchored === 0) {
    return { outcome: 'unanchored', detail: `page unchanged since the baseline at ${reference.checked_at}, but the stored fields predate it; needs a re-import` };
  }
  return { outcome: 'unchanged', detail: anchored < rows.length ? `${rows.length - anchored} of ${rows.length} rows predate the baseline and stay unverified` : null };
}

const later = (candidate, current) => !current || Date.parse(candidate) > Date.parse(current);

/** Planned scholarship writes for one check. Only rows whose value would change are listed. */
export function planScholarshipUpdates(rows, check) {
  const at = check.checked_at;
  if (!at) throw new Error('A check without checked_at cannot update scholarships.');
  if (check.outcome === 'unchanged') {
    if (!check.baseline_at) throw new Error('An unchanged check without its baseline time cannot verify anything.');
    return rows.filter((r) => isAnchored(r, check.baseline_at) && later(at, r.last_verified_at)).map((r) => ({ id: r.id, action: 'verify', at }));
  }
  if (check.outcome === 'gone') {
    return rows.filter((r) => r.is_active !== false).map((r) => ({
      id: r.id,
      action: 'deactivate',
      sourceCheck: {
        outcome: 'gone', http_status: check.http_status ?? null, url: check.url ?? null, checked_at: at,
        run_id: check.run_id ?? null, reason: `Source page returned HTTP ${check.http_status} on two checks at least 24 h apart`,
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
    return { status, finalUrl, hash: contentHash(body, type, url), error: null };
  } catch (err) {
    const cause = err?.cause?.code ?? err?.cause?.message;
    const error = timedOut ? `timeout after ${timeoutMs} ms` : `network error: ${err?.message ?? err}${cause ? ` (${cause})` : ''}`;
    return { status: null, finalUrl: null, hash: null, error };
  } finally {
    clearTimeout(timer);
  }
}

/** `prefix` matches at a path boundary: /path matches /path, /path/x and /path?x, not /pathology. */
export function matchesPrefix(url, prefix) {
  if (!url.startsWith(prefix)) return false;
  if (url.length === prefix.length || prefix.endsWith('/')) return true;
  return url[prefix.length] === '/' || url[prefix.length] === '?';
}

/** Run `worker` over items; after the first failure no new item starts, in-flight ones finish, then it rethrows. */
async function pool(items, concurrency, worker) {
  let next = 0;
  let aborted = false;
  let failure = null;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (!aborted && next < items.length) {
      const index = next++;
      try {
        await worker(items[index], index);
      } catch (err) {
        if (!aborted) { aborted = true; failure = err; }
      }
    }
  });
  await Promise.all(runners);
  if (aborted) throw failure;
}

const missingTable = (error) => Boolean(error && (MISSING_TABLE_CODES.has(error.code) || /does not exist|could not find the table/i.test(error.message ?? '')));
const must = (result, what) => {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
};

/** Data access through a service-role Supabase client. */
export function createSupabaseStore(client) {
  return {
    /** Apply only: the checks table and the run counts column must exist before anything is written. */
    async assertReady() {
      for (const [table, columns] of [['scholarship_source_checks', 'id,final_url'], ['scholarship_import_runs', 'id,check_counts']]) {
        const { error } = await client.from(table).select(columns).limit(1);
        if (error) throw new Error(`${table} is not ready (${error.code ?? ''} ${error.message}). Apply ${MIGRATION} first.`);
      }
    },
    async loadActiveScholarships() {
      const rows = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const page = must(await client.from('scholarships')
          .select('id,external_url,last_verified_at,source_last_synced_at,is_active')
          .eq('is_active', true).not('external_url', 'is', null)
          .order('id').range(from, from + PAGE_SIZE - 1), 'load scholarships') ?? [];
        rows.push(...page);
        if (page.length < PAGE_SIZE) return rows;
      }
    },
    /** Latest check and latest baseline. A missing table reads as no history (`missing: true`). */
    async latestChecks(url) {
      const previous = await client.from('scholarship_source_checks')
        .select('checked_at,http_status,final_url,content_hash,outcome').eq('url', url)
        .order('checked_at', { ascending: false }).limit(1);
      if (missingTable(previous.error)) return { previous: null, reference: null, missing: true };
      const reference = await client.from('scholarship_source_checks')
        .select('checked_at,content_hash,final_url,outcome').eq('url', url).eq('outcome', 'baseline')
        .not('content_hash', 'is', null).order('checked_at', { ascending: false }).limit(1);
      if (missingTable(reference.error)) return { previous: null, reference: null, missing: true };
      return { previous: must(previous, 'load previous check')?.[0] ?? null, reference: must(reference, 'load reference check')?.[0] ?? null, missing: false };
    },
    async startRun() {
      return must(await client.from('scholarship_import_runs').insert({ status: 'started' }).select('id,started_at').single(), 'start run');
    },
    async recordCheck(check) {
      return must(await client.from('scholarship_source_checks').insert(check).select('id,checked_at').single(), 'record check');
    },
    /** Sets last_verified_at only where it is null or earlier. Returns whether a row changed. */
    async verifyScholarship(id, at) {
      const data = must(await client.from('scholarships').update({ last_verified_at: at }).eq('id', id)
        .or(`last_verified_at.is.null,last_verified_at.lt."${at}"`).select('id'), `verify scholarship ${id}`);
      return Array.isArray(data) && data.length > 0;
    },
    /** Deactivates a still-active row and merges the reason into raw_payload in one statement. */
    async deactivateScholarship(id, sourceCheck) {
      const data = must(await client.rpc('scholarship_mark_gone', { p_id: id, p_check: sourceCheck }), `deactivate scholarship ${id}`);
      return Boolean(data);
    },
    async finishRun(id, patch) {
      must(await client.from('scholarship_import_runs').update(patch).eq('id', id), 'finish run');
    },
  };
}

/**
 * Run one refresh. In dry-run, no store write method is called and planned
 * updates use the local fetch time only for counting; nothing is persisted.
 * @param {{
 *   store: {
 *     assertReady: () => Promise<unknown>,
 *     loadActiveScholarships: () => Promise<any[]>,
 *     latestChecks: (url: string) => Promise<{ previous: any, reference: any, missing?: boolean }>,
 *     startRun: () => Promise<{ id: string }>,
 *     recordCheck: (check: Record<string, unknown>) => Promise<{ checked_at: string }>,
 *     verifyScholarship: (id: string, at: string) => Promise<boolean>,
 *     deactivateScholarship: (id: string, sourceCheck: Record<string, unknown>) => Promise<boolean>,
 *     finishRun: (id: string, patch: Record<string, unknown>) => Promise<unknown>,
 *   },
 *   fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>,
 *   apply?: boolean, limit?: number, concurrency?: number, timeoutMs?: number, urlPrefix?: string,
 *   now?: () => number, log?: (message: string) => void,
 * }} options
 */
export async function runRefresh({ store, fetchImpl = globalThis.fetch, apply = false, limit, concurrency = 4, timeoutMs = 15000, urlPrefix, now = () => Date.now(), log = console.log }) {
  if (apply) await store.assertReady();
  const groups = groupRowsByUrl(await store.loadActiveScholarships());
  const prefix = urlPrefix ? normaliseUrl(urlPrefix) : null;
  if (urlPrefix && !prefix) throw new Error(`--url-prefix needs an http(s) url, got ${urlPrefix}`);
  if (prefix) for (const url of [...groups.keys()]) if (!matchesPrefix(url, prefix)) groups.delete(url);
  const urls = [...groups.keys()].slice(0, limit ?? undefined);
  /** @type {Record<string, number>} */
  const counts = { ...Object.fromEntries(OUTCOMES.map((o) => [o, 0])), unanchored_rows: 0 };
  const sample = [];
  let plannedUpdates = 0;
  let scholarshipsUpdated = 0;
  let warnedMissing = false;
  const run = apply ? await store.startRun() : { id: randomUUID() };
  log(`${apply ? 'APPLY' : 'DRY RUN'}: ${urls.length} distinct source urls from ${[...groups.values()].reduce((n, g) => n + g.length, 0)} active scholarships (run ${run.id}${apply ? '' : ', not stored'}).`);

  const totals = () => ({ records_seen: urls.length, records_inserted: 0, records_updated: scholarshipsUpdated, check_counts: counts });
  try {
    await pool(urls, concurrency, async (url) => {
      const rows = groups.get(url);
      const [history, fetched] = await Promise.all([store.latestChecks(url), checkUrl(url, { fetchImpl, timeoutMs })]);
      if (history.missing && !warnedMissing) {
        warnedMissing = true;
        log('Note: scholarship_source_checks does not exist here yet; dry run treats every url as having no history.');
      }
      const { outcome, detail } = classifyCheck({ url, ...fetched, previous: history.previous, reference: history.reference, rows, now: now() });
      const check = { run_id: run.id, url, http_status: fetched.status, final_url: fetched.finalUrl, content_hash: fetched.hash, outcome, detail };
      // checked_at comes from the stored check row (database clock at record time).
      // Dry-run never stores, so it uses the local clock purely to count planned updates.
      const checkedAt = apply ? (await store.recordCheck(check)).checked_at : new Date(now()).toISOString();
      counts[outcome] += 1;
      if (outcome === 'unchanged' || outcome === 'unanchored') {
        counts.unanchored_rows += rows.filter((r) => !isAnchored(r, history.reference?.checked_at)).length;
      }
      const plan = planScholarshipUpdates(rows, { ...check, checked_at: checkedAt, baseline_at: history.reference?.checked_at ?? null });
      plannedUpdates += plan.length;
      if (apply) {
        for (const op of plan) {
          const changed = op.action === 'verify' ? await store.verifyScholarship(op.id, op.at) : await store.deactivateScholarship(op.id, op.sourceCheck);
          if (changed) scholarshipsUpdated += 1;
        }
      }
      if (sample.filter((s) => s.outcome === outcome).length < SAMPLE_PER_OUTCOME) {
        sample.push({ outcome, url, http_status: fetched.status, detail, rows: rows.length, updates: plan.length });
      }
    });
  } catch (err) {
    if (apply) await finishSafely(store, run.id, { status: 'failed', error_message: String(err?.message ?? err).slice(0, 1000), ...totals() });
    throw err;
  }

  if (apply) {
    try {
      await store.finishRun(run.id, { status: 'succeeded', finished_at: new Date().toISOString(), error_message: null, ...totals() });
    } catch (err) {
      // The full summary just failed to write; store the minimal failure so the run never stays `started`.
      await store.finishRun(run.id, { status: 'failed', finished_at: new Date().toISOString(), error_message: `full run summary not stored: ${String(err?.message ?? err)}`.slice(0, 1000) });
      throw err;
    }
  }
  return { mode: apply ? 'apply' : 'dry-run', runId: run.id, urls: urls.length, counts, plannedUpdates, scholarshipsUpdated, sample };
}

/** Mark a run finished; if the full write fails, retry with the minimal columns so it never stays `started`. */
async function finishSafely(store, runId, patch) {
  const finished = { ...patch, finished_at: new Date().toISOString() };
  try {
    await store.finishRun(runId, finished);
  } catch (err) {
    await store.finishRun(runId, {
      status: 'failed', finished_at: finished.finished_at,
      error_message: `${patch.error_message ?? ''}; full run summary not stored: ${err?.message ?? err}`.slice(0, 1000),
    });
  }
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
    const eq = argv[i].indexOf('=');
    const flag = eq < 0 ? argv[i] : argv[i].slice(0, eq);
    const inline = eq < 0 ? undefined : argv[i].slice(eq + 1);
    const value = () => inline ?? argv[++i];
    if (flag === '--apply') options.apply = true;
    else if (flag === '--dry-run') options.apply = false;
    else if (flag === '--limit') options.limit = positiveInt(flag, value());
    else if (flag === '--concurrency') options.concurrency = positiveInt(flag, value());
    else if (flag === '--timeout-ms') options.timeoutMs = positiveInt(flag, value());
    else if (flag === '--url-prefix') {
      const raw = value();
      const prefix = normaliseUrl(raw);
      if (!prefix) throw new Error(`--url-prefix needs an http(s) url, got ${raw}`);
      options.urlPrefix = prefix;
    } else throw new Error(`Unknown argument ${argv[i]}`);
  }
  return options;
}

export function formatSummary(summary) {
  const lines = [`${summary.mode}: ${summary.urls} urls checked (run ${summary.runId}${summary.mode === 'apply' ? '' : ', not stored'})`];
  for (const outcome of OUTCOMES) lines.push(`  ${outcome.padEnd(11)} ${summary.counts[outcome]}`);
  lines.push(`  rows left unverified because their import predates the baseline: ${summary.counts.unanchored_rows}`);
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
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (load them with node --env-file from a file outside the repo).');
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
