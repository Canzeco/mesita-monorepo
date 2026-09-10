import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "./database.types";

// Reads NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY at
// call time (not module load) so that Next's build-time page-data collection
// pass doesn't crash when env vars aren't injected.
//
// REQUEST-CACHED (MESITA-1729). Every server component that needed Supabase
// used to build its own client, and each one bound a fresh cookie adapter for
// the same request. One client per request is both cheaper and the thing that
// makes `getServerUser` below able to dedupe at all. Same `cache()` idiom
// lib/place-view.ts already uses for the two place loaders.
export const createServerSupabase = cache(async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Set both in the Vercel project (Settings → Environment Variables) and in .env.local.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Set may throw inside a Server Component (cookie writes need a Server
        // Action or Route Handler). Swallow the throw — session refresh still
        // succeeds; the middleware/route handler will write the new cookies.
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
});

/** The signed-in user, once per request.
 *
 *  `auth.getUser()` is NOT a cookie read: supabase-ssr calls /auth/v1/user to
 *  validate the JWT, which is a network round trip. The console was paying it
 *  three times for one navigation — middleware, the shell layout, and then the
 *  place layout or leaf page — and the second and third always answered what
 *  the first already knew (MESITA-1729).
 *
 *  Middleware runs in its own context and cannot share this cache, so that one
 *  stays. Everything inside a render now collapses to a single call. */
export const getServerUser = cache(async () => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
