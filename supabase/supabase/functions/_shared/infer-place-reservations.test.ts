import { assertEquals } from "jsr:@std/assert@1";
import {
  decideReservations,
  reservationsLikelyFromInference,
} from "./infer-place-reservations.ts";

Deno.test("reservationsLikelyFromInference: only an explicit true offers Reserve", () => {
  assertEquals(reservationsLikelyFromInference({ reservations_likely: true }), true);
  assertEquals(reservationsLikelyFromInference({ reservations_likely: false }), false);
  assertEquals(reservationsLikelyFromInference({}), false);
  assertEquals(reservationsLikelyFromInference(null), false);
  assertEquals(reservationsLikelyFromInference({ reservations_likely: "yes" }), false);
});

Deno.test("decideReservations: Google's answer beats the link and the model", () => {
  assertEquals(decideReservations({ googleReservable: false, bookingUrl: "https://resy.com/x", modelSaysLikely: true }), false);
  assertEquals(decideReservations({ googleReservable: true, modelSaysLikely: false }), true);
});

Deno.test("decideReservations: a booking link turns it on when Google is silent", () => {
  assertEquals(decideReservations({ googleReservable: null, bookingUrl: "https://www.opentable.com/r/x", modelSaysLikely: false }), true);
});

Deno.test("decideReservations: no evidence is walk-in", () => {
  assertEquals(decideReservations({}), false);
  assertEquals(decideReservations({ bookingUrl: "  ", modelSaysLikely: null }), false);
  assertEquals(decideReservations({ modelSaysLikely: true }), true);
});
