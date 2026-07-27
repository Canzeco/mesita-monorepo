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
import { compensateBurnedGuest } from "./membership-compensation.ts";
export { PROMO_PAUSE_MS } from "./membership-strike-patch.ts";
export { COMPENSATION_RATES, compensateBurnedGuest } from "./membership-compensation.ts";

const STRIKE_REASONS = ["refused_qr", "ignored_qr"] as const;
export type StrikeReason = (typeof STRIKE_REASONS)[number];

export const STRIKE_DECAY_MS = 183 * 24 * 60 * 60 * 1000; // ~6 months

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

type ActivationStampField = "staff_channel_pinged_at" | "first_ticket_honored_at";

function buildActivationPatch(
  row: MembershipRow,
  stampField: ActivationStampField,
  now: Date,
): { patch: Record<string, unknown>; membershipLive: boolean } {
  const iso = now.toISOString();
  const patch: Record<string, unknown> = { [stampField]: iso };
  let membershipLive = !!row.membership_live_at;
  const hasPing = stampField === "staff_channel_pinged_at" ||
    !!row.staff_channel_pinged_at;
  const hasFirstHonor = stampField === "first_ticket_honored_at" ||
    !!row.first_ticket_honored_at;

  if (
    !row.membership_live_at &&
    hasPing &&
    hasFirstHonor &&
    !row.membership_forfeited_at &&
    isPaidPlan(row.plan)
  ) {
    patch.membership_live_at = iso;
    membershipLive = true;
  }

  return { patch, membershipLive };
}

/** Stamp a successful staff WhatsApp activation/test ping. */
export async function recordStaffChannelPing(
  admin: SupabaseClient,
  projectId: string,
  now: Date = new Date(),
): Promise<
  { ok: true; membershipLive: boolean } | { ok: false; error: string }
> {
  const row = await loadMembershipRow(admin, projectId);
  if (!row) return { ok: false, error: "project not found" };

  const { patch, membershipLive } = buildActivationPatch(
    row,
    "staff_channel_pinged_at",
    now,
  );

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

  const { patch, membershipLive } = buildActivationPatch(
    row,
    "first_ticket_honored_at",
    now,
  );

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

