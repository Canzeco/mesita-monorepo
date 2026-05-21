import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { authSignInWithEmail } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { AuthCard, AuthShell, SignedInChip } from "@/components/auth/AuthShell";

export const dynamic = "force-dynamic";

const MANAGER_AFTER_AUTH = "/auth/post-signin";

function safeNext(raw: string | undefined): string {
  if (!raw) return MANAGER_AFTER_AUTH;
  return raw.startsWith("/") && !raw.startsWith("//")
    ? raw
    : MANAGER_AFTER_AUTH;
}

export default async function ManagerSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;
  const next = safeNext(params.next);
  if (user) redirect(next);

  const action = authSignInWithEmail.bind(null, next);

  return (
    <AuthShell>
      <AuthCard
        title="Manager sign in"
        subtitle="Guest accounts use the phone sign-in instead."
        chip={
          params.error === "oauth_failed" ? (
            <SignedInChip tone="error">
              That sign-in didn&apos;t go through. Try again, or use email below.
            </SignedInChip>
          ) : null
        }
      >
        <OAuthButtons next={next} />

        <div className="my-5 flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
            or
          </span>
          <span className="bg-border h-px flex-1" />
        </div>

        <EmailAuthForm
          action={action}
          submitLabel="Sign in with email"
          passwordAutoComplete="current-password"
          minPassword={1}
        />

        <p className="text-muted-foreground mt-6 text-center text-[12.5px]">
          New partner?{" "}
          <Link
            href="/sign-up"
            className="text-foreground font-semibold hover:underline"
          >
            Create an account
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
