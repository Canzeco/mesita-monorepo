import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { safeNextPath } from "@/lib/safe-next";

// The Business app's front door. Google accounts only (Pato, 2026-11-02,
// MESITA-3105): owners and Mesita staff both sign in with Google, and every
// business-web-* door refuses any other session (`google_only`).
//
//   no session → the Google button.
//   session    → /auth/post-signin, which routes to the place or the claim.
//
// `next` (a deep link, e.g. the consumer app's "Is this your business?") is
// parked in a short cookie by the edge wall, because the OAuth callback
// cannot carry it.

export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  oauth_failed: "Google sign-in failed. Try again.",
  google_only: "Mesita Business signs in with a Google account. Sign in with Google to continue.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next ? `/auth/post-signin?next=${encodeURIComponent(next)}` : "/auth/post-signin");

  const errorMessage = params.error ? ERROR_COPY[params.error] : null;

  return (
    <main className="bg-hero flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="border-border bg-card shadow-elev flex w-full max-w-md flex-col gap-6 rounded-2xl border p-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <MesitaLogo className="h-7 w-auto" />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Mesita Business</h1>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Edit your place&apos;s Mesita profile and run its Premier. Sign in with your Google account.
            </p>
          </div>
          {errorMessage ? <p className={`${ERROR_BOX_CLASS} leading-relaxed`}>{errorMessage}</p> : null}
        </div>
        <GoogleSignInButton />
      </div>
    </main>
  );
}
