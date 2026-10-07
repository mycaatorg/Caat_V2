import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { TodayView } from "@/components/today/TodayView";
import { createServerClient } from "@/lib/supabase/server";
import { loadToday, sydneyHour } from "@/lib/today-data";
import { chooseNextStep, comingUp, deriveTasks } from "@/lib/today";

export const metadata = { title: "Today" };

// PROD-74: the student's home. Everything is resolved on the server in one
// parallel round so the page paints complete, with no client waterfall.
export default async function TodayPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/today");

  const data = await loadToday(supabase, user.id);
  const tasks = deriveTasks(data.input);
  const name =
    data.firstName ||
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    user.email?.split("@")[0] ||
    null;

  return (
    <>
      <PageHeader title="Today" />
      <TodayView
        name={name}
        hour={sydneyHour()}
        todayISO={data.input.todayISO}
        nextStep={chooseNextStep(data.input, tasks)}
        tasks={tasks}
        comingUp={comingUp(data.input)}
        recent={data.recent}
        todos={data.todos}
        saved={data.input.saved}
        savedPreview={data.savedPreview}
        showOnboardingNudge={
          !data.input.onboarding.completed && !data.input.onboarding.dismissed && !data.input.onboarding.hasBasics
        }
      />
    </>
  );
}
