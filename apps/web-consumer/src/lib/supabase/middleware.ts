import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import {
  isSurface,
  resolveSurface,
  SURFACE_COOKIE,
  type Surface,
} from "@/lib/surface";

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
// under app/(shell) — which is all of these plus /search, /place, /discover
// and /pay — is walled by that layout's own getUser() check. Listing the
// personal-data routes here just means we redirect at the edge instead of
// paying for an SSR render first.
//
// So there is no anonymous browsing: a shared /place/<id> link is a sign-in
// wall, on /web as on /mob. MESITA-2066 opened /web on anonymous sessions;
// MESITA-2137 closed it again (production has anonymous sign-ins off).
//
// Legacy addresses (consumer-route-contract.ts › `legacy`) are NOT listed:
// next.config.ts redirects() 308s them to their canonical destination BEFORE
// middleware runs, and the destination is walled here.

const PROTECTED_PREFIXES = [
  // Still gated although it only 308s to /me (MESITA-1626): middleware runs
  // before the redirect, so gating here keeps a logged-out visitor's `next`
  // param pointing at what they asked for instead of at Me.
  "/inbox",
  "/me",
  // The Pay tab — one page, the Soon state (MESITA-2087). A guest's tab, so
  // it gets the same fast path as Me.
  "/pay",
  // Saved's old tab address and the Bookings tab before it; both forward
  // under Me (MESITA-2521, MESITA-2561).
  "/saved",
  "/bookings",
  "/reservations",
  "/reservation",
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
  const browserPath = request.nextUrl.pathname;
  const cookieSurface = request.cookies.get(SURFACE_COOKIE)?.value;
  const surfaceDecision = resolveSurface(
    browserPath,
    isSurface(cookieSurface) ? cookieSurface : null,
  );

  if (surfaceDecision.kind === "redirect") {
    const dest = request.nextUrl.clone();
    dest.pathname = surfaceDecision.pathname;
    const redirected = NextResponse.redirect(dest);
    redirected.cookies.set(SURFACE_COOKIE, surfaceDecision.surface, {
      path: "/",
      sameSite: "lax",
    });
    return redirected;
  }

  // Gate and render against the bare route. The browser keeps /mob or /web.
  const pathname =
    surfaceDecision.kind === "rewrite" ? surfaceDecision.bare : browserPath;
  const surface: Surface | null =
    surfaceDecision.kind === "rewrite" ? surfaceDecision.surface : null;

  function nextWithPathname(req: NextRequest = request) {
    const requestHeaders = new Headers(req.headers);
    // What the guest typed, surface included, so ?next= survives sign-in.
    requestHeaders.set("x-pathname", browserPath);
    requestHeaders.set("x-bare-pathname", pathname);
    if (surface) requestHeaders.set("x-surface", surface);
    // Server Components can't read the query string of their own request.
    // The (shell) layout needs it to build a `?next=` that survives sign-in
    // with its params intact (a shared /place/<id>?ref=ig link is worthless
    // if the ref dies at the auth wall).
    requestHeaders.set("x-search", request.nextUrl.search);
    if (surfaceDecision.kind === "rewrite") {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = pathname;
      const rewritten = NextResponse.rewrite(rewriteUrl, {
        request: { headers: requestHeaders },
      });
      rewritten.cookies.set(SURFACE_COOKIE, surfaceDecision.surface, {
        path: "/",
        sameSite: "lax",
      });
      return rewritten;
    }
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

  // NO ANONYMOUS SESSIONS (Pato, MESITA-2137: "there are no anonymous
  // sign-ins. should not now"). /web and /mob sign in the same way, by phone,
  // so both get the same wall. An anonymous session left over from the
  // MESITA-2066 era is a session, not an account, and counts as signed out.
  const registered = user !== null && !user.is_anonymous;

  // Every early return below is a NEW response. Carry whatever setAll wrote
  // (a refreshed token) onto it, or the redirect silently logs the guest out.
  function redirectKeepingSession(dest: URL) {
    const redirected = NextResponse.redirect(dest);
    for (const cookie of response.cookies.getAll()) {
      redirected.cookies.set(cookie);
    }
    return redirected;
  }

  // Signed-out wall (phone OTP), on both surfaces and the bare paths.
  if (shouldGate(pathname) && !registered) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = surface ? `/${surface}` : "/";
    signInUrl.search = `?next=${encodeURIComponent(
      browserPath + request.nextUrl.search,
    )}`;
    return redirectKeepingSession(signInUrl);
  }

  // Already-signed-in bounce. We keep the user's own `?next=` intact so a
  // deep link that forced a sign-in still lands at the original target.
  if (registered && SIGNED_IN_BOUNCE.has(pathname)) {
    const bounce = request.nextUrl.clone();
    bounce.pathname = surface
      ? `/${surface}/auth/post-signin`
      : "/auth/post-signin";
    const incomingNext = request.nextUrl.searchParams.get("next");
    const safeNext =
      incomingNext &&
      incomingNext.startsWith("/") &&
      !incomingNext.startsWith("//")
        ? incomingNext
        : null;
    bounce.search = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";
    return redirectKeepingSession(bounce);
  }

  return response;
}
