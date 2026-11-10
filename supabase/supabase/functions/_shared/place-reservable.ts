// Does this place take reservations, and which number does Mesita dial?
// (MESITA-2156; one number, one switch since MESITA-3622)
//
// Reservations are received by phone (Pato). Two facts decide Reserve:
//   · the switch — `place_profiles.reservations_enabled`, Business ›
//     Reservations' On/Off. Off only on an explicit false.
//   · a number — the Reservations phone (`reservation_target`), else
//     Google's (`phone`).
// Reserve is On only with both. `reservation_channel` decides nothing.
//
// packages/place-profile's isReservable (src/lib/place-profile-actions.ts)
// shows the Reserve tile on the same rule; the doors that count are
// consumer-web-create-reservation, consumer-web-update-reservation and
// eleven-a2-confirm-reservation, since a stale tab or a direct call never
// sees the tile. The clients print `error` for any code they don't branch on.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const RESERVATIONS_OFF_CODE = "reservations_off";

export const RESERVATIONS_OFF_MESSAGE =
  "This place isn't taking reservations through Mesita right now.";

/** The place_profiles columns the rule reads. */
export const RESERVABLE_COLUMNS = "reservations_enabled, reservation_target, phone";

export type ReservableRow = {
  reservations_enabled?: boolean | null;
  reservation_target?: string | null;
  phone?: string | null;
};

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The switch alone: off only on an explicit false. */
export function takesReservations(
  row: { reservations_enabled?: boolean | null } | null | undefined,
): boolean {
  return row?.reservations_enabled !== false;
}

/** The place's number for reservations: the Reservations phone, else Google's. */
export function reservationNumber(row: ReservableRow | null | undefined): string {
  return clean(row?.reservation_target) || clean(row?.phone);
}

/** Reserve is On: the switch is on AND there is a number to call. */
export function isReservable(row: ReservableRow | null | undefined): boolean {
  return takesReservations(row) && reservationNumber(row) !== "";
}

/**
 * Who the Booker dials at the place: the ticket's own number (test tickets
 * pre-resolve it), else the test line while testCall is on (`testNumber`
 * non-null), else the Reservations phone, else Google's.
 */
export function dialNumber(input: {
  ticketPhone?: string | null;
  testNumber?: string | null;
  place?: ReservableRow | null;
}): { number: string; via: string } {
  const ticket = clean(input.ticketPhone);
  if (ticket) return { number: ticket, via: "row" };
  if (input.testNumber != null) return { number: clean(input.testNumber), via: "test-mode number" };
  const target = clean(input.place?.reservation_target);
  if (target) return { number: target, via: "Reservations phone" };
  const phone = clean(input.place?.phone);
  return phone ? { number: phone, via: "Google phone" } : { number: "", via: "place has no number" };
}

/** Reads the place and answers isReservable; `error` on a failed read. */
export async function readReservable(
  admin: SupabaseClient,
  placeId: string,
): Promise<{ reservable: boolean; error: string | null }> {
  const { data, error } = await admin
    .from("place_profiles")
    .select(RESERVABLE_COLUMNS)
    .eq("id", placeId)
    .maybeSingle();
  if (error) return { reservable: false, error: error.message };
  return { reservable: isReservable(data as ReservableRow | null), error: null };
}
