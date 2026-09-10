import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { Database } from "./database.types";
import { USER_EMAIL_HEADER, USER_ID_HEADER } from "./middleware";

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

/** Who this request is from — id and email, and nothing else.
 *
 *  DELIBERATELY NARROWER than Supabase's `User`. The identity now usually
 *  arrives as two proxy-set headers rather than a validated user record, and a
 *  type that promised `app_metadata` or `created_at` would be promising fields
 *  nothing forwards. Every console caller only ever reads these two plus the
 *  null check; the type is what keeps that true. */
export type ConsoleUser = { id: string; email: string | null };

/** The signed-in user, once per request — and now usually with NO network
 *  call at all.
 *
 *  `auth.getUser()` is NOT a cookie read: supabase-ssr calls /auth/v1/user to
 *  validate the JWT, which is a network round trip — 114ms warm p50, ~190ms
 *  cold, measured against production. The console was paying it three times
 *  per navigation; MESITA-1729 collapsed the render's own two into one via
 *  this cache.
 *
 *  What was left was the last duplicate, and the awkward one: the proxy had
 *  ALREADY validated this exact token milliseconds earlier, in a context no
 *  `cache()` can reach. So the proxy forwards what it resolved
 *  (`forwardedIdentityHeaders`) and this reads it — one validation per
 *  request, at the edge, where the signed-out wall needs it anyway
 *  (MESITA-1731).
 *
 *  THE HEADER IS TRUSTED BECAUSE THE PROXY STRIPS IT FIRST. `x-mesita-*` is
 *  deleted off every inbound request before the resolved identity is written
 *  back, so a header seen here can only have come from the proxy, which set
 *  it after validating the JWT.
 *
 *  The fallback is not dead code: a render the proxy's matcher skipped, or a
 *  build-time page-data pass, has no such header and must still get a real
 *  answer rather than a silent signed-out. */
export const getServerUser = cache(async (): Promise<ConsoleUser | null> => {
  const forwarded = await headers();
  const id = forwarded.get(USER_ID_HEADER);
  if (id) return { id, email: forwarded.get(USER_EMAIL_HEADER) };

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
});
