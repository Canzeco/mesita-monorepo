import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { SignInOptions } from "@/components/auth/SignInOptions";
import { isInAppBrowser } from "@/lib/in-app-browser";
import { CoverAuthLayout } from "@/components/auth/CoverAuthLayout";
import { consumerAuthDestination, payPlaceFromNext } from "@/lib/auth-redirect";
import { apiGetPayPlaceName } from "@/lib/api/auth";

// Root of the consumer subdomain. Strong routing contract:
//
//   no session              → render auth (this page)
//   session + verify        → /auth/post-signin (?next= deep link)
//   post-signin             → /onboard or ?next= target
//
// A code (phone or email) or Continue with Google collapses sign-in and
// create-account into one flow (MESITA-3777).

export const dynamic = "force-dynamic";

export default async function ConsumerRootPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const afterAuth = consumerAuthDestination(params.next);

  if (user) {
    redirect(afterAuth);
  }

  // The Pay QR door (MESITA-3526): a table QR's `/pay?place=<id>` names the
  // place. A failed or empty read keeps the plain title; sign-in never waits
  // on it to work.
  const payPlaceId = payPlaceFromNext(params.next);
  const payPlaceName = payPlaceId
    ? await apiGetPayPlaceName(supabase, payPlaceId).catch(() => null)
    : null;

  const showGoogle = !isInAppBrowser((await headers()).get("user-agent"));
  const showEmail = process.env.NEXT_PUBLIC_EMAIL_SIGNIN === "on";

  return (
    <CoverAuthLayout
      headline={payPlaceName ? `Pay at ${payPlaceName}` : "Every table in Monterrey"}
      title={payPlaceName ? `Sign in to pay at ${payPlaceName}` : undefined}
      subtitle={
        showGoogle
          ? "Continue with Google, or get a one-time code."
          : "We'll send you a one-time code."
      }
      openWith={params.error === "oauth_failed" ? "login" : undefined}
      notice={
        params.error === "oauth_failed"
          ? "Google didn't finish signing you in. Try again, or use a code."
          : undefined
      }
      footer={
        <>
          By continuing you agree to Mesita&apos;s terms of service and privacy
          policy.
        </>
      }
    >
      <SignInOptions
        redirectAfter={afterAuth}
        next={params.next}
        showGoogle={showGoogle}
        showEmail={showEmail}
      />
    </CoverAuthLayout>
  );
}
