import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Ends a session the Business app does not take (a phone sign-in left in the
// browser; MESITA-3105) and sends the visitor back to the Google button with
// the reason.
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  const reason = searchParams.get("error") === "google_only" ? "?error=google_only" : "";
  return NextResponse.redirect(`${origin}/${reason}`);
}
