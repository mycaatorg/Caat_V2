import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SkipOnboardingLink, WelcomeFlow } from "@/components/onboarding/WelcomeFlow";
import { createServerClient } from "@/lib/supabase/server";
import type { OnboardingProfile } from "@/lib/onboarding";
import type { JourneyStage, StudentStatus, YearLevel } from "@/types/profile";

export const metadata = { title: "Welcome" };

// PROD-73: a focused flow outside the app shell. Answers save step by step,
// so a student can leave and resume from where they stopped.
export default async function WelcomePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/welcome");

  const columns =
    "year_level, student_status, journey_stage, preferred_countries, target_majors, graduation_year, onboarding_completed_at";
  let { data } = await supabase.from("profiles").select(columns).eq("id", user.id).maybeSingle();
  if (!data) {
    // Profiles are created lazily; a brand-new account needs its row before
    // the first answer can be saved.
    const [firstName, ...rest] = String(user.user_metadata?.full_name ?? "").trim().split(/\s+/);
    await supabase.from("profiles").insert({
      id: user.id,
      first_name: firstName || null,
      last_name: rest.join(" ") || null,
      email: user.email ?? null,
    });
    ({ data } = await supabase.from("profiles").select(columns).eq("id", user.id).maybeSingle());
  }

  const initial: OnboardingProfile = {
    year_level: (data?.year_level as YearLevel | null) ?? null,
    student_status: (data?.student_status as StudentStatus | null) ?? null,
    journey_stage: (data?.journey_stage as JourneyStage | null) ?? null,
    preferred_countries: ((data?.preferred_countries as string[] | null) ?? []).filter(Boolean),
    target_majors: ((data?.target_majors as string[] | null) ?? []).filter(Boolean),
    graduation_year: (data?.graduation_year as number | null) ?? null,
    onboarding_completed_at: (data?.onboarding_completed_at as string | null) ?? null,
  };

  return (
    <div className="min-h-svh bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b">
        <Link href="/today" className="relative h-8 w-24" aria-label="CAAT home">
          <Image src="/logo.png" alt="CAAT" fill className="object-contain object-left" priority />
        </Link>
        <SkipOnboardingLink />
      </header>
      <main className="flex-1 flex justify-center px-6 py-10">
        <WelcomeFlow initial={initial} />
      </main>
    </div>
  );
}
