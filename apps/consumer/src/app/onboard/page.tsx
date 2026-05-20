import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/guest/MobileFrame";
import { StatusBar } from "@/components/guest/StatusBar";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchGuestProfile } from "@/lib/api/tickets";
import { OnboardForm } from "./OnboardForm";

// Guest onboarding — server-side gated. The middleware already blocks
// signed-out users from /profile and friends, but onboard sits
// between sign-up and the actual app, so it has its own checks:
//
//   - signed out          → /sign-in (with next=/onboard)
//   - already onboarded   → /discover/swipe (don't re-collect data)
//   - signed in, no name  → render the form
export const dynamic = "force-dynamic";

export default async function GuestOnboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/onboard");

  // Completeness predicate is the same one the (shell) layout uses to
  // gate every authed surface — name + country + birthday + sex. If we
  // only checked full_name here, a partially-onboarded user would loop:
  //   onboard → discover/swipe (full_name truthy) → shell sees missing
  //   country/birthday/sex → bounces back to onboard. Strict here too.
  try {
    const profile = await apiFetchGuestProfile(supabase);
    const onboarded =
      !!profile.full_name &&
      !!profile.country &&
      !!profile.birthday &&
      !!profile.sex;
    if (onboarded) redirect("/discover/swipe");
  } catch (err) {
    // Profile fetch failed — render the form. The submit handler will
    // surface a real error if persistence is broken.
    console.error("[guest/onboard] guest-get-profile:", err);
  }

  return (
    <MobileFrame>
      <StatusBar />
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pt-6 pb-8">
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
