// Promos v4 membership enforcement (MESITA-542).
//
// Activation gate: staff WhatsApp test ping + first honored guest ticket → live.
// Strikes (refused/ignored QR): 1 warning+re-test · 2 pause promo 30d ·
// 3 remove paid posture (plan→free, rates cleared) + forfeit stamp.
// Strikes decay after 6 months clean. Burned guests get an instant compensation
// coupon at another live partner place.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  isPaidPlan,
  type StrikeConsequence,
  strikeConsequenceForCount,
} from "./membership-enforcement-helpers.ts";
import { buildStrikePatch } from "./membership-strike-patch.ts";
export { PROMO_PAUSE_MS } from "./membership-strike-patch.ts";

export const STRIKE_REASONS = ["refused_qr", "ignored_qr"] as const;
export type StrikeReason = (typeof STRIKE_REASONS)[number];

export const STRIKE_DECAY_MS = 183 * 24 * 60 * 60 * 1000; // ~6 months

/** Dominant-like compensation rates for a burned guest (same Promos v4 grid). */
export const COMPENSATION_RATES = {
  welcome_free_rate: 40,
  welcome_premium_rate: 50,
  free_rate: 20,
  premium_rate: 30,
} as const;

export type MembershipRow = {
  id: string;
  plan: string | null;
  staff_channel_pinged_at: string | null;
  first_ticket_honored_at: string | null;
  membership_live_at: string | null;
  strike_count: number;
  last_strike_at: string | null;
  promo_paused_until: string | null;
  membership_forfeited_at: string | null;
};

export type PromoLaneBlockCode =
  | "forfeited"
  | "not_activated"
  | "paused";

export type PromoLaneEligibility =
  | { open: true; strikeCount: number; needsRetest: boolean }
  | {
    open: false;
    code: PromoLaneBlockCode;
    strikeCount: number;
    staffMessage: string;
  };

export function isStrikeReason(
  value: string | null | undefined,
): value is StrikeReason {
  return value === "refused_qr" || value === "ignored_qr";
}

/** Lazy 6-month decay — returns the effective strike count as of `now`. */
export function effectiveStrikeCount(
  row: Pick<MembershipRow, "strike_count" | "last_strike_at">,
  now: Date = new Date(),
): number {
  const raw = Math.max(0, Math.min(3, row.strike_count ?? 0));
  if (raw === 0 || !row.last_strike_at) return raw;
  const last = new Date(row.last_strike_at).getTime();
  if (!Number.isFinite(last)) return raw;
  if (now.getTime() - last >= STRIKE_DECAY_MS) return 0;
  return raw;
}

/**
 * Promo-lane gate for paid postures. Free plan is not gated here (Zero has
 * no discounts anyway — assessDiscountTicketOps still blocks free_plan).
 */
export function assessPromoLane(
  row: MembershipRow,
  now: Date = new Date(),
): PromoLaneEligibility {
  const strikeCount = effectiveStrikeCount(row, now);

  // Forfeit wins even after plan is cleared to free (strike 3).
  if (row.membership_forfeited_at) {
    return {
      open: false,
      code: "forfeited",
      strikeCount,
      staffMessage: "La membresía de este local fue removida tras 3 strikes. " +
        "El lugar sigue listado, pero las promos están apagadas.",
    };
  }

  if (!isPaidPlan(row.plan)) {
    return { open: true, strikeCount, needsRetest: false };
  }

  if (row.promo_paused_until) {
    const until = new Date(row.promo_paused_until).getTime();
    if (Number.isFinite(until) && until > now.getTime()) {
      return {
        open: false,
        code: "paused",
        strikeCount,
        staffMessage:
          "Las promos de este local están pausadas 30 días por strikes. " +
          `Se reactivan el ${new Date(until).toISOString().slice(0, 10)}.`,
      };
    }
  }

  if (!row.membership_live_at) {
    const needsPing = !row.staff_channel_pinged_at;
    const needsHonor = !row.first_ticket_honored_at;
    let detail = "Falta completar la activación";
    if (needsPing && needsHonor) {
      detail = "Falta el test ping de WhatsApp y honrar el primer ticket";
    } else if (needsPing) {
      detail = "Falta el test ping de WhatsApp del canal del staff";
    } else if (needsHonor) {
      detail = "Falta honrar el primer ticket de un comensal";
    }
    return {
      open: false,
      code: "not_activated",
      strikeCount,
      staffMessage: `${detail}.\n\n` +
        "En Mesita Business → Promos / Team: manda el test ping y canjea el primer reward.",
    };
  }

  // Strike 1 clears the ping stamp while membership stays live — re-test
  // required, but the promo lane stays open.
  return {
    open: true,
    strikeCount,
    needsRetest: !row.staff_channel_pinged_at,
  };
}

export async function loadMembershipRow(
  admin: SupabaseClient,
  projectId: string,
): Promise<MembershipRow | null> {
  const res = await admin
    .from("projects")
    .select(
      "id, plan, staff_channel_pinged_at, first_ticket_honored_at, membership_live_at, strike_count, last_strike_at, promo_paused_until, membership_forfeited_at",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return res.data as MembershipRow;
}

/** Persist lazy decay when the effective count dropped. */
export async function maybeDecayStrikes(
  admin: SupabaseClient,
  row: MembershipRow,
  now: Date = new Date(),
): Promise<MembershipRow> {
  const effective = effectiveStrikeCount(row, now);
  if (effective === row.strike_count) return row;
  const update = await admin
    .from("projects")
    .update({ strike_count: effective })
    .eq("id", row.id)
    .select(
      "id, plan, staff_channel_pinged_at, first_ticket_honored_at, membership_live_at, strike_count, last_strike_at, promo_paused_until, membership_forfeited_at",
    )
    .single();
  if (update.error || !update.data) return { ...row, strike_count: effective };
  return update.data as MembershipRow;
}

/** Stamp a successful staff WhatsApp activation/test ping. */
export async function recordStaffChannelPing(
  admin: SupabaseClient,
  projectId: string,
  now: Date = new Date(),
): Promise<
  { ok: true; membershipLive: boolean } | { ok: false; error: string }
> {
  const iso = now.toISOString();
  const row = await loadMembershipRow(admin, projectId);
  if (!row) return { ok: false, error: "project not found" };

  const patch: Record<string, unknown> = { staff_channel_pinged_at: iso };
  let membershipLive = !!row.membership_live_at;
  if (
    !row.membership_live_at &&
    row.first_ticket_honored_at &&
    !row.membership_forfeited_at &&
    isPaidPlan(row.plan)
  ) {
    patch.membership_live_at = iso;
    membershipLive = true;
  }

  const update = await admin.from("projects").update(patch).eq("id", projectId);
  if (update.error) return { ok: false, error: update.error.message };
  return { ok: true, membershipLive };
}

/**
 * Stamp first honored discount ticket and flip membership live when the
 * WhatsApp ping has already passed.
 */
export async function recordFirstTicketHonored(
  admin: SupabaseClient,
  projectId: string,
  now: Date = new Date(),
): Promise<
  { ok: true; membershipLive: boolean; firstHonor: boolean } | {
    ok: false;
    error: string;
  }
> {
  const row = await loadMembershipRow(admin, projectId);
  if (!row) return { ok: false, error: "project not found" };

  if (row.first_ticket_honored_at) {
    return {
      ok: true,
      membershipLive: !!row.membership_live_at,
      firstHonor: false,
    };
  }

  const iso = now.toISOString();
  const patch: Record<string, unknown> = { first_ticket_honored_at: iso };
  let membershipLive = !!row.membership_live_at;
  if (
    !row.membership_live_at &&
    row.staff_channel_pinged_at &&
    !row.membership_forfeited_at &&
    isPaidPlan(row.plan)
  ) {
    patch.membership_live_at = iso;
    membershipLive = true;
  }

  const update = await admin.from("projects").update(patch).eq("id", projectId);
  if (update.error) return { ok: false, error: update.error.message };
  return { ok: true, membershipLive, firstHonor: true };
}

export type RecordStrikeResult = {
  ok: true;
  strikeNumber: number;
  consequence: StrikeConsequence;
  compensationCouponId: string | null;
  alreadyRecorded?: boolean;
} | { ok: false; error: string };

/**
 * Record a refused/ignored-QR strike, apply the ladder, and compensate the guest.
 * Idempotent on ticket_id when provided.
 */
export async function recordMembershipStrike(
  admin: SupabaseClient,
  opts: {
    projectId: string;
    reason: StrikeReason;
    consumerId?: string | null;
    ticketId?: string | null;
    notes?: string | null;
    now?: Date;
  },
): Promise<RecordStrikeResult> {
  const now = opts.now ?? new Date();
  let row = await loadMembershipRow(admin, opts.projectId);
  if (!row) return { ok: false, error: "project not found" };
  row = await maybeDecayStrikes(admin, row, now);

  if (opts.ticketId) {
    const existing = await admin
      .from("membership_strikes")
      .select("id, strike_number, compensation_coupon_id")
      .eq("ticket_id", opts.ticketId)
      .maybeSingle();
    if (existing.data) {
      const n = existing.data.strike_number as number;
      return {
        ok: true,
        strikeNumber: n,
        consequence: strikeConsequenceForCount(n),
        compensationCouponId: existing.data.compensation_coupon_id as
          | string
          | null,
        alreadyRecorded: true,
      };
    }
  }

  const next = Math.min(3, effectiveStrikeCount(row, now) + 1);
  const consequence = strikeConsequenceForCount(next);
  const patch = buildStrikePatch(next, now);

  const update = await admin.from("projects").update(patch).eq(
    "id",
    opts.projectId,
  );
  if (update.error) return { ok: false, error: update.error.message };

  let compensationCouponId: string | null = null;
  if (opts.consumerId) {
    const comp = await compensateBurnedGuest(admin, {
      burnedProjectId: opts.projectId,
      consumerId: opts.consumerId,
    });
    if (comp.ok) compensationCouponId = comp.couponId;
  }

  const insert = await admin.from("membership_strikes").insert({
    project_id: opts.projectId,
    consumer_id: opts.consumerId ?? null,
    ticket_id: opts.ticketId ?? null,
    reason: opts.reason,
    strike_number: next,
    compensation_coupon_id: compensationCouponId,
    notes: opts.notes ?? null,
  }).select("id").single();
  if (insert.error) {
    // Strike already applied on projects — surface the ledger write failure.
    return { ok: false, error: `strike_ledger: ${insert.error.message}` };
  }

  return { ok: true, strikeNumber: next, consequence, compensationCouponId };
}

/** Issue a Dominant-rate compensation coupon at another live partner place. */
export async function compensateBurnedGuest(
  admin: SupabaseClient,
  opts: { burnedProjectId: string; consumerId: string },
): Promise<
  { ok: true; couponId: string; projectId: string } | {
    ok: false;
    error: string;
  }
> {
  // Prefer another live partner place; fall back to any other partner.
  const live = await admin
    .from("projects")
    .select("id, currency")
    .eq("listing_type", "partner")
    .neq("id", opts.burnedProjectId)
    .not("membership_live_at", "is", null)
    .is("membership_forfeited_at", null)
    .or("promo_paused_until.is.null,promo_paused_until.lt.now()")
    .limit(20);
  let candidates = live.data ?? [];
  if (candidates.length === 0) {
    const any = await admin
      .from("projects")
      .select("id, currency")
      .eq("listing_type", "partner")
      .neq("id", opts.burnedProjectId)
      .limit(20);
    candidates = any.data ?? [];
  }
  if (candidates.length === 0) {
    return { ok: false, error: "no_partner_place_for_compensation" };
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
  const insert = await admin
    .from("coupons")
    .insert({
      consumer_id: opts.consumerId,
      project_id: pick.id,
      status: "active",
      welcome_free_rate: COMPENSATION_RATES.welcome_free_rate,
      welcome_premium_rate: COMPENSATION_RATES.welcome_premium_rate,
      free_rate: COMPENSATION_RATES.free_rate,
      premium_rate: COMPENSATION_RATES.premium_rate,
      cap_cents: 50000, // MX$500 universal cap in cents
      currency: (pick as { currency?: string }).currency ?? "MXN",
    })
    .select("id")
    .single();
  if (insert.error) {
    // Already has an active coupon at that place — boost its rates instead.
    const boost = await admin
      .from("coupons")
      .update({
        welcome_free_rate: COMPENSATION_RATES.welcome_free_rate,
        welcome_premium_rate: COMPENSATION_RATES.welcome_premium_rate,
        free_rate: COMPENSATION_RATES.free_rate,
        premium_rate: COMPENSATION_RATES.premium_rate,
        cap_cents: 50000,
      })
      .eq("consumer_id", opts.consumerId)
      .eq("project_id", pick.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (boost.data?.id) {
      return {
        ok: true,
        couponId: boost.data.id as string,
        projectId: pick.id,
      };
    }
    return { ok: false, error: insert.error.message };
  }
  return { ok: true, couponId: insert.data.id as string, projectId: pick.id };
}
