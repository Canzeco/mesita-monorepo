import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/consumer/MobileFrame";
import { StatusBar } from "@/components/consumer/StatusBar";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { OnboardForm } from "./OnboardForm";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Consumer onboarding — server-side gated. The middleware already blocks
// signed-out users from /profile and friends, but onboard sits
// between sign-up and the actual app, so it has its own checks:
//
//   - signed out          → / (with next=/onboard)
//   - already onboarded   → /discover/swipe (don't re-collect data)
//   - signed in, no name  → render the form
export const dynamic = "force-dynamic";

export default async function ConsumerOnboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/onboard");

  // Completeness predicate is the same one the (shell) layout uses to
  // gate every authed surface — name + birthday + sex. If we only checked
  // full_name here, a partially-onboarded user would loop:
  //   onboard → discover/swipe (full_name truthy) → shell sees missing
  //   birthday/sex → bounces back to onboard. Strict here too.
  // redirect() throws NEXT_REDIRECT, so it MUST live outside the try/catch —
  // otherwise the catch swallows the redirect and logs it as an error (and
  // the already-onboarded user gets stuck on the form).
  let onboarded = false;
  try {
    const { consumer: profile } = await apiFetchConsumerProfile(supabase);
    onboarded =
      !!profile.full_name && !!profile.birthday && !!profile.sex;
  } catch (err) {
    // Profile fetch failed — render the form. The submit handler will
    // surface a real error if persistence is broken.
    console.error("[consumer/onboard] consumer-get-profile:", err);
  }
  if (onboarded) redirect(CONSUMER_ROUTES.home);

  // Phone-OTP is the consumer auth method, so the identity is usually a
  // phone; fall back to email for accounts created another way. Surfacing
  // it here lets a user who signed in as the wrong account bail out and
  // re-authenticate before committing onboarding data.
  const identity = user.phone ?? user.email ?? null;

  return (
    <MobileFrame>
      <StatusBar />
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pt-6 pb-8">
        <div className="border-border bg-card mb-6 flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
              Signed in as
            </p>
            <p className="truncate text-sm font-medium">
              {identity ?? "Your account"}
            </p>
          </div>
          <SignOutButton
            redirectTo="/"
            label="Not you?"
            className="border-border bg-background text-foreground hover:bg-muted inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition"
          />
        </div>

        <div className="mb-6">
          <div className="bg-peacock shadow-glow mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-xl">
            🦚
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Tell us about you
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            A few details to personalize Mesita.
          </p>
        </div>

        <OnboardForm />
      </div>
    </MobileFrame>
  );
}
