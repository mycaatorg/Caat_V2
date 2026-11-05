"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { sanitizeError } from "@/lib/safe-error";
import { PrivacySettingsSchema } from "@/lib/schemas/community";
import type { PrivacySettings, CommunityProfileData } from "@/types/community";


// ─── Privacy settings ────────────────────────────────────────────────────────

export async function updatePrivacySettingsAction(
  settings: PrivacySettings,
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  // A6 — parse through an allow-list so only the known settings columns reach the
  // upsert; raw caller input is never spread in.
  const parsed = PrivacySettingsSchema.safeParse(settings);
  if (!parsed.success) return { error: "Invalid privacy settings" };
  const { error } = await supabase
    .from("community_profile_settings")
    .upsert({
      user_id: user.id,
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });
  return {
    error: error
      ? sanitizeError(error, "Could not update privacy settings.")
      : null,
  };
}


// ─── Community profile ────────────────────────────────────────────────────────

const PROFILE_LOAD_ERROR = "Could not load this community profile. Please try again.";

function profileLoadFailure(stage: string, error?: unknown, rawStatus?: unknown) {
  const rawCode = error && typeof error === "object" && "code" in error ? error.code : null;
  // Fixed stage labels, constrained codes and numeric status only: never log raw messages,
  // profile IDs, query details, cookies or tokens.
  const code = typeof rawCode === "string" && /^[A-Z0-9_]{1,24}$/i.test(rawCode) ? rawCode : "unknown";
  // PostgREST uses 0 when no HTTP response arrived. Keep that distinguishable
  // from an HTTP failure or an absent/invalid status without inspecting details.
  const status = typeof rawStatus === "number" && Number.isInteger(rawStatus)
    && (rawStatus === 0 || (rawStatus >= 100 && rawStatus <= 599)) ? rawStatus : null;
  console.error("[community-profile] load failed", { stage, code, status });
  return { profile: null, error: PROFILE_LOAD_ERROR };
}

export async function fetchCommunityProfileAction(
  targetUserId: string,
): Promise<{ profile: CommunityProfileData | null; error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user }, error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return profileLoadFailure("auth", authError, authError?.status);

  const [
    profileResult,
    settingsResult,
    followerResult,
    followingResult,
    isFollowingResult,
  ] = await Promise.all([
    // Same RLS reason as enrichPosts — see communities_v8 migration. The
    // RPC bypasses RLS for this minimal whitelist of columns; the privacy
    // gating below still controls which of those the client actually shows.
    supabase.rpc("get_community_profile_extended", { target_id: targetUserId }),
    supabase
      .from("community_profile_settings")
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle(),
    supabase
      .from("community_follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("followee_id", targetUserId),
    supabase
      .from("community_follows")
      .select("followee_id", { count: "exact", head: true })
      .eq("follower_id", targetUserId),
    supabase
      .from("community_follows")
      .select("followee_id")
      .eq("follower_id", user.id)
      .eq("followee_id", targetUserId)
      .maybeSingle(),
  ]);

  const reads = [
    ["profile", profileResult], ["privacy", settingsResult],
    ["followers", followerResult], ["following", followingResult],
    ["follow-state", isFollowingResult],
  ] as const;
  for (const [stage, result] of reads) {
    if ("error" in result && result.error) return profileLoadFailure(stage, result.error, result.status);
  }

  const profileRows = (profileResult.data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    graduation_year: number | null;
    school_name: string | null;
    preferred_countries: string[] | null;
    target_majors: string[] | null;
  }[];
  if (!profileRows.length) return { profile: null, error: null };
  const p = profileRows[0];
  const s = settingsResult.data ?? {
    show_graduation_year: true,
    show_school_name: true,
    show_preferred_countries: false,
    show_target_majors: false,
  };

  return {
    profile: {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      avatar_url: p.avatar_url,
      graduation_year: s.show_graduation_year ? p.graduation_year : null,
      school_name: s.show_school_name ? p.school_name : null,
      preferred_countries: s.show_preferred_countries
        ? (p.preferred_countries ?? [])
        : [],
      target_majors: s.show_target_majors ? (p.target_majors ?? []) : [],
      follower_count: followerResult.count ?? 0,
      following_count: followingResult.count ?? 0,
      is_following: !!isFollowingResult.data,
      is_own_profile: user.id === targetUserId,
      privacy: {
        show_graduation_year: s.show_graduation_year,
        show_school_name: s.show_school_name,
        show_preferred_countries: s.show_preferred_countries,
        show_target_majors: s.show_target_majors,
      },
    },
    error: null,
  };
}
