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
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { authSignInWithEmail, authSignUpWithEmail } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

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

  return (
    <AuthShell>
      <AuthCard
        title="Mesita for business"
        subtitle="Sign in to manage a place."
      >
        <AuthTabs
          next={next}
          initialMode={mode}
          signInAction={authSignInWithEmail.bind(null, next)}
          signUpAction={authSignUpWithEmail.bind(null, next)}
        />
      </AuthCard>
    </AuthShell>
  );
}
