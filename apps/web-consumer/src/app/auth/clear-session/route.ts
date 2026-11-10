import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeNextPath, withNext } from "@/lib/auth-redirect";
import { isTransientAuthError } from "@/lib/stale-session";

// MESITA-3590: clears a session cookie whose user no longer exists, then
// lands on `/` (the phone sign-in) keeping `next`. See lib/stale-session.ts.
//
// It signs out ONLY when Auth says the session names no user, so a link to
// this route cannot sign a live guest out: a live user is sent straight on
// through post-signin instead. A transient Auth failure clears nothing.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (user) redirect(withNext("/auth/post-signin", next));

  if (!isTransientAuthError(error)) {
    // scope "local": this browser only. For a deleted user Auth answers the
    // logout call with 403/404, which auth-js ignores before it removes the
    // session — so the cookies are cleared either way.
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect(withNext("/", next));
}
