// Local-only: seed a representative synthetic scholarship catalogue (default
// 4,200 rows, about the production catalogue size) for design review and
// search-performance baselines (PROD-72). Every row is fictional, tagged
// external_id "synthetic-catalog-*", and removable with --remove.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Refusing to seed a non-loopback Supabase');
const admin = createClient(url, key, { auth: { persistSession: false } });

const PREFIX = 'synthetic-catalog-';
if (process.argv.includes('--remove')) {
  const { error } = await admin.from('scholarships').delete().like('external_id', `${PREFIX}%`);
  if (error) throw error;
  console.log('Removed synthetic catalogue.');
  process.exit(0);
}

const count = Number(process.argv[2] ?? 4200);
// Fictional institutions and providers only.
const AU = ['Harbourside University', 'Southern Cross Institute', 'Coastal University of Technology', 'Red Gum University', 'Banksia College', 'Wattle Valley University', 'Riverlands University', 'Tasman Bay University'];
const OTHER = [['New Zealand', 'Kowhai University'], ['United Kingdom', 'Fenmoor University'], ['United States', 'Lakeshore College'], ['Canada', 'Northfield University'], ['Singapore', 'Marina Institute']];
const FIELDS = ['Engineering', 'Medicine', 'Nursing', 'Law', 'Business', 'Commerce', 'Science', 'Computer Science', 'Information Technology', 'Education', 'Arts', 'Design', 'Architecture', 'Psychology', 'Music', 'Agriculture', 'Environment', 'Mathematics'];
const KINDS = ['Excellence Scholarship', 'Access Scholarship', 'Regional Scholarship', 'Leadership Award', 'First in Family Scholarship', 'Merit Scholarship', 'Equity Bursary', 'Indigenous Scholarship', 'Women in STEM Scholarship', 'Rural and Remote Grant'];
const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (list) => list[Math.floor(rand() * list.length)];

const rows = [];
for (let i = 0; i < count; i += 1) {
  const domestic = rand() < 0.85;
  const [country, school] = domestic ? ['Australia', pick(AU)] : pick(OTHER);
  const field = pick(FIELDS);
  const kind = pick(KINDS);
  const amount = Math.round((1000 + rand() * 24000) / 500) * 500;
  const currency = country === 'Australia' ? 'AUD' : country === 'United Kingdom' ? 'GBP' : 'USD';
  const deadline = new Date(Date.UTC(2026, 9, 7) + Math.floor(rand() * 400 - 30) * 86_400_000);
  const domesticOnly = country === 'Australia' && rand() < 0.6;
  rows.push({
    external_id: `${PREFIX}${i}`,
    slug: `${PREFIX}${i}`,
    title: `${school} ${field} ${kind}`,
    provider_name: school,
    school_name: school,
    description: `Synthetic test scholarship for ${field.toLowerCase()} students at ${school}. Not a real award.`,
    amount_value: amount,
    amount_currency: currency,
    amount_display: `${currency} $${amount.toLocaleString('en-AU')}`,
    country,
    state_region: country === 'Australia' ? pick(STATES) : null,
    deadline_at: deadline.toISOString(),
    study_level: ['undergraduate'],
    funding_type: [rand() < 0.5 ? 'merit' : 'need'],
    citizenships: domesticOnly ? ['Australia'] : null,
    tags: [field],
    field_of_study: [field],
    is_active: rand() < 0.95,
  });
}
// Replace any previous synthetic catalogue so reruns are deterministic.
const { error: clearError } = await admin.from('scholarships').delete().like('external_id', `${PREFIX}%`);
if (clearError) throw clearError;
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await admin.from('scholarships').insert(rows.slice(i, i + 500));
  if (error) throw error;
}
console.log(`Seeded ${rows.length} synthetic scholarships.`);
