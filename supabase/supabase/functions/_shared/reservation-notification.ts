// Me › Notifications — the writer of consumer_notifications.
//
// A reservation reaches the guest two ways: the a2 Confirmer call and this
// row, which web-consumer renders (components/consumer/notification-row.tsx)
// as one line per outcome under the place's name and photo. Every outcome the
// guest has to know about or act on writes one row, whatever consumer_notify
// says: an `app` guest has no other channel, and a `call` guest can miss the
// ring.
//
//   outcome          written when
//   ───────────────  ─────────────────────────────────────────────────────────
//   confirmed        the place confirmed (supabase-edgefunc-reservation-call)
//   counter_offer    the place offered alternatives — the guest picks one
//   declined         the place said no
//   unreachable      nobody who books was reached after every attempt
//   unresolved       the call ended without a verdict, or the line was wrong
//   place_cancelled  the place called Mesita to cancel (eleven-a4)
//
// Best-effort: the row is a courtesy copy of state reservation_tickets
// already holds, so a failed insert is logged and swallowed — it never fails
// the run that recorded the outcome.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { errorMessage } from "./errors.ts";

/** The kinds Me › Notifications renders — web-consumer's RESERVATION_KINDS. */
export const RESERVATION_NOTIFICATION_KINDS = ["reservation", "booking"] as const;

export type ReservationOutcome =
  | "confirmed"
  | "counter_offer"
  | "declined"
  | "unreachable"
  | "unresolved"
  | "place_cancelled";

export type ReservationNotice = {
  consumerId: string;
  reservationId: string;
  referenceCode: string | null;
  outcome: ReservationOutcome;
  /** place_profiles.name — the generated display name. */
  placeName: string | null;
  /** place_profiles.photos; the first one is the row's thumbnail. */
  placePhotos: unknown;
};

export type ReservationNotificationRow = {
  consumer_id: string;
  kind: (typeof RESERVATION_NOTIFICATION_KINDS)[number];
  payload: Record<string, string>;
};

/**
 * The row for one outcome. The payload keys web-consumer reads are
 * place_name and place_photo_url; each is left out rather than sent empty,
 * so the row falls back to the pin and "Mesita".
 */
export function reservationNotificationRow(
  n: ReservationNotice,
): ReservationNotificationRow {
  const payload: Record<string, string> = {
    reservation_id: n.reservationId,
    outcome: n.outcome,
  };
  if (n.referenceCode) payload.reference_code = n.referenceCode;
  const name = n.placeName?.trim();
  if (name && name !== "(unnamed)") payload.place_name = name;
  const photo = Array.isArray(n.placePhotos)
    ? n.placePhotos.find((p): p is string => typeof p === "string" && p.length > 0)
    : undefined;
  if (photo) payload.place_photo_url = photo;
  return { consumer_id: n.consumerId, kind: "reservation", payload };
}

export async function notifyReservationOutcome(
  admin: SupabaseClient,
  n: ReservationNotice,
): Promise<void> {
  try {
    const { error } = await admin
      .from("consumer_notifications")
      .insert(reservationNotificationRow(n));
    if (error) {
      console.error(
        `[reservation-notification] ${n.outcome} for ${n.reservationId} not written: ${error.message}`,
      );
    }
  } catch (err) {
    console.error(
      `[reservation-notification] ${n.outcome} for ${n.reservationId} threw: ${
        errorMessage(err)
      }`,
    );
  }
}
