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

Deno.test("default policy is phone > whatsapp > instagram, nothing parked", () => {
  assertEquals([...RESERVATION_CHANNELS], ["phone", "whatsapp", "instagram"]);
  assertEquals([...DEFAULT_RESERVATIONS_POLICY.priority], ["phone", "whatsapp", "instagram"]);
  assertEquals([...DEFAULT_RESERVATIONS_POLICY.disabled], []);
  assertEquals(DEFAULT_RESERVATIONS_POLICY.respectAdminOverride, true);
});

Deno.test("availableReservationChannels: only non-empty values in priority order", () => {
  assertEquals(
    availableReservationChannels({
      phone: "  +1 703-858-1102 ",
      whatsapp_url: "",
      instagram_url: null,
    }),
    ["phone"],
  );
  assertEquals(
    availableReservationChannels({
      phone: null,
      whatsapp_url: "https://wa.me/52155",
      instagram_url: "https://instagram.com/cafe",
    }),
    ["whatsapp", "instagram"],
  );
  // Instagram listed first in input still yields priority order in output.
  assertEquals(
    availableReservationChannels({
      instagram_url: "https://instagram.com/cafe",
      whatsapp_url: "https://wa.me/52155",
      phone: "+52 55",
    }),
    ["phone", "whatsapp", "instagram"],
  );
  assertEquals(availableReservationChannels({}), []);
});

Deno.test("preferReservationChannel: phone > whatsapp > instagram", () => {
  assertEquals(
    preferReservationChannel(["instagram", "whatsapp", "phone"]),
    "phone",
  );
  assertEquals(preferReservationChannel(["instagram", "whatsapp"]), "whatsapp");
  assertEquals(preferReservationChannel(["instagram"]), "instagram");
  assertEquals(preferReservationChannel([]), null);
});

Deno.test("valueForReservationChannel / buildReservationTarget", () => {
  const c = {
    phone: "+52 55 0000 0000",
    whatsapp_url: "https://wa.me/5255",
    instagram_url: "https://instagram.com/x",
  };
  assertEquals(valueForReservationChannel(c, "phone"), "+52 55 0000 0000");
  assertEquals(valueForReservationChannel(c, "whatsapp"), "https://wa.me/5255");
  assertEquals(
    buildReservationTarget("phone", c),
    { channel: "phone", value: "+52 55 0000 0000" },
  );
  assertEquals(buildReservationTarget("phone", { phone: "  " }), null);
});

Deno.test("hasReservationTarget: detects admin-selected channel", () => {
  assertEquals(hasReservationTarget(null), false);
  assertEquals(hasReservationTarget({ menu: [] }), false);
  assertEquals(hasReservationTarget({ reservations: { channel: "phone", value: "+1" } }), true);
  assertEquals(hasReservationTarget({ reservations: { channel: "email" } }), false);
  assertEquals(hasReservationTarget({ reservations: null }), false);
});

Deno.test("mergeProductsReservations: preserves menu and other keys", () => {
  const merged = mergeProductsReservations(
    { menu: [{ name: "Dinner" }], other: 1 },
    { channel: "whatsapp", value: "https://wa.me/1" },
  );
  assertEquals(merged.menu, [{ name: "Dinner" }]);
  assertEquals(merged.other, 1);
  assertEquals(merged.reservations, {
    channel: "whatsapp",
    value: "https://wa.me/1",
  });
  assertEquals(
    mergeProductsReservations(null, { channel: "phone", value: "+1" }),
    { reservations: { channel: "phone", value: "+1" } },
  );
});

Deno.test("selectReservationEndpoint: deterministic phone > whatsapp > instagram", () => {
  assertEquals(
    selectReservationEndpoint({ candidates: {} }),
    { target: null, diag: { ok: false, reason: "no_candidates", disabled: [] } },
  );

  const phoneWins = selectReservationEndpoint({
    candidates: {
      phone: "+52 55 1111",
      whatsapp_url: "https://wa.me/5255",
      instagram_url: "https://instagram.com/x",
    },
  });
  assertEquals(phoneWins.target, { channel: "phone", value: "+52 55 1111" });
  assertEquals(phoneWins.diag.via, "priority_phone_whatsapp_instagram");
  assertEquals(phoneWins.diag.channel, "phone");

  const whatsappNext = selectReservationEndpoint({
    candidates: {
      phone: "  ",
      whatsapp_url: "https://wa.me/5255",
      instagram_url: "https://instagram.com/x",
    },
  });
  assertEquals(whatsappNext.target, {
    channel: "whatsapp",
    value: "https://wa.me/5255",
  });

  const igOnly = selectReservationEndpoint({
    candidates: { instagram_url: "https://instagram.com/solo" },
  });
  assertEquals(igOnly.target, {
    channel: "instagram",
    value: "https://instagram.com/solo",
  });
  assertEquals(igOnly.diag.via, "sole_candidate");
});

// ── Reservations Config policy (MESITA-623) — the order is an operator knob ──

Deno.test("coerceReservationsPolicy: malformed rows fall back, never throw", () => {
  assertEquals(coerceReservationsPolicy(null), DEFAULT_RESERVATIONS_POLICY);
  assertEquals(coerceReservationsPolicy("nope"), DEFAULT_RESERVATIONS_POLICY);
  assertEquals(coerceReservationsPolicy([]), DEFAULT_RESERVATIONS_POLICY);

  // Unknown channels are dropped; unranked ones are appended so they stay reachable.
  const partial = coerceReservationsPolicy({
    priority: ["instagram", "email", "instagram"],
    disabled: ["phone", "sms"],
    respectAdminOverride: false,
  });
  assertEquals([...partial.priority], ["instagram", "phone", "whatsapp"]);
  assertEquals([...partial.disabled], ["phone"]);
  assertEquals(partial.respectAdminOverride, false);

  // A row missing respectAdminOverride keeps the operator-wins default.
  assertEquals(coerceReservationsPolicy({ priority: [], disabled: [] }).respectAdminOverride, true);
});

Deno.test("selectReservationEndpoint: a reordered policy changes the winner", () => {
  const candidates = {
    phone: "+52 55 1111",
    whatsapp_url: "https://wa.me/5255",
    instagram_url: "https://instagram.com/x",
  };
  const waFirst = selectReservationEndpoint({
    candidates,
    policy: {
      priority: ["whatsapp", "phone", "instagram"],
      disabled: [],
      respectAdminOverride: true,
    },
  });
  assertEquals(waFirst.target, { channel: "whatsapp", value: "https://wa.me/5255" });
  assertEquals(waFirst.diag.via, "priority_whatsapp_phone_instagram");
  assertEquals(waFirst.diag.available, ["whatsapp", "phone", "instagram"]);
});

Deno.test("selectReservationEndpoint: a parked channel never wins", () => {
  const policy = {
    priority: ["phone", "whatsapp", "instagram"] as const,
    disabled: ["phone"] as const,
    respectAdminOverride: true,
  };
  // Phone is top-ranked but parked, so the next available channel takes it.
  const skipped = selectReservationEndpoint({
    candidates: { phone: "+52 55 1111", whatsapp_url: "https://wa.me/5255" },
    policy,
  });
  assertEquals(skipped.target, { channel: "whatsapp", value: "https://wa.me/5255" });

  // Parked even as the sole contact — the place gets no endpoint at all.
  const onlyParked = selectReservationEndpoint({
    candidates: { phone: "+52 55 1111" },
    policy,
  });
  assertEquals(onlyParked.target, null);
  assertEquals(onlyParked.diag.reason, "no_candidates");

  assertEquals(availableReservationChannels({ phone: "+52 55" }, policy), []);
  assertEquals(preferReservationChannel(["phone"], policy), null);
});
