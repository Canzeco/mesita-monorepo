import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { EnterpriseAuthLayout } from "@/components/auth/EnterpriseAuthLayout";
import { consumerAuthDestination } from "@/lib/auth-redirect";

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

  return (
    <EnterpriseAuthLayout
      title="Sign in with your phone"
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
