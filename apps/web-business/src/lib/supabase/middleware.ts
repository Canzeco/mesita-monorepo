import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { NEXT_COOKIE } from "@/lib/safe-next";

// Refreshes Supabase auth cookies on every request. Env vars are read
// at call time so middleware code stays import-safe during the build's
// page-data collection.
//
// Routing rules:
//   - `/` (the auth surface) and `/auth/*` (callback) are always public.
//   - Everything else requires a Supabase session; signed-out visitors
//     bounce to /?next=<path> so a deep link (the consumer app's "Is this
//     your business?") survives sign-in. The (console) layout
//     is the wall; the business-web-* EFs decide every place.

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
  // (console) layout's getUser() stays the wall.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  const pathname = request.nextUrl.pathname;
  if (!PUBLIC_PATHS(pathname) && !claims) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/";
    // `next` rides the sign-in page's URL only; the Google redirect never
    // carries it (the OAuth allow-list matches query strings), the
    // sign-in page parks it in a cookie instead.
    const next = pathname + request.nextUrl.search;
    signInUrl.search = `?next=${encodeURIComponent(next)}`;
    const redirect = NextResponse.redirect(signInUrl);
    // For the Google path, which cannot carry `next` through OAuth.
    redirect.cookies.set(NEXT_COOKIE, next.slice(0, 300), { path: "/", maxAge: 900, httpOnly: true, sameSite: "lax" });
    return redirect;
  }

  return response;
}
