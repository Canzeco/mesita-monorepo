import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type PayNotificationRow =
  Database["public"]["Tables"]["consumer_pay_notifications"]["Row"];

/** Stored on consumer_pay_notifications.payload for Pay → Tickets. */
export type TicketBillPayload = {
  venue_id?: string;
  venue_slug?: string | null;
  venue_name?: string;
  venue_photo_url?: string | null;
  ticket_kind?: string;
  check_subtotal_cents?: number;
  tip_cents?: number;
  total_cents?: number;
  discount_cents?: number;
  discount_percent?: number | null;
  cashback_percent?: number | null;
  cashback_cents?: number | null;
  redeem_cents?: number;
  total_reward_cents?: number;
  /** Per-visit promo cap in major currency units (e.g. 500 MXN). */
  reward_cap_mxn?: number | null;
  monthly_promo_cap?: number | null;
  amount_due_cents?: number;
  currency?: string;
};

function formatRewardCapLabel(
  capMxn: number | null | undefined,
  currency = "MXN",
): string | null {
  if (capMxn == null || capMxn <= 0) return null;
  const prefix = currency === "MXN" ? "MX$" : "$";
  return `${prefix}${capMxn.toLocaleString("en-US")}`;
}

export function formatTicketRewardLabel(
  p: TicketBillPayload,
  opts?: { capMxn?: number | null },
): string {
  const capMxn =
    opts?.capMxn ?? p.reward_cap_mxn ?? p.monthly_promo_cap ?? null;
  const capLabel = formatRewardCapLabel(capMxn, p.currency);
  const capSuffix = capLabel ? `, cap at ${capLabel}` : "";

  if (p.discount_percent != null && p.discount_percent > 0) {
    return `Reward of ${p.discount_percent}% discount${capSuffix}`;
  }
  if (p.cashback_percent != null && p.cashback_percent > 0) {
    return `Reward of ${p.cashback_percent}% cashback${capSuffix}`;
  }

  const rewardCents =
    p.total_reward_cents ??
    (p.discount_cents ?? 0) + (p.redeem_cents ?? 0);
  if (rewardCents > 0) {
    return `Reward of ${formatPayMx(rewardCents, p.currency)}${capSuffix}`;
  }

  if (capLabel) {
    return `Reward pending, cap at ${capLabel}`;
  }

  return "Reward pending";
}

export function formatPayMx(
  cents: number | undefined | null,
  currency = "MXN",
): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)} ${currency}`;
}

export function payloadFromNotification(
  payload: PayNotificationRow["payload"],
): TicketBillPayload {
  if (!payload || typeof payload !== "object") return {};
  return payload as TicketBillPayload;
}

export async function confirmTicketPayment(
  supabase: SupabaseClient<Database>,
  ticketId: string,
) {
  const { data, error } = await supabase.functions.invoke(
    "consumer-confirm-ticket-payment",
    { body: { ticketId } },
  );
  if (error) throw error;
  const body = data as { ok?: boolean; error?: string };
  if (!body?.ok) throw new Error(body?.error ?? "Could not confirm payment");
  return body;
}

export async function submitTicketReview(
  supabase: SupabaseClient<Database>,
  input: {
    ticketId: string;
    food: number;
    service: number;
    ambiance: number;
    overall: number;
    comments?: string;
  },
) {
  const { data, error } = await supabase.functions.invoke(
    "consumer-submit-ticket-review",
    { body: input },
  );
  if (error) throw error;
  const body = data as { ok?: boolean; error?: string };
  if (!body?.ok) throw new Error(body?.error ?? "Could not submit review");
  return body;
}
