import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

// Routing rules. Two passes:
//
// 1. "Signed-out wall" — any path that requires a user. If the request
//    arrives without a session, we redirect to / (the auth surface) and
//    pass a `?next=` so the post-signin router lands them back here.
//
// 2. "Already-signed-in bounce" — / hosts the auth surface; signed-in
//    visitors should not see it. We bounce them through
//    /auth/post-signin, which forwards to the place catalog.
//
// There is no onboarded-vs-not check anywhere any more: you sign in, you
// pick a place, you manage it.

export const PROTECTED_PREFIXES = [
  // `/add` is NOT here any more (MESITA-1664): the route is a bare redirect
  // to /places now, reads nothing and renders nothing, and /places carries
  // the wall. Gating a redirect would only bounce a signed-out visitor
  // through sign-in to reach a page that immediately sends them somewhere
  // gated anyway.
  // `/place` and `/settings` are NOT here any more (MESITA-1564): those routes
  // are deleted, and next.config.ts redirects them before a request ever
  // reaches this proxy. Gating a path that cannot resolve implies a screen
  // that no longer exists.
  // Every console screen reads real data through business-web EFs now, so
  // all four are behind the signed-out wall. Nothing in the shell is mock
  // any more.
  //
  // Organization is listed for the first time (MESITA-1727). It could not be
  // before: its address was `/`, and these are PREFIX matches, so listing `/`
  // would have gated every route in the app including /signin. Now that the
  // screen has a name, it gets the same edge check as its siblings — which is
  // what made the sentence above true rather than aspirational.
  //
  // `/` itself stays OUT, and stays out deliberately: it is a redirect that
  // reads nothing and renders nothing, and its destination is walled. Same
  // reasoning as `/add`.
  "/organization",
  "/places",
  "/account",
];

// Routes where a signed-in visitor should be bounced through
// /auth/post-signin. `/` is inside the console shell, so the auth surface
// lives at /signin and the bounce follows it there. A signed-in visitor
// never needs to see sign-in.
const SIGNED_IN_BOUNCE = new Set<string>(["/signin"]);
export { SIGNED_IN_BOUNCE };

export function shouldGate(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Refreshes Supabase auth cookies on every request. Env vars are read at
// call time (not module load) so middleware code is import-safe during the
// build's page-data collection.
export async function updateSupabaseSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    // Don't kill the request just because env vars aren't injected (e.g. on
    // a preview build that hasn't been wired up yet). Pass it through; the
    // auth-dependent pages will surface a clear error themselves.
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, publishableKey, {
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

  // Touch the user record so the SSR client refreshes the access token cookie
  // when it's near expiry. Per Supabase SSR docs: do NOT add code between
  // createServerClient() and getUser() — random logouts otherwise.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Signed-out wall.
  if (shouldGate(pathname) && !user) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/signin";
    signInUrl.search = `?next=${encodeURIComponent(
      pathname + request.nextUrl.search,
    )}`;
    return NextResponse.redirect(signInUrl);
  }

  // Already-signed-in bounce. Keep the user's own `?next=` intact so a
  // deep link that forced a sign-in still lands at the original target.
  if (user && SIGNED_IN_BOUNCE.has(pathname)) {
    const bounce = request.nextUrl.clone();
    bounce.pathname = "/auth/post-signin";
    const incomingNext = request.nextUrl.searchParams.get("next");
    const safeNext =
      incomingNext &&
      incomingNext.startsWith("/") &&
      !incomingNext.startsWith("//")
        ? incomingNext
        : null;
    bounce.search = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";
    return NextResponse.redirect(bounce);
  }

  return response;
}
