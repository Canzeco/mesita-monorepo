import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { invokeEF } from "./_invoke";

type PayNotificationRow =
  Database["public"]["Tables"]["consumer_pay_notifications"]["Row"];

/** Stored on consumer_pay_notifications.payload for Pay → Tickets. */
export type TicketBillPayload = {
  project_id?: string;
  place_slug?: string | null;
  place_name?: string;
  place_photo_url?: string | null;
  /** Bare handle (no @), from place instagram_url at billing time. */
  place_instagram_handle?: string | null;
  ticket_kind?: string;
  check_subtotal_cents?: number;
  tip_cents?: number;
  total_cents?: number;
  discount_cents?: number;
  discount_percent?: number | null;
  redeem_cents?: number;
  total_reward_cents?: number;
  /** Per-visit promo cap in major currency units (e.g. 500 MXN). */
  reward_cap_mxn?: number | null;
  monthly_promo_cap?: number | null;
  amount_due_cents?: number;
  currency?: string;
};

const DEFAULT_CURRENCY = "MXN";

export function formatPayMx(
  cents: number | undefined | null,
  currency = DEFAULT_CURRENCY,
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

export async function submitTicketReview(
  supabase: SupabaseClient<Database>,
  input: {
    ticketId: string;
    food: number;
    service: number;
    ambiance: number;
    value: number;
    overall: number;
    comments?: string;
  },
) {
  return invokeEF<Record<string, unknown>>(
    supabase,
    "consumer-web-submit-ticket-review",
    { ...input },
    "Could not submit review",
  );
}
