import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { EnterpriseAuthLayout } from "@/components/auth/EnterpriseAuthLayout";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { cn } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";

// Root of the admin subdomain. Strong routing contract:
//
//   no session → render auth (Google sign-in)
//   session    → /central ((app) layout runs the super_admins allowlist;
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
  if (user) redirect("/central");

  const params = await searchParams;
  const errorMessage = params.error ? ERROR_COPY[params.error] : null;

  return (
    <EnterpriseAuthLayout
      title="Admin"
      subtitle="Sign in with your Google account. Only allowlisted operators can perform admin actions — everyone else lands on a polite empty state."
      chip={
        errorMessage ? (
          <p className={cn(ERROR_BOX_CLASS, "mt-3 leading-relaxed")}>
            {errorMessage}
          </p>
        ) : null
      }
    >
      <GoogleSignInButton />
    </EnterpriseAuthLayout>
  );
}
