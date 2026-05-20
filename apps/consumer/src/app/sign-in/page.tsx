import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/guest/MobileFrame";
import { StatusBar } from "@/components/guest/StatusBar";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Phone is the identity. /auth/post-signin then routes the freshly-authed
// user to /onboard or /discover/swipe based on profile state.
const GUEST_AFTER_AUTH = "/auth/post-signin";

function safeNext(raw: string | undefined): string {
  if (!raw) return GUEST_AFTER_AUTH;
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : GUEST_AFTER_AUTH;
}

export default async function GuestSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const next = safeNext((await searchParams).next);
  if (user) redirect(next);

  return (
    <MobileFrame>
      <StatusBar />
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pt-6 pb-8">
        <div className="mb-6">
          <div className="bg-peacock shadow-glow mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-xl">
            🦚
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Sign in with your phone
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            We&apos;ll text you a one-time code. No password, no email.
          </p>
        </div>

        <PhoneOtpForm redirectAfter={next} />
      </div>
    </MobileFrame>
  );
}
