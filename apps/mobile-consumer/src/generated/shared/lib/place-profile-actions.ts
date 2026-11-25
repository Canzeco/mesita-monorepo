// Guest Reserve gate: the place page's action bar and the Scroll and Swipe
// cards all read it. Its server twin is isReservable
// (supabase/_shared/place-reservable.ts): consumer-web-create-reservation
// 409s `reservations_off` on the same rule (MESITA-2156, MESITA-3622), and
// the sheet prints that refusal's `error`. Change the two together.

type ActionFlagRow = {
  reservations_enabled?: boolean | null;
};

type ReservableRow = ActionFlagRow & {
  /** The server's answer (consumer-web-get-place), which also sees the
   *  Reservations phone a consumer read never carries. */
  reservable?: boolean | null;
  reservation_target?: string | null;
  phone?: string | null;
};

/** The Reservations switch alone — off only on an explicit false. */
export function isReserveActionEnabled(
  row: ActionFlagRow | null | undefined,
): boolean {
  return row?.reservations_enabled !== false;
}

const filled = (v: unknown) => typeof v === "string" && v.trim() !== "";

/** Reserve is On: the switch is on AND there is a number to call — the
 *  Reservations phone, else Google's (reservations are received by phone). */
export function isReservable(row: ReservableRow | null | undefined): boolean {
  if (typeof row?.reservable === "boolean") return row.reservable;
  return isReserveActionEnabled(row) && (filled(row?.reservation_target) || filled(row?.phone));
}
