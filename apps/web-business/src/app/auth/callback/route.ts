import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// OAuth redirect target. Google bounces back here with `?code=…`; we
// exchange it for a Supabase session cookie, then land the operator on
// post-signin, which routes to the place or the claim (MESITA-3103).
//
//
// On failure we send the user back to / with an error flag.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/auth/post-signin`);
    }
    console.error("[business auth/callback] exchangeCodeForSession:", error);
  }

  return NextResponse.redirect(`${origin}/?error=oauth_failed`);
}
