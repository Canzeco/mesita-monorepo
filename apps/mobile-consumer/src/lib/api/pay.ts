// Pay / ticket helpers — ported from apps/web-consumer/src/lib/api/pay.ts
// Shared by Rewards and inbox notifications.
// Clients call Edge Functions only (never the DB).

import { invokeEF } from '@/lib/ef';
import { supabase } from '@/lib/supabase';

export type PayNotificationRow = {
  id: string;
  consumer_id?: string;
  ticket_id: string;
  kind: string;
  status: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  resolved_at?: string | null;
};

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

function currencySymbolPrefix(currency: string): string {
  return currency === 'MXN' ? 'MX$' : '$';
}

export function formatCurrency(
  cents: number | null | undefined,
  currency = 'MXN',
): string {
  if (cents == null) return '—';
  const value = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currencySymbolPrefix(currency)}${value.toFixed(0)}`;
  }
}

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

export function submitTicketReview(input: {
  ticketId: string;
  food: number;
  service: number;
  ambiance: number;
  value: number;
  overall: number;
  comments?: string;
}) {
  return invokeEF<Record<string, unknown>>(
    supabase,
    'consumer-web-submit-ticket-review',
    { ...input },
    'Could not submit review',
  );
}
