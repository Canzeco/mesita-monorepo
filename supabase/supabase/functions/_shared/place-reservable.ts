// Does this place take reservations? (MESITA-2156)
//
// `place_profiles.reservations_enabled` is the one fact: Create seeds it from
// Google, the operator owns it. Off only on an explicit false (Not / walk-in);
// null means nobody has said no, so Reserve stays open. web-consumer's
// isReserveActionEnabled (src/lib/place-profile-actions.ts) hides Reserve on
// the same rule; consumer-web-create-reservation is the gate that counts,
// since a stale tab or a direct call never sees the hidden button.
//
// The clients print `error` for any code they don't branch on.

export const RESERVATIONS_OFF_CODE = "reservations_off";

export const RESERVATIONS_OFF_MESSAGE =
  "This place doesn't take reservations — it's walk-in only.";

export function takesReservations(
  row: { reservations_enabled?: boolean | null } | null | undefined,
): boolean {
  return row?.reservations_enabled !== false;
}
