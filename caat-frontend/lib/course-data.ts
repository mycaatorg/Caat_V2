import type { SupabaseClient } from '@supabase/supabase-js';
import type { CourseOffering } from '@/types/courses';
import { safeHref } from '@/lib/safe-href';

const text = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
const year = (v: unknown): number | null => typeof v === 'number' && Number.isInteger(v) && v >= 2000 && v <= 2100 ? v : null;
function checkedDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(raw)) return null;
  const date = new Date(raw);
  const day = new Date(`${raw.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === raw.slice(0, 10) ? date.toISOString() : null;
}

export function normalizeCourse(value: unknown): CourseOffering | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  const id = text(r.id), institution_key = text(r.institution_key), institution_name = text(r.institution_name), program_code = text(r.program_code), name = text(r.name);
  const source_url = safeHref(text(r.source_url));
  if (!id || !institution_key || !institution_name || !program_code || !name || !source_url) return null;
  return {
    id, institution_key, institution_name, program_code, name, source_url,
    school_id: typeof r.school_id === 'number' && Number.isSafeInteger(r.school_id) && r.school_id > 0 ? r.school_id : null,
    campus: text(r.campus), duration: text(r.duration), prerequisites: text(r.prerequisites),
    prerequisites_url: safeHref(text(r.prerequisites_url)), assumed_knowledge: text(r.assumed_knowledge),
    fee_amount: typeof r.fee_amount === 'number' && Number.isFinite(r.fee_amount) && r.fee_amount >= 0 ? r.fee_amount : null,
    fee_year: year(r.fee_year), fee_category: text(r.fee_category), fee_basis: text(r.fee_basis),
    application_route: text(r.application_route), application_url: safeHref(text(r.application_url)), uac_code: text(r.uac_code),
    source_year: year(r.source_year), verified_at: checkedDate(r.verified_at), active: r.active === true,
  };
}

/** A saved course as the application hub shows it (PROD-148): the same
 *  safe-URL and valid-date rules as the catalogue, but a row is kept (with an
 *  unsafe link dropped) because hiding a saved course would misreport it. */
export type HubCourse = Pick<CourseOffering, 'id' | 'name' | 'campus' | 'application_route' | 'application_url' | 'verified_at' | 'active' | 'prerequisites' | 'prerequisites_url' | 'assumed_knowledge' | 'source_year'> & { source_url: string | null };

export function normalizeHubCourse(value: unknown): HubCourse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  const id = text(r.id), name = text(r.name);
  if (!id || !name) return null;
  return {
    id, name, prerequisites: text(r.prerequisites), prerequisites_url: safeHref(text(r.prerequisites_url)),
    assumed_knowledge: text(r.assumed_knowledge), source_year: year(r.source_year),
    campus: text(r.campus), application_route: text(r.application_route),
    application_url: safeHref(text(r.application_url)), source_url: safeHref(text(r.source_url)),
    verified_at: checkedDate(r.verified_at), active: r.active === true,
  };
}

export function courseFreshness(value: string | null, now = new Date()): 'recent' | 'stale' | 'unverified' {
  const date = checkedDate(value);
  if (!date || Date.parse(date) > now.getTime()) return 'unverified';
  return now.getTime() - Date.parse(date) > 90 * 86400000 ? 'stale' : 'recent';
}

export function formatCourseFee(course: CourseOffering): string {
  if (course.fee_amount === null || course.fee_year === null || !course.fee_category || !course.fee_basis) return 'Fee not confirmed. Check the provider.';
  return `${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(course.fee_amount)} AUD (${course.fee_year}). ${course.fee_category}. ${course.fee_basis}.`;
}

export async function loadCourseOfferings(client: SupabaseClient): Promise<CourseOffering[]> {
  const { data, error } = await client.from('course_offerings').select('id, institution_key, institution_name, program_code, name, school_id, campus, duration, prerequisites, prerequisites_url, assumed_knowledge, fee_amount, fee_year, fee_category, fee_basis, application_route, application_url, uac_code, source_url, source_year, verified_at, active').order('institution_name').order('name');
  if (error) throw new Error('Could not load university courses', { cause: error });
  const courses = (data ?? []).map(normalizeCourse);
  // An invalid catalogue row must not silently vanish from somebody's saved list.
  if (courses.some(c => !c)) throw new Error('Could not load university courses');
  return courses as CourseOffering[];
}
