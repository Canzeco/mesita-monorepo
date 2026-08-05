// Unit tests for Selected Reservation Endpoint helpers (no network).
//   deno test supabase/functions/_shared/enrich-reservation-endpoint.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import {
  availableReservationChannels,
  buildReservationTarget,
  hasReservationTarget,
  mergeProductsReservations,
  coerceReservationsPolicy,
  DEFAULT_RESERVATIONS_POLICY,
  preferReservationChannel,
  RESERVATION_CHANNELS,
  selectReservationEndpoint,
  valueForReservationChannel,
} from "./enrich-reservation-endpoint.ts";

Deno.test("default policy is phone-only, nothing parked (MESITA-842)", () => {
  assertEquals([...RESERVATION_CHANNELS], ["phone"]);
  assertEquals([...DEFAULT_RESERVATIONS_POLICY.priority], ["phone"]);
  assertEquals([...DEFAULT_RESERVATIONS_POLICY.disabled], []);
  assertEquals(DEFAULT_RESERVATIONS_POLICY.respectAdminOverride, true);
});

Deno.test("availableReservationChannels: phone when present, else empty", () => {
  assertEquals(
    availableReservationChannels({
      phone: "  +1 703-858-1102 ",
    }),
    ["phone"],
  );
  assertEquals(availableReservationChannels({ phone: null }), []);
  assertEquals(availableReservationChannels({ phone: "  " }), []);
  assertEquals(availableReservationChannels({}), []);
});

Deno.test("preferReservationChannel: phone when available", () => {
  assertEquals(preferReservationChannel(["phone"]), "phone");
  assertEquals(preferReservationChannel([]), null);
});

Deno.test("valueForReservationChannel / buildReservationTarget", () => {
  const c = { phone: "+52 55 0000 0000" };
  assertEquals(valueForReservationChannel(c, "phone"), "+52 55 0000 0000");
  assertEquals(
    buildReservationTarget("phone", c),
    { channel: "phone", value: "+52 55 0000 0000" },
  );
  assertEquals(buildReservationTarget("phone", { phone: "  " }), null);
});

Deno.test("hasReservationTarget: only phone counts as a serving override", () => {
  assertEquals(hasReservationTarget(null), false);
  assertEquals(hasReservationTarget({ menu: [] }), false);
  assertEquals(hasReservationTarget({ reservations: { channel: "phone", value: "+1" } }), true);
  // Legacy picks were never dialed — not overrides (MESITA-842).
  assertEquals(hasReservationTarget({ reservations: { channel: "whatsapp", value: "https://wa.me/1" } }), false);
  assertEquals(hasReservationTarget({ reservations: { channel: "instagram" } }), false);
  assertEquals(hasReservationTarget({ reservations: { channel: "email" } }), false);
  assertEquals(hasReservationTarget({ reservations: null }), false);
});

Deno.test("mergeProductsReservations: preserves menu and other keys", () => {
  const merged = mergeProductsReservations(
    { menu: [{ name: "Dinner" }], other: 1 },
    { channel: "phone", value: "+52 55" },
  );
  assertEquals(merged.menu, [{ name: "Dinner" }]);
  assertEquals(merged.other, 1);
  assertEquals(merged.reservations, {
    channel: "phone",
    value: "+52 55",
  });
  assertEquals(
    mergeProductsReservations(null, { channel: "phone", value: "+1" }),
    { reservations: { channel: "phone", value: "+1" } },
  );
});

Deno.test("selectReservationEndpoint: phone when present, else null", () => {
  assertEquals(
    selectReservationEndpoint({ candidates: {} }),
    { target: null, diag: { ok: false, reason: "no_candidates", disabled: [] } },
  );

  const phoneWins = selectReservationEndpoint({
    candidates: { phone: "+52 55 1111" },
  });
  assertEquals(phoneWins.target, { channel: "phone", value: "+52 55 1111" });
  assertEquals(phoneWins.diag.via, "sole_candidate");
  assertEquals(phoneWins.diag.channel, "phone");

  const noPhone = selectReservationEndpoint({
    candidates: { phone: "  " },
  });
  assertEquals(noPhone.target, null);
  assertEquals(noPhone.diag.reason, "no_candidates");
});

// ── Reservations Config policy (MESITA-623 / MESITA-842) ──

Deno.test("coerceReservationsPolicy: malformed rows fall back; legacy channels drop", () => {
  assertEquals(coerceReservationsPolicy(null), DEFAULT_RESERVATIONS_POLICY);
  assertEquals(coerceReservationsPolicy("nope"), DEFAULT_RESERVATIONS_POLICY);
  assertEquals(coerceReservationsPolicy([]), DEFAULT_RESERVATIONS_POLICY);

  // Legacy whatsapp/instagram are dropped; phone is appended so it stays reachable.
  const legacy = coerceReservationsPolicy({
    priority: ["instagram", "whatsapp", "email", "phone"],
    disabled: ["whatsapp", "instagram", "sms"],
    respectAdminOverride: false,
  });
  assertEquals([...legacy.priority], ["phone"]);
  assertEquals([...legacy.disabled], []);
  assertEquals(legacy.respectAdminOverride, false);

  // A row missing respectAdminOverride keeps the operator-wins default.
  assertEquals(coerceReservationsPolicy({ priority: [], disabled: [] }).respectAdminOverride, true);
});

Deno.test("selectReservationEndpoint: a parked phone never wins", () => {
  const policy = {
    priority: ["phone"] as const,
    disabled: ["phone"] as const,
    respectAdminOverride: true,
  };
  const onlyParked = selectReservationEndpoint({
    candidates: { phone: "+52 55 1111" },
    policy,
  });
  assertEquals(onlyParked.target, null);
  assertEquals(onlyParked.diag.reason, "no_candidates");

  assertEquals(availableReservationChannels({ phone: "+52 55" }, policy), []);
  assertEquals(preferReservationChannel(["phone"], policy), null);
});
