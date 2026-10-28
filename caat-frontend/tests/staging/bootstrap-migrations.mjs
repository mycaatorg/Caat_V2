// The synthetic snapshot + three adapters cover migrations before this date.
// New migrations must use current timestamps, never be backdated into that baseline.
export const firstIncrementalMigration = '20261023070000';
const prefix = '../../supabase/migrations/';
const seedSteps = new Set(['seed-courses.sql', 'seed-opportunities.sql']);

// Seeds deliberately sit after the schema they depend on. Keep this explicit.
export const postBaselineSteps = [
  '../../supabase/migrations/20261023070000_course_offerings.sql',
  '../../supabase/migrations/20261024090000_scholarship_source_checks.sql',
  '../../supabase/migrations/20261024100000_scholarship_bookmark_update_policy.sql',
  'seed-courses.sql',
  '../../supabase/migrations/20261024110000_scholarship_attachments.sql',
  '../../supabase/migrations/20261024120000_application_evidence_links.sql',
  '../../supabase/migrations/20261024130000_scholarship_attachment_integrity.sql',
  '../../supabase/migrations/20261024140000_evidence_source_versions.sql',
  '../../supabase/migrations/20261024150000_evidence_items.sql',
  'seed-opportunities.sql',
  '../../supabase/migrations/20261025010000_requirement_evidence_links.sql',
  '../../supabase/migrations/20261025020000_edit_personal_task.sql',
  '../../supabase/migrations/20261026010000_course_preparation.sql',
  '../../supabase/migrations/20261026020000_course_preparation_conflicts.sql',
  '../../supabase/migrations/20261027010000_shortlist_sharing.sql',
  '../../supabase/migrations/20261027020000_community_resume_sharing.sql',
  '../../supabase/migrations/20261027030000_owned_community_content.sql',
  '../../supabase/migrations/20261027040000_personal_task_validation.sql',
  '../../supabase/migrations/20261027050000_community_admin_cleanup.sql',
  '../../supabase/migrations/20261028010000_community_write_validation.sql',
  '../../supabase/migrations/20261028020000_owned_community_content_cursors.sql',
];

/** Pure preflight: usable by discovery CI without a database or credentials. */
export function validateMigrationPlan(steps, files) {
  const expected = files.filter(name => /^\d{14}_[^/]+\.sql$/.test(name)
    && name.slice(0, 14) >= firstIncrementalMigration).sort();
  if (steps.some(step => typeof step !== 'string' || (!step.startsWith(prefix) && !seedSteps.has(step)))) {
    throw new Error('Invalid bootstrap migration plan: unknown SQL step.');
  }
  const actual = steps.filter(step => step.startsWith(prefix)).map(step => step.slice(prefix.length));
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    throw new Error('Invalid bootstrap migration plan: include every post-baseline migration exactly once in filename order.');
  }
}
