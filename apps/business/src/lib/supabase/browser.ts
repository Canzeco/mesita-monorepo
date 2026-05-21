import { useMemo } from "react";
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

// Hook wrapper — memoizes the client per component instance so renders
// don't churn a new SSR client every time. Centralises the `useMemo`
// dance every client form was repeating by hand.
export function useBrowserSupabase() {
  return useMemo(() => createBrowserSupabase(), []);
}
