import { createServerClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";
import { cookies } from "next/headers";

// Server-side Supabase client. Reads env at call time so the build's
// page-data pass doesn't crash when vars aren't injected.
export async function createServerSupabase() {
  const { url, publishableKey } = requireSupabaseEnv();

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Components can't write cookies — swallow the throw;
        // middleware refreshes them on the next request anyway.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // intentionally empty
        }
      },
    },
  });
}
