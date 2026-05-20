import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { authSignUpWithEmail } from "@/app/auth/actions";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MANAGER_AFTER_SIGNUP = "/auth/post-signin?audience=manager";

export default async function ManagerSignUpPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(MANAGER_AFTER_SIGNUP);

  const action = authSignUpWithEmail.bind(null, MANAGER_AFTER_SIGNUP);

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
            Become a partner
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Email and password to start. You can add your venue right after.
          </p>
        </div>

        <EmailAuthForm
          action={action}
          submitLabel="Create account"
          passwordAutoComplete="new-password"
          minPassword={8}
        />

        <p className="text-muted-foreground mt-6 text-center text-xs">
          Already a partner?{" "}
          <Link
            href="/manager/sign-in"
            className="text-foreground font-semibold hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
