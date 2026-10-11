// Run: deno test supabase/functions/_shared/reservation-notification.test.ts
//
// The row Me › Notifications renders. web-consumer shows only rows whose kind
// is in its RESERVATION_KINDS and reads place_name / place_photo_url off the
// payload, so those are what these pin — plus the best-effort rule: a failed
// insert must never throw into the reservation run that recorded the outcome.

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  notifyReservationOutcome,
  RESERVATION_NOTIFICATION_KINDS,
  type ReservationNotice,
  reservationNotificationRow,
} from "./reservation-notification.ts";

const NOTICE: ReservationNotice = {
  consumerId: "c1",
  reservationId: "r1",
  referenceCode: "12345678",
  outcome: "confirmed",
  placeName: "Café Central",
  placePhotos: ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"],
};

Deno.test("row: a kind Me › Notifications renders, with the place's name and first photo", () => {
  const row = reservationNotificationRow(NOTICE);
  assertEquals(
    (RESERVATION_NOTIFICATION_KINDS as readonly string[]).includes(row.kind),
    true,
  );
  assertEquals(row, {
    consumer_id: "c1",
    kind: "reservation",
    payload: {
      reservation_id: "r1",
      outcome: "confirmed",
      reference_code: "12345678",
      place_name: "Café Central",
      place_photo_url: "https://cdn.example/a.jpg",
    },
  });
});

Deno.test("row: no name, the unnamed sentinel, or no photo leaves the key out", () => {
  for (const placeName of [null, "", "  ", "(unnamed)"]) {
    const row = reservationNotificationRow({ ...NOTICE, placeName, placePhotos: [] });
    assertEquals("place_name" in row.payload, false, String(placeName));
    assertEquals("place_photo_url" in row.payload, false);
  }
  const noCode = reservationNotificationRow({ ...NOTICE, referenceCode: null, placePhotos: null });
  assertEquals("reference_code" in noCode.payload, false);
  assertEquals("place_photo_url" in noCode.payload, false);
});

Deno.test("notify: an insert error or a throw is swallowed", async () => {
  const failing = {
    from: () => ({ insert: () => Promise.resolve({ error: { message: "42703" } }) }),
  } as unknown as SupabaseClient;
  const throwing = {
    from: () => {
      throw new Error("network");
    },
  } as unknown as SupabaseClient;
  const quiet = console.error;
  console.error = () => {};
  try {
    await notifyReservationOutcome(failing, NOTICE);
    await notifyReservationOutcome(throwing, NOTICE);
  } finally {
    console.error = quiet;
  }
});

Deno.test("notify: inserts exactly the row", async () => {
  const inserted: unknown[] = [];
  const admin = {
    from: (table: string) => {
      assertEquals(table, "consumer_notifications");
      return {
        insert: (row: unknown) => {
          inserted.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  } as unknown as SupabaseClient;
  await notifyReservationOutcome(admin, { ...NOTICE, outcome: "declined" });
  assertEquals(inserted, [reservationNotificationRow({ ...NOTICE, outcome: "declined" })]);
});
