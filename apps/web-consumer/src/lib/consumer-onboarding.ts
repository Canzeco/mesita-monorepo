// The onboarded predicate — ONE definition, because three drifting copies
// is how a consumer ends up ping-ponging between /home and /onboard.
//
// Required: first + last name (reservations are booked with the venue under
// the guest's full name, and the host system keys on "last name + party
// size"), plus birthday (age gate, MESITA-727) and sex (segmentation).
// Phone is deliberately NOT checked: sign-in is phone OTP, so every authed
// consumer already has one on the auth.user.
//
// Mirrored by:
//   • supabase/functions/consumer-web-signin-phone (routing hint)
//   • apps/mobile-consumer/src/lib/api/auth.ts → isOnboarded
// Change one, change all three.

export type OnboardableProfile = {
  first_name?: string | null;
  last_name?: string | null;
  birthday?: string | null;
  sex?: string | null;
};

export function isConsumerOnboarded(
  profile: OnboardableProfile | null | undefined,
): boolean {
  return Boolean(
    profile?.first_name &&
      profile?.last_name &&
      profile?.birthday &&
      profile?.sex,
  );
}
