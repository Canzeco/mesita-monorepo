import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/guest/MobileFrame";
import { StatusBar } from "@/components/guest/StatusBar";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { createServerSupabase } from "@/lib/supabase/server";

// Phone-OTP collapses sign-in and sign-up into one flow: the first verify
// creates the user, every subsequent verify signs them in. This route
// stays for backwards compatibility with bookmarks + the landing CTA but
// renders the same form as /sign-in.
export const dynamic = "force-dynamic";

const GUEST_AFTER_SIGNUP = "/auth/post-signin";

export default async function GuestSignUpPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(GUEST_AFTER_SIGNUP);

  return (
    <MobileFrame>
      <StatusBar />
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pt-6 pb-8">
        <div className="mb-6">
          <div className="bg-peacock shadow-glow mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-xl">
            🦚
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Create your account
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Your phone is your account. We&apos;ll text you a 6-digit code.
          </p>
        </div>

        <PhoneOtpForm redirectAfter={GUEST_AFTER_SIGNUP} />
      </div>
    </MobileFrame>
  );
}
