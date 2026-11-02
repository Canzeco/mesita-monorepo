import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

// Browser Supabase client. Picks up session from cookies set by the
// server-side flow. Reads env at call time.
export function createBrowserSupabase() {
  const { url, publishableKey } = requireSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}

