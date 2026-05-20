import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Reads NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
// Throws at call time (not module load) so the build can collect page data
// even when env vars aren't injected into the build environment.
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Set both in the Vercel project (Settings → Environment Variables) and in .env.local.",
    );
  }
  return createBrowserClient<Database>(url, publishableKey);
}
