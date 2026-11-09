"use server";

// Manage › Money (MESITA-3307). Thin wrappers over the operator's money EFs
// and the `money` config section; Result-style, never throws.

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";

export type MoneyConfig = {
  buying_paused: boolean;
  settle_rows: number;
  settle_concurrency: number;
  settle_deadline_ms: number;
  settle_give_up_ticks: number;
};

export type NeedsReviewRow = {
  kind: "purchase" | "payment";
  id: string;
  place_id: string;
  place_name: string | null;
  created_at: string;
  paid_at: string | null;
  amount_cents: number;
  refunded_cents: number;
  uncovered_cents: number;
  stripe_error: string | null;
  livemode: boolean;
  voucher: string | null;
  reopenable: boolean;
};

export type Cursor = { created_at: string; id: string } | null;

/** A failure with the EF's code and, on a refused refund, Stripe's own. */
function failure(r: { error: string; code: string | null; data: unknown }): { ok: false; error: string } {
  const stripe = (r.data as { stripe_code?: unknown } | null)?.stripe_code;
  const parts = [r.code, typeof stripe === "string" && stripe ? `Stripe: ${stripe}` : null].filter(Boolean);
  return { ok: false, error: parts.length ? `${r.error} (${parts.join(" · ")})` : r.error };
}

export async function getMoneyConfig(): Promise<ActionResult<{ config: MoneyConfig }>> {
  const r = await efInvoke<{ config: MoneyConfig }>("admin-web-get-config", { section: "money" });
  if (!r.ok) return failure(r);
  return { ok: true, config: r.data.config };
}

export async function saveMoneyConfig(config: MoneyConfig): Promise<ActionResult<{ config: MoneyConfig }>> {
  const r = await efInvoke<{ config: MoneyConfig }>("admin-web-update-config", { section: "money", config });
  if (!r.ok) return failure(r);
  return { ok: true, config: r.data.config };
}

export async function listNeedsReview(before: Cursor = null): Promise<ActionResult<{ rows: NeedsReviewRow[]; next: Cursor }>> {
  const r = await efInvoke<{ rows: NeedsReviewRow[]; next: Cursor }>("admin-web-list-needs-review", before ? { before } : {});
  if (!r.ok) return failure(r);
  return { ok: true, rows: r.data.rows ?? [], next: r.data.next ?? null };
}

export async function reopenSettle(kind: NeedsReviewRow["kind"], id: string): Promise<ActionResult> {
  const r = await efInvoke<{ outcome: string }>("admin-web-reopen-settle", { kind, id });
  if (!r.ok) return failure(r);
  return { ok: true };
}

export type RefundDone = { card_refunded_cents: number; credit_refunded_cents: number; status: string | null };

export async function refundRow(
  kind: NeedsReviewRow["kind"],
  id: string,
  amountCents: number | null,
): Promise<ActionResult<RefundDone>> {
  const r = await efInvoke<RefundDone>("admin-web-refund-payment", {
    kind,
    id,
    ...(amountCents ? { amount_cents: amountCents } : {}),
  });
  if (!r.ok) return failure(r);
  return { ok: true, ...r.data };
}

export type CloseOutDone = {
  guests: number;
  refunded_cents: number;
  refunds: { purchase_id: string; amount_cents: number; ok: boolean; code?: string; stripe_code?: string }[];
};

export async function closeOutPlace(placeId: string): Promise<ActionResult<CloseOutDone>> {
  const r = await efInvoke<CloseOutDone>("admin-web-close-out-place", { place_id: placeId });
  if (!r.ok) return failure(r);
  return { ok: true, ...r.data };
}

// ── Connected places (MESITA-3383) ─────────────────────────────────────────

export type ConnectedPlaceRow = {
  place_id: string;
  place_name: string | null;
  created_at: string;
  state: "none" | "onboarding" | "ready" | "restricted";
  payouts_enabled: boolean;
  disabled_reason: string | null;
  requirements_due: number;
  switches_on: string[];
  available_cents: number;
  pending_cents: number;
  last_event_at: string | null;
};

export type PlaceCursor = { created_at: string; place_id: string } | null;

export type ConnectedPlaces = { rows: ConnectedPlaceRow[]; next: PlaceCursor; cap_cents: number | null; test_mode: boolean };

export async function listConnectedPlaces(before: PlaceCursor = null): Promise<ActionResult<ConnectedPlaces>> {
  const r = await efInvoke<ConnectedPlaces>("admin-web-list-connected-places", before ? { before } : {});
  if (!r.ok) return failure(r);
  return {
    ok: true,
    rows: r.data.rows ?? [],
    next: r.data.next ?? null,
    cap_cents: r.data.cap_cents ?? null,
    test_mode: r.data.test_mode !== false,
  };
}
