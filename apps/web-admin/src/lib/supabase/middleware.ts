import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes Supabase auth cookies on every request. Env vars are read
// at call time so middleware code stays import-safe during the build's
// page-data collection.
//
// Routing rules:
//   - `/` (the auth surface) and `/auth/*` (callback) are always public.
//   - Everything else requires a Supabase session; signed-out users
//     bounce to /. The (app) layout enforces the second check (the
//     super_admins allowlist).

const PUBLIC_PATHS = (path: string) =>
  path === "/" || path.startsWith("/auth/");

export async function updateSupabaseSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Read the session so the SSR client refreshes the cookie when it's near
  // expiry. Per Supabase SSR docs: do NOT add code between
  // createServerClient() and getClaims() — random logouts otherwise.
  //
  // getClaims, NOT getUser (MESITA-2819, as consumer did in MESITA-2784):
  // the project signs with ES256, so the JWT is verified locally against the
  // cached JWKS. getUser was a call to Supabase Auth on every request. The
  // (app) layout's getUser() + super_admins check stays the wall.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  const pathname = request.nextUrl.pathname;
  if (!PUBLIC_PATHS(pathname) && !claims) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/";
    // No `?next=` — Supabase's OAuth allow-list match includes query
    // strings, so anything added to the login URL would also need to
    // travel through Google's redirect, which only works if every
    // possible value is on the allow list. Operators always re-land
    // at /; trivial to navigate from there.
    signInUrl.search = "";
    return NextResponse.redirect(signInUrl);
  }

  return response;
}
