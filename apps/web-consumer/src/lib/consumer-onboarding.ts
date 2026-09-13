// TWO predicates, not one — the signup gate and the booking gate ask
// different questions (MESITA-1806).
//
// `consumerCanBrowse` is what /onboard collects before the app opens at all:
// first name (the app greets you by it) and birthday (MIN_SIGNUP_AGE is a ToS
// floor, and an age gate is only worth anything at account creation). That is
// the WHOLE wall now. It used to be four fields, which is four fields before a
// stranger has seen a single place.
//
// `consumerCanBook` adds the last name, asked at the one moment it is
// load-bearing: placing a reservation. The place books the table under the
// guest's full name and the host system keys on "last name + party size", and
// when the restaurant calls back, eleven-agent-get-reservation finds the
// booking by fuzzy first/last match. A first-name-only profile books a table
// nobody can find — so the last name is still REQUIRED, just asked where the
// guest can see why.
//
// Sex is in NEITHER predicate. It is segmentation: nothing downstream breaks
// without it, and it was the field most likely to make a stranger bail. It
// stays editable on /me/profile (EditProfileSheet).
//
// TICKETS deliberately do not gate. validate-web-get-ticket already falls back
// to the first name for the door, so a ticket works without a last name — and
// the guest is standing at a counter when they make one.
//
// Mirrored by:
//   • supabase/functions/consumer-web-signin-phone       (routing hint = canBrowse)
//   • supabase/functions/consumer-web-create-reservation (canBook — the REAL gate)
//   • apps/mobile-consumer/src/lib/api/auth.ts → isOnboarded / needsLastName
// Change one, change all four.

type OnboardableProfile = {
  first_name?: string | null;
  last_name?: string | null;
  birthday?: string | null;
  sex?: string | null;
};

/** The signup gate: enough to open the app. Mirrors consumer-web-signin-phone. */
export function consumerCanBrowse(
  profile: OnboardableProfile | null | undefined,
): boolean {
  return Boolean(profile?.first_name && profile?.birthday);
}

/** The booking gate: enough to put a name on a table. */
export function consumerCanBook(
  profile: OnboardableProfile | null | undefined,
): boolean {
  return consumerCanBrowse(profile) && Boolean(profile?.last_name);
}

/**
 * The one field the reservation flow may still have to ask for. Distinct from
 * `!consumerCanBook` on purpose: a profile that fails canBrowse is bounced to
 * /onboard by the (shell) gate and never reaches a booking form, so the only
 * gap a booking surface has to close is this one.
 */
export function consumerNeedsLastName(
  profile: OnboardableProfile | null | undefined,
): boolean {
  return !profile?.last_name;
}

/** The EF code consumer-web-create-reservation returns when the gate bites. */
export const LAST_NAME_REQUIRED_CODE = "last_name_required";
