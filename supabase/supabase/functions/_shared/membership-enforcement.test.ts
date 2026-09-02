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
    plan_live_at: "2026-01-02T00:00:00.000Z",
    strike_count: 0,
    last_strike_at: null,
    promo_paused_until: null,
    plan_forfeited_at: null,
    reward_lane_pending_review_at: null,
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
  const r = assessPromoLane(row({ plan: "free", plan_live_at: null }));
  assertEquals(r.open, true);
});

Deno.test("assessPromoLane: paid not-yet-activated stays OPEN (MESITA-850)", () => {
  // The guest's first ticket IS the activation — closing the lane here was
  // a deadlock (creation checks the lane; no ticket could ever be honored).
  const r = assessPromoLane(
    row({ plan_live_at: null, first_ticket_honored_at: null }),
  );
  assertEquals(r.open, true);
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
      plan_forfeited_at: "2026-06-01T00:00:00.000Z",
      plan_live_at: null,
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

// ── Ghost-partner hold (MESITA-1311) ──────────────────────────────────

Deno.test("assessPromoLane: pending review closes the lane, in Spanish", () => {
  const r = assessPromoLane(
    row({ reward_lane_pending_review_at: "2026-09-01T00:00:00.000Z" }),
  );
  assertEquals(r.open, false);
  if (!r.open) {
    assertEquals(r.code, "pending_review");
    assertEquals(r.staffMessage.includes("revisión"), true);
    assertEquals(r.staffMessage.includes("reporte"), true);
  }
});

Deno.test("assessPromoLane: the hold wins over forfeit AND pause", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  const r = assessPromoLane(
    row({
      reward_lane_pending_review_at: "2026-06-25T00:00:00.000Z",
      plan_forfeited_at: "2026-06-01T00:00:00.000Z",
      promo_paused_until: "2026-07-20T00:00:00.000Z",
      strike_count: 3,
      last_strike_at: "2026-06-01T00:00:00.000Z",
    }),
    now,
  );
  assertEquals(r.open, false);
  if (!r.open) assertEquals(r.code, "pending_review");
});

Deno.test("assessPromoLane: the hold gates a FREE plan too — review outranks posture", () => {
  const r = assessPromoLane(
    row({
      plan: "free",
      plan_live_at: null,
      reward_lane_pending_review_at: "2026-09-01T00:00:00.000Z",
    }),
  );
  assertEquals(r.open, false);
  if (!r.open) assertEquals(r.code, "pending_review");
});

Deno.test("assessPromoLane: restore (null) reopens to whatever the ladder says", () => {
  const clean = assessPromoLane(row({ reward_lane_pending_review_at: null }));
  assertEquals(clean.open, true);
  const now = new Date("2026-07-01T00:00:00.000Z");
  const stillPaused = assessPromoLane(
    row({
      reward_lane_pending_review_at: null,
      strike_count: 2,
      last_strike_at: "2026-06-20T00:00:00.000Z",
      promo_paused_until: "2026-07-20T00:00:00.000Z",
    }),
    now,
  );
  assertEquals(stillPaused.open, false);
  if (!stillPaused.open) assertEquals(stillPaused.code, "paused");
});
