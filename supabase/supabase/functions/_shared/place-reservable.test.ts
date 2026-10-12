import { assert, assertEquals } from "jsr:@std/assert@1";
import { RESERVATIONS_OFF_CODE, takesReservations } from "./place-reservable.ts";

Deno.test("takesReservations: off only on an explicit false", () => {
  assertEquals(takesReservations({ reservations_enabled: true }), true);
  assertEquals(takesReservations({ reservations_enabled: null }), true);
  assertEquals(takesReservations({}), true);
  assertEquals(takesReservations(null), true);
  assertEquals(takesReservations({ reservations_enabled: false }), false);
});

// MESITA-2156: the EF is the gate that counts. It must refuse before the
// ticket is written, or a walk-in place still gets a ticket and a call.
Deno.test("consumer-web-create-reservation refuses a walk-in place before it writes", async () => {
  const src = await Deno.readTextFile(
    new URL("../consumer-web-create-reservation/index.ts", import.meta.url),
  );
  const gate = src.indexOf("takesReservations(");
  const write = src.indexOf("writeReservation(admin");
  assert(gate > 0, "the EF never calls takesReservations");
  assert(write > gate, "the reservations_enabled gate must run before the insert");
  assert(src.includes("code: RESERVATIONS_OFF_CODE"));
  assert(/RESERVATIONS_OFF_MESSAGE,\s*\}, 409\)/.test(src), "refusal must be a 409");
  assertEquals(RESERVATIONS_OFF_CODE, "reservations_off");
});
