import { createClient } from "@supabase/supabase-js";

console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL); // Check browser console
console.log("Supabase Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);