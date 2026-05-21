import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { EnterpriseAuthLayout } from "@/components/auth/EnterpriseAuthLayout";

// Root of the guest subdomain. Strong routing contract:
//
//   no session              → render auth (this page)
//   session + no profile    → /onboard
//   session + onboarded     → /discover/swipe   (the actual app)
//
// Phone OTP collapses sign-in and create-account into one flow — the
// first verify creates the user, every subsequent verify signs them in.

export const dynamic = "force-dynamic";

const GUEST_AFTER_AUTH = "/auth/post-signin";

function safeNext(raw: string | undefined): string {
  if (!raw) return GUEST_AFTER_AUTH;
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : GUEST_AFTER_AUTH;
}

export default async function GuestRootPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed in — never render auth. The post-signin router handles the
  // profile / onboarded fork.
  if (user) {
    redirect(safeNext(params.next));
  }

  const next = safeNext(params.next);

  return (
    <EnterpriseAuthLayout
      title="Sign in with your phone"
      subtitle="We'll text you a one-time code. No password, no email."
      footer={
        <>
          By continuing you agree to Mesita&apos;s terms of service and privacy
          policy.
        </>
      }
    >
      <PhoneOtpForm redirectAfter={next} />
    </EnterpriseAuthLayout>
  );
}
