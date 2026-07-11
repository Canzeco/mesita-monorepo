import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// OAuth redirect target. Google / Apple bounce the user back here with
// ?code=<one-time>, we exchange it for a session cookie, then forward to
// the requested `next` (defaulting to /auth/post-signin which stamps the
// business role + handles the onboarded-vs-not branch).
//
// On failure we send the user back to the root auth surface with a
// banner — they get to retry without ending up in a half-broken state.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/auth/post-signin";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession:", error);
  }

  return NextResponse.redirect(`${origin}/?error=oauth_failed`);
}
