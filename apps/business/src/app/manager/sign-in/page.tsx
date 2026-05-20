import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { authSignInWithEmail } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Manager auth is email + password — the B2B partner pool. After
// sign-in, /auth/post-signin calls manager-signin-email to stamp
// app_metadata.role + lazy-create the managers row, then routes to
// /manager/onboard or /manager/home depending on profile state.
const MANAGER_AFTER_AUTH = "/auth/post-signin?audience=manager";

function safeNext(raw: string | undefined): string {
  if (!raw) return MANAGER_AFTER_AUTH;
  return raw.startsWith("/") && !raw.startsWith("//")
    ? raw
    : MANAGER_AFTER_AUTH;
}

export default async function ManagerSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const next = safeNext((await searchParams).next);
  if (user) redirect(next);

  const action = authSignInWithEmail.bind(null, next);

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="bg-peacock shadow-glow flex h-9 w-9 items-center justify-center rounded-full text-base">
              🦚
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">
              mesita.
            </span>
          </Link>
          <h1 className="font-display mt-6 text-2xl font-semibold tracking-tight">
            Manager sign in
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Email and password. Guest accounts use the phone sign-in instead.
          </p>
        </div>

        <EmailAuthForm
          action={action}
          submitLabel="Sign in"
          passwordAutoComplete="current-password"
          minPassword={1}
        />

        <p className="text-muted-foreground mt-6 text-center text-xs">
          New partner?{" "}
          <Link
            href="/manager/sign-up"
            className="text-foreground font-semibold hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
