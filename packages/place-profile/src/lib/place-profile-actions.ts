// Guest Reserve gate: the place page's action bar and the Scroll and Swipe
// cards all read it. Its server twin is takesReservations
// (supabase/_shared/place-reservable.ts): consumer-web-create-reservation
// 409s `reservations_off` on the same rule (MESITA-2156), and the sheet
// prints that refusal's `error`. Change the two together.

type ActionFlagRow = {
  reservations_enabled?: boolean | null;
};

/** Guest Reserve CTA — off only on an explicit false (Not / walk-in). */
export function isReserveActionEnabled(
  row: ActionFlagRow | null | undefined,
): boolean {
  return row?.reservations_enabled !== false;
}
