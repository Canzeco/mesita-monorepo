import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookies on every request, then gates
// the admin surface on a verified admin role. /login is the only
// public surface; everything else 307s to /login when either (a) no
// session, or (b) session belongs to a non-admin.
//
// We check role via app_metadata.role === "admin". This metadata is
// server-controlled (you can only edit it from Supabase Studio / via
// the service_role key) so end users can't grant themselves admin.

const PUBLIC_PATHS = new Set(["/login"]);

export async function updateAdminSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    // Server misconfigured. Let the request through so the visitor sees
    // the friendly /login error rather than a crash.
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

  // Per Supabase SSR docs: do NOT add code between createServerClient()
  // and getUser() — random logouts otherwise.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (isPublic) {
    // If a logged-in admin lands on /login, bounce them to home.
    if (
      pathname === "/login" &&
      user &&
      user.app_metadata?.role === "admin"
    ) {
      const home = request.nextUrl.clone();
      home.pathname = "/";
      home.search = "";
      return NextResponse.redirect(home);
    }
    return response;
  }

  // Private route: need a session + admin role.
  if (!user) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/login";
    const next = pathname + request.nextUrl.search;
    signIn.search =
      pathname === "/" ? "" : `?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(signIn);
  }

  if (user.app_metadata?.role !== "admin") {
    // Signed in but not an admin. Sign them out and bounce with a
    // banner — prevents a stuck state where a real user has a session
    // but no admin privilege.
    await supabase.auth.signOut();
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/login";
    signIn.search = "?error=not_admin";
    return NextResponse.redirect(signIn);
  }

  return response;
}
