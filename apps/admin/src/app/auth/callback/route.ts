import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Magic-link redirect target. Supabase Auth bounces the user here with
// ?code=<one-time> after they click the email link. We exchange the
// code for a session cookie, then forward to `next` (default /). The
// middleware then handles the admin-role gate on the next request — if
// the user isn't an admin, it'll sign them out and bounce to
// /login?error=not_admin.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession:", error);
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
