import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  dialNumber,
  isReservable,
  RESERVATIONS_OFF_CODE,
  reservationNumber,
  takesReservations,
} from "./place-reservable.ts";

Deno.test("takesReservations: off only on an explicit false", () => {
  assertEquals(takesReservations({ reservations_enabled: true }), true);
  assertEquals(takesReservations({ reservations_enabled: null }), true);
  assertEquals(takesReservations({}), true);
  assertEquals(takesReservations(null), true);
  assertEquals(takesReservations({ reservations_enabled: false }), false);
});

// MESITA-3622: one switch AND one number.
Deno.test("isReservable: the switch on and a number to call", () => {
  assertEquals(isReservable({ reservations_enabled: true, phone: "+528183782164" }), true);
  assertEquals(isReservable({ reservations_enabled: true, reservation_target: "+528111111111" }), true);
  assertEquals(isReservable({ reservations_enabled: true, phone: "  ", reservation_target: null }), false);
  assertEquals(isReservable({ reservations_enabled: true }), false);
  assertEquals(isReservable({ reservations_enabled: false, phone: "+528183782164" }), false);
  assertEquals(isReservable(null), false);
});

Deno.test("reservationNumber: the Reservations phone, else Google's", () => {
  assertEquals(reservationNumber({ reservation_target: " +528111111111 ", phone: "+528122222222" }), "+528111111111");
  assertEquals(reservationNumber({ reservation_target: "", phone: "+528122222222" }), "+528122222222");
});

Deno.test("dialNumber: ticket, then test line, then Reservations phone, then Google's", () => {
  const place = { reservation_target: "+528111111111", phone: "+528122222222" };
  assertEquals(dialNumber({ ticketPhone: "+528100000000", testNumber: "+15550000000", place }).number, "+528100000000");
  assertEquals(dialNumber({ testNumber: "+15550000000", place }), { number: "+15550000000", via: "test-mode number" });
  assertEquals(dialNumber({ testNumber: null, place }), { number: "+528111111111", via: "Reservations phone" });
  assertEquals(dialNumber({ place: { phone: "+528122222222" } }), { number: "+528122222222", via: "Google phone" });
  assertEquals(dialNumber({ place: {} }).number, "");
});

// The engine must not decide by channel any more: a whatsapp/instagram/web
// pick used to dial nobody.
Deno.test("the engine dials through dialNumber, never by reservation_channel", async () => {
  const src = await Deno.readTextFile(
    new URL("../supabase-edgefunc-place-reservation-call/index.ts", import.meta.url),
  );
  assert(src.includes("dialNumber("), "the engine must resolve the number with dialNumber");
  assert(!/reservation_channel/.test(src), "the engine must not read reservation_channel");
});

// The EFs are the gates that count. Each must refuse before it writes.
for (const [ef, write] of [
  ["consumer-web-create-reservation", "writeReservation(admin"],
  ["consumer-web-update-reservation", "writeReservation(admin"],
  ["eleven-a2-confirm-reservation", "const rounds ="],
] as const) {
  Deno.test(`${ef} refuses a place that is not reservable before it writes`, async () => {
    const src = await Deno.readTextFile(new URL(`../${ef}/index.ts`, import.meta.url));
    const gate = src.indexOf("readReservable(");
    assert(gate > 0, `${ef} never calls readReservable`);
    assert(src.indexOf(write) > gate, "the reservable gate must run before the write");
    assert(src.includes("RESERVATIONS_OFF_CODE"));
  });
}

Deno.test("the refusal code clients branch on", () => {
  assertEquals(RESERVATIONS_OFF_CODE, "reservations_off");
});
