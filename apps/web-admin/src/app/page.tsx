import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { EnterpriseAuthLayout } from "@/components/auth/EnterpriseAuthLayout";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";

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
      subtitle="Sign in with your Google account or your phone number. Only allowlisted operators can perform admin actions — everyone else lands on a polite empty state."
      chip={
        errorMessage ? (
          <p className="bg-destructive/10 text-destructive mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed">
            {errorMessage}
          </p>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <GoogleSignInButton />
        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            or
          </span>
          <span className="bg-border h-px flex-1" />
        </div>
        <PhoneOtpForm />
      </div>
    </EnterpriseAuthLayout>
  );
}
