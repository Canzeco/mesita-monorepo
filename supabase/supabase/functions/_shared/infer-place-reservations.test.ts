import { assertEquals } from "jsr:@std/assert";
import { reservationsLikelyFromInference } from "./infer-place-reservations.ts";

Deno.test("reservationsLikelyFromInference: explicit false is walk-in", () => {
  assertEquals(reservationsLikelyFromInference({ reservations_likely: false }), false);
});

Deno.test("reservationsLikelyFromInference: true, missing, and junk all offer Reserve", () => {
  assertEquals(reservationsLikelyFromInference({ reservations_likely: true }), true);
  assertEquals(reservationsLikelyFromInference({}), true);
  assertEquals(reservationsLikelyFromInference(null), true);
  assertEquals(reservationsLikelyFromInference({ reservations_likely: "no" }), true);
});
