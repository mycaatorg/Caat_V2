import type { UserScholarship } from '@/app/(main)/scholarships/user-scholarships-api';

export type ScholarshipFilter = 'all' | 'upcoming' | 'past' | 'undated';
export type ScholarshipSort = 'deadline' | 'newest' | 'name';

/** Preserve the entered calendar day rather than converting it between time zones. */
export function scholarshipDateKey(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return null;
  const key = value.slice(0, 10);
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? key : null;
}

export function scholarshipDeadlineGroup(row: UserScholarship, today: string): Exclude<ScholarshipFilter, 'all'> {
  const day = scholarshipDateKey(row.deadline_at);
  return day === null ? 'undated' : day < today ? 'past' : 'upcoming';
}

export function selectPersonalScholarships(
  rows: UserScholarship[], query: string, filter: ScholarshipFilter, sort: ScholarshipSort, today: string,
): UserScholarship[] {
  const search = query.trim().toLowerCase();
  return rows.filter(row =>
    (filter === 'all' || scholarshipDeadlineGroup(row, today) === filter) &&
    [row.title, row.provider_name, row.country ?? ''].some(value => value.toLowerCase().includes(search)),
  ).sort((a, b) => {
    const order = sort === 'deadline'
      ? (scholarshipDateKey(a.deadline_at) ?? '9999-99-99').localeCompare(scholarshipDateKey(b.deadline_at) ?? '9999-99-99')
      : sort === 'newest' ? b.created_at.localeCompare(a.created_at) : a.title.localeCompare(b.title);
    return order || a.id.localeCompare(b.id);
  });
}
