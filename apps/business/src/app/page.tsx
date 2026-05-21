import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiGetManagerProfile, type ManagerProfile } from "@/lib/api/manager";
import { errMsg } from "@/lib/utils";
import {
  AuthChip,
  EnterpriseAuthLayout,
} from "@/components/auth/EnterpriseAuthLayout";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { authSignInWithEmail, authSignUpWithEmail } from "@/app/auth/actions";

// Root of the manager subdomain. The strong routing contract:
//
//   no session              → render auth (this page)
//   session + no profile    → /onboard
//   session + onboarded     → /central
//
// Both Sign in and Create account modes live here behind the AuthTabs
// client toggle. ?mode=signup deep-links to the create variant.

export const dynamic = "force-dynamic";

const PUBLIC_NEXT_FALLBACK = "/auth/post-signin";

function safeNext(raw: string | undefined): string {
  if (!raw) return PUBLIC_NEXT_FALLBACK;
  return raw.startsWith("/") && !raw.startsWith("//")
    ? raw
    : PUBLIC_NEXT_FALLBACK;
}

export default async function ManagerRootPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    error?: string;
    mode?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed in — never render the auth surface. Decide where they're
  // really going.
  if (user) {
    let profile: ManagerProfile | null = null;
    try {
      profile = await apiGetManagerProfile(supabase);
    } catch (err) {
      console.error("[/] manager-get-profile:", errMsg(err, ""));
    }
    if (!profile?.full_name) redirect("/onboard");
    redirect("/central");
  }

  const next = safeNext(params.next);
  const signInAction = authSignInWithEmail.bind(null, next);
  const signUpAction = authSignUpWithEmail.bind(null, next);
  const initialMode = params.mode === "signup" ? "signup" : "signin";

  return (
    <EnterpriseAuthLayout
      title={
        initialMode === "signup"
          ? "Become a partner"
          : "Welcome to your dashboard"
      }
      subtitle={
        initialMode === "signup"
          ? "Sign up with Google or email — you can add your venue right after."
          : "Sign in to manage your venues, promos, and team."
      }
      chip={
        params.error === "oauth_failed" ? (
          <AuthChip tone="error">
            That sign-in didn&apos;t go through. Try again, or use email below.
          </AuthChip>
        ) : null
      }
    >
      <AuthTabs
        next={next}
        signInAction={signInAction}
        signUpAction={signUpAction}
        initialMode={initialMode}
      />
    </EnterpriseAuthLayout>
  );
}
