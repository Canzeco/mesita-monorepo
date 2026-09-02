// Promos v4 membership enforcement (MESITA-542).
//
// Activation is a recorded MILESTONE, not a lane gate (v3b, MESITA-850).
// It used to close the promo lane until the first honored ticket — but since
// Tickets v2 the CONSUMER creates tickets, and creation checks this very
// lane, so "not activated blocks creation" was a deadlock: no ticket could
// ever exist to be honored. (Same failure class as the retired WhatsApp
// ping, which once left every paid place stuck the same way, MESITA-833.)
// first_ticket_honored_at / plan_live_at still get stamped on the
// first close and remain the activation signal for admin & Performance.
// Strikes (refused/ignored QR): 1 warning · 2 pause promo 30d ·
// 3 remove paid posture (plan→free, rates cleared) + forfeit stamp.
// Strikes decay after 6 months clean. There is no guest-side compensation:
// a reward comes from SHOWING UP, so compensating a burned guest belongs on a
// future visit ticket, not on a grant handed out at strike time.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  isPaidPlan,
  type StrikeConsequence,
  strikeConsequenceForCount,
} from "./membership-enforcement-helpers.ts";
import { buildStrikePatch } from "./membership-strike-patch.ts";
import { type ProjectPatch, writePlace } from "./place-doc.ts";
export { PROMO_PAUSE_MS } from "./membership-strike-patch.ts";

const STRIKE_REASONS = ["refused_qr", "ignored_qr"] as const;
export type StrikeReason = (typeof STRIKE_REASONS)[number];

export const STRIKE_DECAY_MS = 183 * 24 * 60 * 60 * 1000; // ~6 months

export type MembershipRow = {
  id: string;
  plan: string | null;
  first_ticket_honored_at: string | null;
  plan_live_at: string | null;
  strike_count: number;
  last_strike_at: string | null;
  promo_paused_until: string | null;
  plan_forfeited_at: string | null;
  /** Ghost-partner hold (MESITA-1311): a confirmed guest report puts the
   *  lane under review until admin restore clears it. Null = no hold. */
  reward_lane_pending_review_at: string | null;
};

export type PromoLaneBlockCode =
  | "pending_review"
  | "forfeited"
  | "paused";

export type PromoLaneEligibility =
  | { open: true; strikeCount: number }
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

  // Ghost-partner hold (MESITA-1311) — checked BEFORE forfeit/pause: an
  // open review is the freshest fact about the place, and the message the
  // staff should see while Mesita is actively looking at a confirmed
  // report is "under review", not the older strike consequence.
  if (row.reward_lane_pending_review_at) {
    return {
      open: false,
      code: "pending_review",
      strikeCount,
      staffMessage:
        "Las promos de este local están en revisión tras un reporte " +
        "confirmado de un guest. Mesita las reactiva cuando termine la " +
        "revisión.",
    };
  }

  // Forfeit wins even after plan is cleared to free (strike 3).
  if (row.plan_forfeited_at) {
    return {
      open: false,
      code: "forfeited",
      strikeCount,
      staffMessage: "La membresía de este local fue removida tras 3 strikes. " +
        "El lugar sigue listado, pero las promos están apagadas.",
    };
  }

  if (!isPaidPlan(row.plan)) {
    return { open: true, strikeCount };
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

  // NOT-activated does NOT close the lane (v3b, MESITA-850): the guest's
  // first ticket is exactly how a place activates — blocking creation on
  // activation was a deadlock. Strike 1 is a warning only — membership
  // stays live and the promo lane stays open.
  return { open: true, strikeCount };
}

export async function loadMembershipRow(
  admin: SupabaseClient,
  projectId: string,
): Promise<MembershipRow | null> {
  const res = await admin
    .from("projects")
    .select(
      "id, plan, first_ticket_honored_at, plan_live_at, strike_count, last_strike_at, promo_paused_until, plan_forfeited_at, reward_lane_pending_review_at",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return res.data as MembershipRow;
}

/** Persist lazy decay when the effective count dropped. */
async function maybeDecayStrikes(
  admin: SupabaseClient,
  row: MembershipRow,
  now: Date = new Date(),
): Promise<MembershipRow> {
  const effective = effectiveStrikeCount(row, now);
  if (effective === row.strike_count) return row;
  const update = await writePlace(admin, {
    table: "projects",
    mode: "update",
    id: row.id,
    patch: { strike_count: effective },
    select:
      "id, plan, first_ticket_honored_at, plan_live_at, strike_count, last_strike_at, promo_paused_until, plan_forfeited_at, reward_lane_pending_review_at",
  });
  if (!update.ok || !update.row) return { ...row, strike_count: effective };
  return update.row as MembershipRow;
}

function buildActivationPatch(
  row: MembershipRow,
  now: Date,
): { patch: Record<string, unknown>; membershipLive: boolean } {
  const iso = now.toISOString();
  const patch: Record<string, unknown> = { first_ticket_honored_at: iso };
  let membershipLive = !!row.plan_live_at;

  if (
    !row.plan_live_at &&
    !row.plan_forfeited_at &&
    isPaidPlan(row.plan)
  ) {
    patch.plan_live_at = iso;
    membershipLive = true;
  }

  return { patch, membershipLive };
}

/**
 * Stamp the first honored discount ticket and flip membership live. This is
 * the whole activation gate now — honoring a check at the table is the only
 * proof a place is really running the program.
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
      membershipLive: !!row.plan_live_at,
      firstHonor: false,
    };
  }

  const { patch, membershipLive } = buildActivationPatch(row, now);

  const update = await writePlace(admin, {
    table: "projects",
    mode: "update",
    id: projectId,
    patch: patch as ProjectPatch,
  });
  if (!update.ok) return { ok: false, error: update.error };
  return { ok: true, membershipLive, firstHonor: true };
}

export type RecordStrikeResult = {
  ok: true;
  strikeNumber: number;
  consequence: StrikeConsequence;
  alreadyRecorded?: boolean;
} | { ok: false; error: string };

/**
 * Record a refused/ignored-QR strike and apply the ladder.
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
      .from("project_strikes")
      .select("id, strike_number")
      .eq("ticket_id", opts.ticketId)
      .maybeSingle();
    if (existing.data) {
      const n = existing.data.strike_number as number;
      return {
        ok: true,
        strikeNumber: n,
        consequence: strikeConsequenceForCount(n),
        alreadyRecorded: true,
      };
    }
  }

  const next = Math.min(3, effectiveStrikeCount(row, now) + 1);
  const consequence = strikeConsequenceForCount(next);
  const patch = buildStrikePatch(next, now);

  const update = await writePlace(admin, {
    table: "projects",
    mode: "update",
    id: opts.projectId,
    patch: patch as ProjectPatch,
  });
  if (!update.ok) return { ok: false, error: update.error };

  const insert = await admin.from("project_strikes").insert({
    place_id: opts.projectId,
    consumer_id: opts.consumerId ?? null,
    ticket_id: opts.ticketId ?? null,
    reason: opts.reason,
    strike_number: next,
    notes: opts.notes ?? null,
  }).select("id").single();
  if (insert.error) {
    // Strike already applied on projects — surface the ledger write failure.
    return { ok: false, error: `strike_ledger: ${insert.error.message}` };
  }

  return { ok: true, strikeNumber: next, consequence };
}
