// Unit tests for ticket rate snapshot (MESITA-912 T9).
//   deno test supabase/functions/_shared/ticket-rate-snapshot.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import {
  hasTicketRateSnapshot,
  ratesForBilling,
  snapshotRatesFromPlace,
} from "./ticket-rate-snapshot.ts";

const PLACE_RATES = {
  welcome_free_rate: 30,
  welcome_premium_rate: 50,
  free_rate: 10,
  premium_rate: 30,
};

Deno.test("snapshotRatesFromPlace: copies four columns + timestamp", () => {
  const snap = snapshotRatesFromPlace(PLACE_RATES);
  assertEquals(snap.welcome_free_rate, 30);
  assertEquals(snap.premium_rate, 30);
  assertEquals(typeof snap.rates_snapshotted_at, "string");
});

Deno.test("ratesForBilling: prefers ticket snapshot when stamped", () => {
  const ticket = {
    ...PLACE_RATES,
    rates_snapshotted_at: "2026-08-05T00:00:00.000Z",
  };
  const live = {
    welcome_free_rate: 20,
    welcome_premium_rate: 30,
    free_rate: 10,
    premium_rate: 20,
  };
  assertEquals(ratesForBilling(ticket, live).welcome_premium_rate, 50);
});

Deno.test("ratesForBilling: legacy ticket without stamp uses live place", () => {
  const ticket = { rates_snapshotted_at: null };
  const live = PLACE_RATES;
  assertEquals(ratesForBilling(ticket, live), {
    welcome_free_rate: 30,
    welcome_premium_rate: 50,
    free_rate: 10,
    premium_rate: 30,
  });
});

Deno.test("hasTicketRateSnapshot: true only with rates_snapshotted_at", () => {
  assertEquals(hasTicketRateSnapshot({ rates_snapshotted_at: "2026-01-01" }), true);
  assertEquals(hasTicketRateSnapshot({}), false);
});
