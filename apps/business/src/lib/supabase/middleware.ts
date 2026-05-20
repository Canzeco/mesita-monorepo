import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import {
  SUPER_ADMIN_HEADER,
  SUPER_ADMIN_QUERY_PARAM,
} from "@/lib/super-admin";

// Routing rules. Three passes:
//
// 1. "Super-admin mode" — any request with `?superkey=<value>` is forwarded
//    to the page with that value copied to an `x-mesita-superkey` request
//    header. Server components read the header via `getSuperAdminKey()` —
//    layouts in particular can't reach searchParams, so the indirection is
//    what makes the unit shell render for super-admin operators. The
//    signed-out wall is skipped for these requests; the EF re-validates the
//    key on every call.
//
// 2. "Signed-out wall" — any path that requires a user. If the request
//    arrives without a session, we redirect to the right sign-in page
//    and pass a `?next=` so the post-signin router lands them back here.
//
// 3. "Already-signed-in bounce" — sign-in / sign-up pages should not be
//    visited while the user is already authenticated. We bounce them
//    through /auth/post-signin which forwards to onboard or dashboard
//    depending on whether the corresponding profile has a full_name.
//
// The onboarded-vs-not check is intentionally NOT in middleware — that
// requires an Edge Function call per request, which is too expensive.
// Onboard pages and dashboards each do their own server-side check.
//
// Guest browsing (discover, venue detail, share) is deliberately public
// so anonymous visitors can swipe before signing up. /guest/profile,
// /guest/qr, /guest/saved are private because they expose personal data.

type GateRule = {
  // Path that requires auth. Match is "exact OR starts with `${prefix}/`".
  prefix: string;
  // Where to bounce signed-out users.
  signIn: string;
};

const PROTECTED_RULES: GateRule[] = [
  // Manager private surfaces — the per-unit shell and the venue creation
  // flow. Sign-in / sign-up live at /sign-in and /sign-up which are public.
  { prefix: "/unit", signIn: "/sign-in" },
  { prefix: "/onboard", signIn: "/sign-in" },
  { prefix: "/add", signIn: "/sign-in" },
];

// Within a protected prefix, these subpaths stay public.
const PUBLIC_AUTH_PATHS = new Set<string>([]);

// Sign-in / sign-up pages where a signed-in visitor should be bounced
// through post-signin.
const SIGNED_IN_BOUNCE: Record<string, "manager"> = {
  "/sign-in": "manager",
  "/sign-up": "manager",
};

function shouldGate(pathname: string): { signIn: string } | null {
  if (PUBLIC_AUTH_PATHS.has(pathname)) return null;
  for (const { prefix, signIn } of PROTECTED_RULES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return { signIn };
    }
  }
  return null;
}

// Refreshes Supabase auth cookies on every request. Env vars are read at
// call time (not module load) so middleware code is import-safe during the
// build's page-data collection.
export async function updateSupabaseSession(request: NextRequest) {
  // Super-admin shortcut: when the URL carries `?superkey=`, copy the value
  // to a request header so server components can read it via headers(), and
  // skip the rest of the auth dance — the EFs re-check the key themselves.
  const superKey = request.nextUrl.searchParams.get(SUPER_ADMIN_QUERY_PARAM);
  if (superKey && superKey.length > 0) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(SUPER_ADMIN_HEADER, superKey);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

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
  const gate = shouldGate(pathname);
  if (gate && !user) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = gate.signIn;
    signInUrl.search = `?next=${encodeURIComponent(
      pathname + request.nextUrl.search,
    )}`;
    return NextResponse.redirect(signInUrl);
  }

  // Already-signed-in bounce. We keep the user's own `?next=` intact so a
  // deep link that forced a sign-in still lands at the original target.
  if (user && pathname in SIGNED_IN_BOUNCE) {
    const audience = SIGNED_IN_BOUNCE[pathname];
    const bounce = request.nextUrl.clone();
    bounce.pathname = "/auth/post-signin";
    const incomingNext = request.nextUrl.searchParams.get("next");
    const params = new URLSearchParams({ audience });
    if (
      incomingNext &&
      incomingNext.startsWith("/") &&
      !incomingNext.startsWith("//")
    ) {
      params.set("next", incomingNext);
    }
    bounce.search = `?${params.toString()}`;
    return NextResponse.redirect(bounce);
  }

  return response;
}
