import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "@/lib/api/_invoke";

// MESITA-1387 — the four starting events. Add here (and to the EF's
// allowlist) before a call site ships a new one; nothing enforces this
// pairing at compile time.
export type AnalyticsEvent =
  | "nav_tab_tap"
  | "wallet_open"
  | "balance_card_tap"
  | "ticket_created";

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
