import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { authSignUpWithEmail } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";

export const dynamic = "force-dynamic";

const MANAGER_AFTER_SIGNUP = "/auth/post-signin";

export default async function ManagerSignUpPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(MANAGER_AFTER_SIGNUP);

  const action = authSignUpWithEmail.bind(null, MANAGER_AFTER_SIGNUP);

  return (
    <AuthShell>
      <AuthCard
        title="Become a partner"
        subtitle="Sign up with Google or email. You can add your venue right after."
      >
        <OAuthButtons next={MANAGER_AFTER_SIGNUP} />

        <div className="my-5 flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
            or
          </span>
          <span className="bg-border h-px flex-1" />
        </div>

        <EmailAuthForm
          action={action}
          submitLabel="Create account with email"
          passwordAutoComplete="new-password"
          minPassword={8}
        />

        <p className="text-muted-foreground mt-6 text-center text-[12.5px]">
          Already a partner?{" "}
          <Link
            href="/sign-in"
            className="text-foreground font-semibold hover:underline"
          >
            Sign in
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
