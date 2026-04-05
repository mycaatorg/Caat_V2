import type { ProfileRow, StandardisedTestScore } from "@/types/profile";

export function calcCompletion(
  profile: ProfileRow,
  scores: StandardisedTestScore[]
): number {
  const fields: unknown[] = [
    profile.first_name,
    profile.last_name,
    profile.birth_date,
    profile.nationality,
    profile.current_location,
    profile.phone,
    profile.linkedin,
    profile.school_name,
    profile.curriculum,
    profile.graduation_year,
    profile.avatar_url,
    profile.target_majors?.length,
    profile.preferred_countries?.length,
    scores.length,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

export function completionHint(pct: number): string {
  if (pct < 50) return "Fill in your personal and academic info to get started.";
  if (pct < 80) return "Add test scores to reach 80%.";
  if (pct < 100) return "Almost there — add your interests and goals.";
  return "Your profile is complete!";
}

export function formatDOB(value: string): string {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}
