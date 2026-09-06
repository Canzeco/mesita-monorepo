import { useMemo, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Reads NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
// Throws at call time (not module load) so the build can collect page data
// even when env vars aren't injected into the build environment.
function createBrowserSupabase() {
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

/**
 * Lazy variant for a component that only NEEDS a client on interaction
 * (an onClick tracking call, not a data fetch the render depends on):
 * construction is deferred to the first call, so a render — including a
 * server render or a unit test's renderToStaticMarkup — never touches
 * env vars it doesn't have. `useBrowserSupabase` stays the right choice
 * for anything the render itself reads from Supabase.
 */
export function useLazyBrowserSupabase(): () => SupabaseClient<Database> {
  const ref = useRef<SupabaseClient<Database> | null>(null);
  return () => {
    if (!ref.current) ref.current = createBrowserSupabase();
    return ref.current;
  };
}
