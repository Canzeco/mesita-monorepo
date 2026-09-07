// The auth surface. It used to live at `/`; the console shell took that
// route in #1485, so sign-in got its own address. The routing contract:
//
//   no session              → /signin (this page)
//   session                 → /places (pick any place to manage)
//
// Both Sign in and Create account live here behind the AuthTabs toggle;
// ?mode=signup deep-links to the create variant.
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { EnterpriseAuthLayout } from "@/components/auth/EnterpriseAuthLayout";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { authSignInWithEmail, authSignUpWithEmail } from "@/app/auth/actions";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";

export const dynamic = "force-dynamic";

// Mirrors web-admin's page.tsx ERROR_COPY pattern. auth/callback/route.ts
// redirects a failed Google sign-in straight here (not through `/`, which
// would drop the query string via the (shell) layout's unauthenticated
// redirect) so this is read reliably.
const ERROR_COPY: Record<string, string> = {
  oauth_failed:
    "Google sign-in failed. Try again, or use email/password instead.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/places");

  const nextRaw = typeof sp.next === "string" ? sp.next : null;
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : "/places";
  const mode = sp.mode === "signup" ? "signup" : "signin";
  const errorParam = typeof sp.error === "string" ? sp.error : null;
  const errorMessage = errorParam ? ERROR_COPY[errorParam] : null;

  return (
    <EnterpriseAuthLayout
      title="Mesita for business"
      subtitle="Sign in to manage a place."
      chip={
        errorMessage ? (
          <p className={`${ERROR_BOX_CLASS} mt-3 leading-relaxed`}>
            {errorMessage}
          </p>
        ) : null
      }
    >
      <AuthTabs
        next={next}
        initialMode={mode}
        signInAction={authSignInWithEmail.bind(null, next)}
        signUpAction={authSignUpWithEmail.bind(null, next)}
      />
    </EnterpriseAuthLayout>
  );
}
