import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import EssaysClient from "./client";
import { createServerClient } from "@/lib/supabase/server";
import type { EssayPrompt } from "@/components/essays/api";

// C8: resolve the global essay prompt list on the server for an instant first
// paint (the shell then seeds from it and skips the client fetch).
async function fetchEssayPromptsServer(): Promise<EssayPrompt[] | null> {
  const sb = await createServerClient();
  const { data, error } = await sb
    .from("essay_prompts")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return null;
  return (data ?? []) as EssayPrompt[];
}

export default async function EssaysPage() {
  const initialPrompts = await fetchEssayPromptsServer();
  return (
    <>
      <PageHeader title="Essays" />
      <div className="px-6 pt-3"><Link href="/workspace/writing" className="text-sm text-primary underline">Back to Writing desk</Link></div>
      <EssaysClient initialPrompts={initialPrompts} />
    </>
  );
}
