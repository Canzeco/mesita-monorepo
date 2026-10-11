// Guest Reserve gate: the place page's action bar and the Scroll and Swipe
// cards all read it. It is CLIENT-ONLY today. The server twin this comment
// used to name (supabase/_shared/place-profile-actions.ts) does not exist, and
// consumer-web-create-reservation does not read `reservations_enabled`, so
// these surfaces are the only thing between a guest and a booking at a
// walk-in place.

type ActionFlagRow = {
  reservations_enabled?: boolean | null;
};

/** Guest Reserve CTA — off only on an explicit false (Not / walk-in). */
export function isReserveActionEnabled(
  row: ActionFlagRow | null | undefined,
): boolean {
  return row?.reservations_enabled !== false;
}
