import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import LandingPage from "@/components/landing/LandingPage";

export default async function Home() {
  // C14: the landing page is the anonymous first impression. Only pay for an
  // auth check when a Supabase auth cookie is actually present; otherwise render
  // the static landing directly without a getUser() round trip.
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  if (hasAuthCookie) {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/today");
    }
  }

  return <LandingPage />;
}
