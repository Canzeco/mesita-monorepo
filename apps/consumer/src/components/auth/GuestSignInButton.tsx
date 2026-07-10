"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { Spinner } from "@/components/shared";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";

// One-tap guest entry — no registration, no OTP. Signs into the shared
// guest account (+52 0000000) seeded in the DB by seed_guest_consumer().
// The password is intentionally public: the guest is a shared throwaway
// identity, so it protects nothing — it only satisfies the password grant.
// Profile is pre-onboarded ("Guest"), so post-signin lands straight in
// the app.
const GUEST_PHONE = "+520000000";
const GUEST_PASSWORD = "mesita-guest-public";

export function GuestSignInButton({ redirectAfter }: { redirectAfter: string }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enterAsGuest = async () => {
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      phone: GUEST_PHONE,
      password: GUEST_PASSWORD,
    });
    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }
    // Force a server-side re-render so SSR pages see the new cookie —
    // same handoff PhoneOtpForm does after verify.
    router.push(redirectAfter);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => void enterAsGuest()}
        disabled={loading}
        className="border-border bg-card text-foreground hover:bg-muted flex h-12 w-full items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition disabled:opacity-60"
      >
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <>
            <UserRound className="h-4 w-4" />
            Continue as guest
          </>
        )}
      </button>
      {error && <p className={ERROR_BOX_CLASS}>{error}</p>}
    </div>
  );
}
