import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { consumerAuthDestination, oauthFailedPath } from "@/lib/auth-redirect";

// Continue with Google lands here (MESITA-3777) with `?code=` and the
// guest's `next`. The code becomes the session cookie, then post-signin
// makes the consumer row and routes to onboarding or `next`, exactly as a
// phone code does. A missing or failed code goes back to the sign-in page
// with a readable error, `next` kept.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${consumerAuthDestination(next ?? undefined)}`);
    }
    console.error("[consumer auth/callback] exchangeCodeForSession:", error.message);
  }
  return NextResponse.redirect(`${origin}${oauthFailedPath(next)}`);
}
