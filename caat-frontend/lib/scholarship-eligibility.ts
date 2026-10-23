import type { ScholarshipRow } from '@/types/scholarships';
import { safeHref } from '@/lib/safe-href';

export type CriterionStatus = 'matched' | 'unmet' | 'unknown';
export interface EligibilityCriterion { id: string; label: string; status: CriterionStatus; reason: string }
export interface EligibilityReport {
  criteria: EligibilityCriterion[];
  counts: Record<CriterionStatus, number>;
  sourceUrl: string | null;
  verifiedAt: string | null;
  syncedAt: string | null;
  freshness: 'recent' | 'stale' | 'unverified';
}
const FRESH_DAYS = 90;
const DAY = 86_400_000;
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v.trim()).map(v => v.trim()) : [];
}
function australia(value: string): boolean { return ['au', 'aus', 'australia', 'australian'].includes(value.trim().toLowerCase()); }
function timestamp(value: string | null | undefined, now: Date): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return null;
  const date = new Date(value);
  // Reject impossible calendar dates, including JS's February rollover.
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date > now || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return date.toISOString();
}

/** Compare only evidence the current schema can establish. Preferences are not qualifications. */
export function explainEligibility(
  profile: { nationality: string | null; student_status?: string | null } | null,
  scholarship: ScholarshipRow,
  now: Date,
): EligibilityReport {
  const sourceUrl = safeHref(scholarship.external_url);
  const verifiedAt = timestamp(scholarship.last_verified_at, now);
  const syncedAt = timestamp(scholarship.source_last_synced_at, now);
  const freshness = !verifiedAt ? 'unverified' : now.getTime() - Date.parse(verifiedAt) > FRESH_DAYS * DAY ? 'stale' : 'recent';
  const criteria: EligibilityCriterion[] = [];
  const add = (id: string, label: string, reason: string, status: CriterionStatus = 'unknown') => criteria.push({ id, label, reason, status });

  const cits = strings(scholarship.citizenships).map(c => c.toUpperCase());
  const included = strings(scholarship.eligible_countries);
  const excluded = strings(scholarship.excluded_countries);
  const isAustralian = !!profile?.nationality && australia(profile.nationality);
  const citizenshipIncludesAU = cits.includes('AU');
  const countryIncludesAU = included.some(australia);
  const excludesAU = excluded.some(australia);
  const conflicting = (excludesAU && (citizenshipIncludesAU || countryIncludesAU)) ||
    (citizenshipIncludesAU && included.length > 0 && !countryIncludesAU) ||
    (countryIncludesAU && cits.length > 0 && !citizenshipIncludesAU);
  const rules = [cits.length ? `Citizenship codes: ${cits.join(', ')}.` : '', included.length ? `Included countries: ${included.join(', ')}.` : '', excluded.length ? `Excluded countries: ${excluded.join(', ')}.` : ''].filter(Boolean).join(' ');
  let status: CriterionStatus = 'unknown';
  let reason = rules ? `${rules} Confirm the exact citizenship or residency rules with the provider.` : 'No clear citizenship rule is recorded. This does not mean everyone is eligible.';
  if (conflicting) reason = `${rules} These recorded restrictions conflict; check the provider before relying on them.`;
  else if (isAustralian && profile?.student_status && !['domestic', 'not_sure'].includes(profile.student_status)) reason = 'Your nationality and Australian student-status answers may conflict. Check your profile and the provider’s definitions.';
  else if (isAustralian && citizenshipIncludesAU) {
    status = 'matched'; reason = 'Your listed Australian nationality matches the recorded Australian citizenship criterion. Other requirements still need checking.';
  } else if (isAustralian && cits.length > 0 && cits.every(code => code === 'NZ')) {
    status = 'unmet'; reason = 'The recorded citizenship rule requires New Zealand citizenship, while your profile lists Australian nationality. Check with the provider if you also hold New Zealand citizenship or an exception applies.';
  }
  if (status !== 'unknown' && (freshness !== 'recent' || !sourceUrl)) {
    status = 'unknown'; reason = `${rules} Current eligibility cannot be confirmed from this source record; check the provider’s latest requirements.`;
  }
  add('citizenship', 'Citizenship and residency', reason, status);

  const fields: [string, string, unknown, string][] = [
    ['study-level', 'Study level', scholarship.study_level, 'A school graduation year does not confirm enrolment at this level.'],
    ['field', 'Field of study', scholarship.field_of_study, 'An interest in a subject does not confirm enrolment in an eligible course.'],
    ['year', 'Year of study', scholarship.year_level, 'Check which stage of the eligible course this refers to.'],
    ['gender', 'Gender criteria', scholarship.eligible_genders, 'Check this privately with the provider; CAAT has not assessed this criterion.'],
  ];
  for (const [id, label, value, explanation] of fields) {
    const values = strings(value);
    if (values.length) add(id, label, `Recorded requirement: ${values.join(', ')}. ${explanation}`);
  }
  if (scholarship.school_name) add('institution', 'Eligible institution', `Recorded institution: ${scholarship.school_name}. Confirm your offer or enrolment meets the rules.`);
  if (scholarship.minimum_gpa != null) add('gpa', 'Academic threshold', `Recorded minimum GPA: ${scholarship.minimum_gpa}. The source does not establish a comparable grade scale; confirm the required scale and your result.`);
  if (scholarship.need_based) add('need', 'Financial need', 'The scholarship is marked need-based. Check the evidence required privately with the provider.');
  if (scholarship.merit_based) add('merit', 'Merit criteria', 'The scholarship is marked merit-based. Check the provider’s academic or achievement criteria.');
  if (scholarship.state_region) add('region', 'Location requirements', `Recorded region: ${scholarship.state_region}. Check whether this refers to residence, study location or another condition.`);
  if (scholarship.eligibility_summary?.trim()) add('summary', 'Provider eligibility summary', scholarship.eligibility_summary.trim());
  const reqs = scholarship.application_requirements;
  if (reqs && typeof reqs === 'object') {
    strings(reqs.must_meet).forEach((requirement, i) => add(`requirement-${i}`, 'Additional requirement', requirement));
    if (typeof reqs.eligibility_text === 'string' && reqs.eligibility_text.trim() && reqs.eligibility_text.trim() !== scholarship.eligibility_summary?.trim() && !strings(reqs.must_meet).includes(reqs.eligibility_text.trim())) {
      add('requirements-text', 'Provider requirements', reqs.eligibility_text.trim());
    }
  }
  add('other', 'Confirm the complete requirements', 'Read the provider’s current criteria, opening dates and application instructions. The recorded list may be incomplete.');
  const counts = { matched: 0, unmet: 0, unknown: 0 };
  for (const criterion of criteria) counts[criterion.status]++;
  return { criteria, counts, sourceUrl, verifiedAt, syncedAt, freshness };
}
