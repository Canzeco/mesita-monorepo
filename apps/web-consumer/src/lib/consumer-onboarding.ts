// TWO predicates, not one — the signup gate and the booking gate ask
// different questions (MESITA-1806).
//
// `consumerCanBrowse` is what /onboard collects before the app opens at all:
// first name (the app greets you by it), birthday (MIN_SIGNUP_AGE is a ToS
// floor, and an age gate is only worth anything at account creation), and sex
// (MESITA-1829).
//
// `consumerCanBook` adds the last name, asked at the one moment it is
// load-bearing: placing a reservation. The place books the table under the
// guest's full name and the host system keys on "last name + party size", and
// when the restaurant calls back, eleven-agent-get-reservation finds the
// booking by fuzzy first/last match. A first-name-only profile books a table
// nobody can find — so the last name is still REQUIRED, just asked where the
// guest can see why.
//
// SEX IS BACK IN `consumerCanBrowse`, AND REQUIRED (Pato, MESITA-1829). This
// reverses MESITA-1806, which moved it to /me/profile as "segmentation
// nothing downstream breaks without".
//
// What 1806 missed is that something downstream ALREADY PRINTS IT. The
// Passport document builds `age · sex · country` (PassportModal, mobile
// passport.tsx), and that line is a `.filter(Boolean).join(" · ")` — so every
// account created after 1806 renders "27 · 🇲🇽 México" with the hole
// INVISIBLE rather than absent. No gap, no prompt, no way to learn the field
// exists; the only surface that asks is the Edit-profile sheet, which is not
// a place anyone goes. A field that one surface prints and no surface
// collects is the drift this reverses, not a preference about form length.
//
// It is required rather than optional-with-skip because Pato asked for it
// twice after the optional version was recommended. The cost is recorded
// where it lands: `consumers_sex_check` allows male|female ONLY (narrowed by
// 20260825003000), so this is a two-option choice with no opt-out and there
// is no third value to offer without a migration.
//
// Adding it to the gate re-onboards any profile that lacks it. Verified
// against live data before shipping: 1 consumer, sex already set, 0 bounced.
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

/** The two values `consumers.sex` accepts. The check constraint was narrowed
 *  to exactly these in 20260825003000 (`other` was dropped and its rows
 *  nulled), so this is the whole vocabulary — every surface that offers a
 *  choice offers these, in this order, and nothing invents a third. */
export const CONSUMER_SEXES = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
] as const;

export type ConsumerSex = (typeof CONSUMER_SEXES)[number]["value"];

/** True for a value the DB will actually store. Guards the form before it
 *  sends, so a legacy row holding something else can't be echoed back. */
export function isConsumerSex(value: unknown): value is ConsumerSex {
  return CONSUMER_SEXES.some((s) => s.value === value);
}

/** The signup gate: enough to open the app. Mirrors consumer-web-signin-phone. */
export function consumerCanBrowse(
  profile: OnboardableProfile | null | undefined,
): boolean {
  return Boolean(
    profile?.first_name && profile?.birthday && isConsumerSex(profile?.sex),
  );
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
