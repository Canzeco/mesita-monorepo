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

// ── The identity, forwarded once ──────────────────────────────────────────
//
// `auth.getUser()` is a NETWORK CALL, not a cookie read: GoTrueClient hits
// /auth/v1/user to validate the JWT and memoizes nothing. 114ms warm p50,
// ~190ms on a fresh connection, measured against production (MESITA-1731).
//
// The proxy already pays it on every request the matcher covers, and then the
// render paid it again — MESITA-1729 collapsed the render's own three into one
// via a request-cached `getServerUser`, but that cache cannot reach across the
// proxy/render boundary, so the answer the proxy already had was thrown away
// and bought a second time.
//
// So the proxy hands it forward. `NextResponse.next({ request: { headers } })`
// rewrites the request as the RENDER sees it, for this request only.
export const USER_ID_HEADER = "x-mesita-user-id";
export const USER_EMAIL_HEADER = "x-mesita-user-email";
const IDENTITY_HEADER_PREFIX = "x-mesita-";

/**
 * The headers to forward: every inbound `x-mesita-*` dropped, then this
 * request's resolved identity written back.
 *
 * THE STRIP IS THE LOAD-BEARING HALF. Downstream code trusts these headers
 * precisely because the proxy is the only thing that can set them — and a
 * browser can put any header it likes on a request. Without the strip, a
 * signed-out visitor sending `x-mesita-user-id: <someone else>` would be read
 * as that person by every page that skips revalidation. `Headers` lookup is
 * case-insensitive per the fetch spec, so `X-Mesita-User-Id` is deleted by
 * the same pass.
 */
export function forwardedIdentityHeaders(
  inbound: Headers,
  user: { id: string; email?: string | null } | null,
): Headers {
  const headers = new Headers(inbound);
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith(IDENTITY_HEADER_PREFIX)) headers.delete(name);
  }
  if (user) {
    headers.set(USER_ID_HEADER, user.id);
    // Absent, not empty: an empty header and a user with no email address are
    // different facts, and `?? "—"` downstream should see the second one.
    if (user.email) headers.set(USER_EMAIL_HEADER, user.email);
  }
  return headers;
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

  // The refreshed session cookies, ACCUMULATED rather than written onto a
  // response as they arrive. The response cannot be built until `getUser()`
  // has answered, because the identity it resolves goes into the forwarded
  // request headers — and rebuilding a NextResponse discards the cookies
  // already set on the old one, which is precisely the "random logouts" the
  // SSR docs warn about. So: collect here, build once, below.
  let refreshedCookies: Parameters<
    NonNullable<Parameters<typeof createServerClient>[2]["cookies"]["setAll"]>
  >[0] = [];

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // The request's own jar is updated in place so anything reading
        // cookies later in THIS request sees the refreshed values.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        refreshedCookies = [...refreshedCookies, ...cookiesToSet];
      },
    },
  });

  // Touch the user record so the SSR client refreshes the access token cookie
  // when it's near expiry. Per Supabase SSR docs: do NOT add code between
  // createServerClient() and getUser() — random logouts otherwise.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /** Attaches the refreshed session cookies to whatever we answer with. A
   *  redirect needs them as much as a pass-through: without them a request
   *  that arrived on a near-expired token would refresh it, throw the new one
   *  away, and do it all again on the next navigation. */
  const withRefreshedCookies = <T extends NextResponse>(res: T): T => {
    for (const { name, value, options } of refreshedCookies) {
      res.cookies.set(name, value, options);
    }
    return res;
  };

  // Built here, not at the top: this is the request the RENDER will see, and
  // it carries the identity so nothing downstream has to buy it again. Adding
  // it here keeps the SSR rule intact — nothing moved between
  // createServerClient() and getUser().
  const response = withRefreshedCookies(
    NextResponse.next({
      request: { headers: forwardedIdentityHeaders(request.headers, user) },
    }),
  );

  const pathname = request.nextUrl.pathname;

  // Signed-out wall.
  if (shouldGate(pathname) && !user) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/signin";
    signInUrl.search = `?next=${encodeURIComponent(
      pathname + request.nextUrl.search,
    )}`;
    return withRefreshedCookies(NextResponse.redirect(signInUrl));
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
    return withRefreshedCookies(NextResponse.redirect(bounce));
  }

  return response;
}
