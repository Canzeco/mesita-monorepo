// Slim pay helpers needed by notifications (inbox). Full ticket/pay surface
// lives under Rewards (MESITA-566). Mirror of web pay.ts subset — EF only.

export type PayNotificationRow = {
  id: string;
  consumer_id: string;
  ticket_id: string;
  kind: string;
  status: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
};

/** Stored on consumer_pay_notifications.payload for Pay → Tickets. */
export type TicketBillPayload = {
  project_id?: string;
  place_slug?: string | null;
  place_name?: string;
  place_photo_url?: string | null;
  place_instagram_handle?: string | null;
  ticket_kind?: string;
  check_subtotal_cents?: number;
  tip_cents?: number;
  total_cents?: number;
  discount_cents?: number;
  discount_percent?: number | null;
  redeem_cents?: number;
  total_reward_cents?: number;
  reward_cap_mxn?: number | null;
  monthly_promo_cap?: number | null;
  amount_due_cents?: number;
  currency?: string;
};

export function formatPayMx(
  cents: number | undefined | null,
  currency = 'MXN',
): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)} ${currency}`;
}

export function payloadFromNotification(
  payload: PayNotificationRow['payload'] | Record<string, unknown> | null,
): TicketBillPayload {
  if (!payload || typeof payload !== 'object') return {};
  return payload as TicketBillPayload;
}
