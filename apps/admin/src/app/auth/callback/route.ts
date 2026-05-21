import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// OAuth redirect target. Google bounces back here with `?code=…`; we
// exchange it for a Supabase session cookie, then land the operator on
// the admin shell. The (app) layout runs the super_admins allowlist
// check and either renders the surface or the "not authorised" state.
//
// On failure we send the user back to /login with an error flag.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
    console.error("[admin auth/callback] exchangeCodeForSession:", error);
  }

  return NextResponse.redirect(`${origin}/?error=oauth_failed`);
}
