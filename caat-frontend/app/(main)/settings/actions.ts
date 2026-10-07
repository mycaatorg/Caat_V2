"use server";

import { createServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createServerClient>>;

// Buckets holding a student's own files, each under a `<user id>/` folder.
const USER_BUCKETS = ["user-documents", "profile-avatars"] as const;

/** Every object path under `folder`, walking subfolders (list is one level). */
async function listAll(supabase: Supabase, bucket: string, folder: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
  if (error) throw new Error(`list ${bucket}`);
  const paths: string[] = [];
  for (const entry of data ?? []) {
    const path = `${folder}/${entry.name}`;
    // Folders come back with no id.
    if (entry.id == null) paths.push(...(await listAll(supabase, bucket, path)));
    else paths.push(path);
  }
  return paths;
}

/** Remove the student's uploaded files with their own session (storage RLS
 *  limits removal to their folder). Throws if anything could not be removed. */
async function removeOwnFiles(supabase: Supabase, userId: string): Promise<void> {
  for (const bucket of USER_BUCKETS) {
    const paths = (await listAll(supabase, bucket, userId)).filter((p) => p.startsWith(`${userId}/`));
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) throw new Error(`remove ${bucket}`);
    }
  }
}

// F5 - Account deletion. The anon/authenticated client cannot delete an auth
// user, so this calls the SECURITY DEFINER `delete_own_account()` RPC, which
// wipes every row the caller owns (scoped to auth.uid()) and removes their
// auth.users row. Uploaded files are removed first (PROD-96): if that fails the
// account is left intact so the student can retry; deleting the account first
// would leave files no session could ever remove. Then sign out.
export async function deleteMyAccount(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You are not signed in." };
  }

  try {
    await removeOwnFiles(supabase, user.id);
  } catch {
    return {
      ok: false,
      error: "Could not delete your uploaded files. Your account has not been deleted. Please try again.",
    };
  }

  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    return { ok: false, error: "Could not delete your account. Please try again." };
  }

  // The auth user is gone; clear the session cookies too. Ignore errors here
  // because the account is already deleted at this point.
  await supabase.auth.signOut();

  return { ok: true };
}
