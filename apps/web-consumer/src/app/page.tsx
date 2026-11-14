import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { CoverAuthLayout } from "@/components/auth/CoverAuthLayout";
import { consumerAuthDestination, payPlaceFromNext } from "@/lib/auth-redirect";
import { apiGetPayPlaceName } from "@/lib/api/auth";

// Root of the consumer subdomain. Strong routing contract:
//
//   no session              → render auth (this page)
//   session + verify        → /auth/post-signin (?next= deep link)
//   post-signin             → /onboard or ?next= target
//
// A phone code collapses sign-in and create-account into one flow. Phone is
// the only way in (MESITA-3875, Pato: "Only Auth with Phone number must be
// enabled for consumers"): Continue with Google and the email code are gone.

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
    <CoverAuthLayout
      headline={
        payPlaceName ? `Pay at ${payPlaceName}` : "Every table in Monterrey"
      }
      title={payPlaceName ? `Sign in to pay at ${payPlaceName}` : undefined}
      footer={
        <>
          By continuing you agree to Mesita&apos;s terms of service and privacy
          policy. SMS rates may apply.
        </>
      }
    >
      <PhoneOtpForm redirectAfter={afterAuth} />
    </CoverAuthLayout>
  );
}
