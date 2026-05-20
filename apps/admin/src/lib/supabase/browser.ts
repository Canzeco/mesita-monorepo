import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Used by client components (e.g. the magic
// link sender on /login) to call supabase.auth.* from the user's browser.
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
