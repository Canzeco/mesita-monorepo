import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { EnterpriseAuthLayout } from "@/components/auth/EnterpriseAuthLayout";
import { GoogleSignInButton } from "@/app/login/GoogleSignInButton";

// Root of the admin subdomain. Strong routing contract:
//
//   no session              → render auth (this page, Google sign-in only)
//   session                 → /central   ((app) layout does the super_admins
//                                         allowlist check before rendering)
//
// /login used to host this; it now redirects here. The (app) layout
// still handles non-allowlisted callers with the "Not authorised" empty
// state once they're past auth.

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
  if (user) redirect("/central");

  const params = await searchParams;
  const errorMessage = params.error ? ERROR_COPY[params.error] : null;

  return (
    <EnterpriseAuthLayout
      title="Admin"
      subtitle="Sign in with your Google account. Only allowlisted operators can perform admin actions — everyone else lands on a polite empty state."
      chip={
        errorMessage ? (
          <p className="bg-destructive/10 text-destructive mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed">
            {errorMessage}
          </p>
        ) : null
      }
    >
      <GoogleSignInButton />
    </EnterpriseAuthLayout>
  );
}
