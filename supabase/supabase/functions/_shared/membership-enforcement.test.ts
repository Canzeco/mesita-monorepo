// Unit tests for Promos v4 membership enforcement (MESITA-542).
//   deno test supabase/functions/_shared/membership-enforcement.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import {
  assessPromoLane,
  effectiveStrikeCount,
  isStrikeReason,
  STRIKE_DECAY_MS,
  type MembershipRow,
} from "./membership-enforcement.ts";

function row(partial: Partial<MembershipRow> = {}): MembershipRow {
  return {
    id: "p1",
    plan: "pro",
    first_ticket_honored_at: "2026-01-02T00:00:00.000Z",
    membership_live_at: "2026-01-02T00:00:00.000Z",
    strike_count: 0,
    last_strike_at: null,
    promo_paused_until: null,
    membership_forfeited_at: null,
    ...partial,
  };
}

Deno.test("isStrikeReason: only refused_qr / ignored_qr", () => {
  assertEquals(isStrikeReason("refused_qr"), true);
  assertEquals(isStrikeReason("ignored_qr"), true);
  assertEquals(isStrikeReason("guest_left"), false);
  assertEquals(isStrikeReason(null), false);
});

Deno.test("effectiveStrikeCount: decays after ~6 months clean", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  assertEquals(
    effectiveStrikeCount(
      { strike_count: 2, last_strike_at: "2025-12-01T00:00:00.000Z" },
      now,
    ),
    0,
  );
  assertEquals(
    effectiveStrikeCount(
      {
        strike_count: 2,
        last_strike_at: new Date(now.getTime() - STRIKE_DECAY_MS + 1000).toISOString(),
      },
      now,
    ),
    2,
  );
});

Deno.test("assessPromoLane: free plan always open", () => {
  const r = assessPromoLane(row({ plan: "free", membership_live_at: null }));
  assertEquals(r.open, true);
});

Deno.test("assessPromoLane: paid not activated blocks", () => {
  const r = assessPromoLane(
    row({ membership_live_at: null, first_ticket_honored_at: null }),
  );
  assertEquals(r.open, false);
  if (!r.open) assertEquals(r.code, "not_activated");
});

Deno.test("assessPromoLane: live membership opens", () => {
  const r = assessPromoLane(row());
  assertEquals(r.open, true);
});

Deno.test("assessPromoLane: pause blocks until expiry", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  const r = assessPromoLane(
    row({
      strike_count: 2,
      last_strike_at: "2026-06-20T00:00:00.000Z",
      promo_paused_until: "2026-07-20T00:00:00.000Z",
    }),
    now,
  );
  assertEquals(r.open, false);
  if (!r.open) assertEquals(r.code, "paused");
});

Deno.test("assessPromoLane: forfeit blocks even when plan is free", () => {
  const r = assessPromoLane(
    row({
      plan: "free",
      membership_forfeited_at: "2026-06-01T00:00:00.000Z",
      membership_live_at: null,
      strike_count: 3,
      last_strike_at: "2026-06-01T00:00:00.000Z",
    }),
  );
  assertEquals(r.open, false);
  if (!r.open) assertEquals(r.code, "forfeited");
});

Deno.test("assessPromoLane: strike 1 is a warning — lane stays open", () => {
  const r = assessPromoLane(
    row({ strike_count: 1, last_strike_at: "2026-06-20T00:00:00.000Z" }),
  );
  assertEquals(r.open, true);
  if (r.open) assertEquals(r.strikeCount, 1);
});
