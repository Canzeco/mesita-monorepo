import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { GuestSignInButton } from "@/components/auth/GuestSignInButton";
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
      subtitle="We'll text you a one-time code — or skip it and enter as a guest."
      footer={
        <>
          By continuing you agree to Mesita&apos;s terms of service and privacy
          policy.
        </>
      }
    >
      <PhoneOtpForm redirectAfter={afterAuth} />

      <div className="my-5 flex items-center gap-3" aria-hidden>
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          or
        </span>
        <span className="bg-border h-px flex-1" />
      </div>

      <GuestSignInButton redirectAfter={afterAuth} />
    </EnterpriseAuthLayout>
  );
}
