import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/consumer/MobileFrame";
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
// The gate is `consumerCanBrowse`: FIRST NAME + BIRTHDAY + SEX (MESITA-1829 —
// sex came back because a profile surface was already printing it). Last name is
// still asked by the reservation sheet instead, where the guest can see why.
export const dynamic = "force-dynamic";

export default async function ConsumerOnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Where the guest was actually heading before the profile gate caught
  // them (a shared place link, a reservation). Threaded through
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
  // A row missing ANY of the three comes back here once and fills the gap —
  // `initial` prefills whatever is already stored; the form shows all three
  // fields on one screen (MESITA-2746).
  // That is a behaviour change from MESITA-1806, when a first-name-only row
  // sailed through: adding sex to the predicate re-onboards anyone without it.
  // Checked against live data before shipping (1 consumer, sex already set, 0
  // affected); it is the cost of the field being required at all.
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
      sex: profile.sex ?? "",
    };
  } catch (err) {
    // Profile fetch failed — render the form. The submit handler will
    // surface a real error if persistence is broken.
    console.error(
      "[consumer/onboard] consumer-get-profile:",
      errMsg(err, "profile fetch failed"),
    );
  }
  if (onboarded) redirect(nextTarget ?? CONSUMER_ROUTES.home);

  // Phone-OTP is the consumer auth method, so the identity is usually a
  // phone; fall back to email for accounts created another way. Surfacing
  // it here lets a user who signed in as the wrong account bail out and
  // re-authenticate before committing onboarding data.
  const identity = user.phone ?? user.email ?? null;

  return (
    <MobileFrame>
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pt-8 pb-8">
        {/* `OnboardForm` owns the page headline and the three fields. This file
            owns the frame and the exits: identity + "Not you?" under the
            button — still reachable for the wrong account, without competing
            with the form headline. */}
        <OnboardForm initial={initial} next={nextTarget} />

        <div className="text-muted-foreground mt-5 flex items-center justify-between gap-3 text-xs">
          <span className="truncate">{identity ?? "Your account"}</span>
          <SignOutButton
            redirectTo="/"
            label="Not you?"
            className="text-muted-foreground hover:text-foreground inline-flex min-h-11 shrink-0 items-center font-medium underline underline-offset-2 transition"
          />
        </div>
      </div>
    </MobileFrame>
  );
}
