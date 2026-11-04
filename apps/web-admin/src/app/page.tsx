import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { MULTIPLE_PLACES_PARENT } from "@/app/(app)/manage-multiple/nav";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";

// Root of the admin subdomain. Strong routing contract:
//
//   no session → render auth (Google sign-in)
//   session    → Multiple Places ((app) layout runs the super_admins allowlist;
//                non-allowlisted callers land on the polite empty state)

export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  oauth_failed:
    "Google sign-in failed. Try again, or ask another admin if it keeps happening.",
};

export default async function AdminRootPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(MULTIPLE_PLACES_PARENT.href);

  const params = await searchParams;
  const errorMessage = params.error ? ERROR_COPY[params.error] : null;

  return (
    <main className="bg-hero flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="border-border bg-card shadow-elev flex w-full max-w-md flex-col gap-6 rounded-2xl border p-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <MesitaLogo className="h-7 w-auto" />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Mesita Admin</h1>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Sign in with your Google account.
            </p>
          </div>
          {errorMessage ? <p className={`${ERROR_BOX_CLASS} leading-relaxed`}>{errorMessage}</p> : null}
        </div>
        <GoogleSignInButton />
      </div>
    </main>
  );
}
