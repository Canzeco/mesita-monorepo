import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "@/lib/api/_invoke";

// MESITA-1387 — the starting four, plus `plan_open` (MESITA-1619). Add here
// AND to consumer-web-track-event's allowlist before a call site ships a new
// one; nothing enforces this pairing at compile time, so
// `analytics-events-paired.test.ts` reads both files and asserts it.
export type AnalyticsEvent =
  | "nav_tab_tap"
  | "wallet_open"
  | "balance_card_tap"
  | "ticket_created"
  | "plan_open";

/**
 * Fire-and-forget product event. NEVER throws and NEVER awaited by a
 * caller that cares about it — a dropped event is nothing, a UI that stalls
 * or errors because analytics is down is a regression this must not cause.
 */
export function trackEvent(
  client: SupabaseClient,
  event: AnalyticsEvent,
  payload: Record<string, unknown> = {},
): void {
  void invokeEF<Record<string, never>>(client, "consumer-web-track-event", {
    event,
    payload,
  }).catch(() => {
    // Analytics is best-effort. Nothing reads this reject; the guest is
    // never told their tap didn't get counted.
  });
}
