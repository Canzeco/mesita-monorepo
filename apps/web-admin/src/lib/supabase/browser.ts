import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client. Picks up session from cookies set by the
// server-side flow. Reads env at call time.
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Set both in Vercel env and in .env.local.",
    );
  }
  return createBrowserClient(url, publishableKey);
}
