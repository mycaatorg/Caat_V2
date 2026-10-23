import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ShortlistView } from "@/components/shortlist/ShortlistView";
import { createServerClient } from "@/lib/supabase/server";
import { loadShortlist } from "@/lib/shortlist";

export const metadata = { title: "My shortlist" };

export default async function ShortlistPage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["tab", "page", "q", "status"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shortlist");

  let shortlist = null;
  try {
    shortlist = await loadShortlist(supabase, user.id);
  } catch {
    shortlist = null;
  }

  return (
    <>
      <PageHeader title="My shortlist" />
      <ShortlistView initial={shortlist} initialQuery={query.toString()} />
    </>
  );
}
