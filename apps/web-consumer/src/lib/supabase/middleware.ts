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
//    /auth/post-signin which forwards to onboard or the app depending
//    on whether the profile is complete.
//
// The onboarded-vs-not check is intentionally NOT in middleware — that
// requires an Edge Function call per request, which is too expensive.
// Onboard pages and dashboards each do their own server-side check.
//
// PROTECTED_PREFIXES is a fast path, NOT the security boundary. Every route
// under app/(shell) — which is all of these plus /search, /place,
// /share, /filters — is walled by that layout's own getUser()
// check. Listing the personal-data routes here just means we redirect at
// the edge instead of paying for an SSR render first.
//
// So there is no anonymous browsing today: a shared /place/<id> link is a
// sign-in wall. An earlier version of this comment claimed the opposite
// ("deliberately public so anonymous visitors can swipe before signing
// up"), which was aspirational, not true. Opening that up is a product
// decision — it means exempting the browse routes in the (shell) layout,
// not editing this list.
//
// Legacy static paths (/pay, /qr, /profile, /notifications, /ticket, /invite)
// are NOT listed: next.config.ts redirects() 308s them to their canonical
// destination BEFORE middleware runs, and the destination is walled here.

const PROTECTED_PREFIXES = [
  "/me",
  "/new-visit",
  "/visit",
  "/reservations",
  "/reservation",
  "/inbox",
];

// Routes where a signed-in visitor should be bounced through post-signin.
// Only `/` now — the legacy /sign-in and /sign-up redirect routes were
// removed once external callers (landing page) were updated to `/`.
const SIGNED_IN_BOUNCE = new Set(["/"]);

// Exported for the route-contract test suite (gate matrix).
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
  const pathname = request.nextUrl.pathname;

  function nextWithPathname(req: NextRequest = request) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", pathname);
    // Server Components can't read the query string of their own request.
    // The (shell) layout needs it to build a `?next=` that survives sign-in
    // with its params intact (a shared /place/<id>?ref=ig link is worthless
    // if the ref dies at the auth wall).
    requestHeaders.set("x-search", request.nextUrl.search);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!url || !publishableKey) {
    // Don't kill the request just because env vars aren't injected (e.g. on
    // a preview build that hasn't been wired up yet). Pass it through; the
    // auth-dependent pages will surface a clear error themselves.
    return nextWithPathname();
  }

  let response = nextWithPathname();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = nextWithPathname(request);
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

  // Signed-out wall.
  if (shouldGate(pathname) && !user) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/";
    signInUrl.search = `?next=${encodeURIComponent(
      pathname + request.nextUrl.search,
    )}`;
    return NextResponse.redirect(signInUrl);
  }

  // Already-signed-in bounce. We keep the user's own `?next=` intact so a
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
