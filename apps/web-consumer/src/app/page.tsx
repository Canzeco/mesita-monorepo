import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { EnterpriseAuthLayout } from "@/components/auth/EnterpriseAuthLayout";
import { consumerAuthDestination, payPlaceFromNext } from "@/lib/auth-redirect";
import { apiGetPayPlaceName } from "@/lib/api/auth";

// Root of the consumer subdomain. Strong routing contract:
//
//   no session              → render auth (this page)
//   session + verify        → /auth/post-signin (?next= deep link)
//   post-signin             → /onboard or ?next= target
//
// Phone OTP collapses sign-in and create-account into one flow.

export const dynamic = "force-dynamic";

export default async function ConsumerRootPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
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

  return (
    <EnterpriseAuthLayout
      title={payPlaceName ? `Sign in to pay at ${payPlaceName}` : "Sign in with your phone"}
      subtitle="We'll text you a one-time code."
      footer={
        <>
          By continuing you agree to Mesita&apos;s terms of service and privacy
          policy.
        </>
      }
    >
      <PhoneOtpForm redirectAfter={afterAuth} />
    </EnterpriseAuthLayout>
  );
}
