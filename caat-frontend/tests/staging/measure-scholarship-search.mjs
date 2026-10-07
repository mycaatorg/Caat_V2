// Local-only baseline for scholarship browse/search (PROD-72). Times the
// search_scholarships RPC the /scholarships page and public directory use,
// over representative scenarios. Run after seed-synthetic-catalog.mjs.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
if (!url || !anon) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Refusing to measure a non-loopback Supabase');
const sb = createClient(url, anon, { auth: { persistSession: false } });

const personal = { p_target_majors: ['engineering', 'science'], p_pref_countries: ['australia'], p_home_country: 'Australia', p_domestic_codes: ['AU', 'AU-PR'], p_grad_year: 2026 };
const scenarios = [
  ['initial page (anonymous)', {}],
  ['initial page (personalised)', personal],
  ['search "engineering"', { ...personal, p_search: 'engineering' }],
  ['search no match', { ...personal, p_search: 'zzzz-nothing' }],
  ['location + field filters', { ...personal, p_location: 'Australia', p_fields: ['Engineering'] }],
  ['open only', { ...personal, p_open_only: true }],
  ['page 20', { ...personal, p_offset: 120 }],
];
const runs = Number(process.argv[2] ?? 15);
const results = [];
for (const [name, params] of scenarios) {
  const times = [];
  let total = null;
  for (let i = 0; i < runs; i += 1) {
    const t = performance.now();
    const { data, error } = await sb.rpc('search_scholarships', { p_limit: Number(process.env.M2_LIMIT ?? 6), ...params });
    times.push(performance.now() - t);
    if (error) throw error;
    total = data?.[0]?.total_count ?? 0;
  }
  times.sort((a, b) => a - b);
  results.push({ scenario: name, total, median_ms: Math.round(times[Math.floor(runs / 2)]), p95_ms: Math.round(times[Math.floor(runs * 0.95) - 1] ?? times.at(-1)) });
}
console.table(results);
