import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/consumer/MobileFrame";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { OnboardForm, type OnboardInitialValues } from "./OnboardForm";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { consumerCanBrowse } from "@/lib/consumer-onboarding";
import { safeNextPath, withNext } from "@/lib/auth-redirect";
import { errMsg } from "@/lib/utils";

// Consumer onboarding — server-side gated. The middleware already blocks
// signed-out users from /profile and friends, but onboard sits
// between sign-up and the actual app, so it has its own checks:
//
//   - signed out           → / (with next=/onboard)
//   - already past the gate → /discover (don't re-collect data)
//   - signed in, no name    → render the form
//
// The gate is `consumerCanBrowse`: FIRST NAME + BIRTHDAY, nothing else
// (MESITA-1806). Last name is asked by the reservation sheet, sex on
// /me/profile — neither belongs in front of a stranger who hasn't seen a
// place yet.
export const dynamic = "force-dynamic";

export default async function ConsumerOnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Where the guest was actually heading before the profile gate caught
  // them (a shared place link, a reservation, a ticket). Threaded through
  // the form so finishing onboarding resumes the journey.
  const nextTarget = safeNextPath((await searchParams).next);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(withNext("/", withNext(CONSUMER_ROUTES.onboard, nextTarget)));

  // Completeness predicate is `consumerCanBrowse` — the SAME one the (shell)
  // layout gates on. Two copies of "complete enough" is how a user ends up
  // ping-ponging: onboard sends them on, the shell disagrees and sends them
  // back. One predicate, both call sites.
  //
  // Legacy rows are fine here: a first-name-only profile passes this gate and
  // browses, and hits the last-name field once, at its next booking.
  // `initial` prefills whatever they already gave us.
  // redirect() throws NEXT_REDIRECT, so it MUST live outside the try/catch —
  // otherwise the catch swallows the redirect and logs it as an error (and
  // the already-onboarded user gets stuck on the form).
  let onboarded = false;
  let initial: OnboardInitialValues | undefined;
  try {
    const { consumer: profile } = await apiFetchConsumerProfile(supabase);
    onboarded = consumerCanBrowse(profile);
    initial = {
      // Legacy rows predate the first/last split: full_name holds whatever
      // the old single field captured (usually just the first name).
      firstName: profile.first_name ?? profile.full_name ?? "",
      birthday: profile.birthday ?? "",
    };
  } catch (err) {
    // Profile fetch failed — render the form. The submit handler will
    // surface a real error if persistence is broken.
    console.error(
      "[consumer/onboard] consumer-get-profile:",
      errMsg(err, "profile fetch failed"),
    );
  }
  if (onboarded) redirect(nextTarget ?? CONSUMER_ROUTES.discoverDefault);

  // Phone-OTP is the consumer auth method, so the identity is usually a
  // phone; fall back to email for accounts created another way. Surfacing
  // it here lets a user who signed in as the wrong account bail out and
  // re-authenticate before committing onboarding data.
  const identity = user.phone ?? user.email ?? null;

  return (
    <MobileFrame>
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pt-6 pb-8">
        <div className="border-border bg-card mb-6 flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-muted-foreground type-meta font-semibold tracking-[0.12em] uppercase">
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
          <div className="bg-pink-gradient shadow-glow mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
            <MesitaMark className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Tell us about you
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Two things, then you&apos;re in.
          </p>
        </div>

        <OnboardForm initial={initial} next={nextTarget} />
      </div>
    </MobileFrame>
  );
}
