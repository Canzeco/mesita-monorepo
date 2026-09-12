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
  | "plan_open"
  // MESITA-1674 — the Wallet's real balance list is paginated (twenty
  // organizations is a named design case), and this is the only new
  // interaction the read adds. NOTE: analytics-events-paired.test.ts's
  // extractor stops at the first literal semicolon after `AnalyticsEvent =`
  // — keep any comment inside this union semicolon-free.
  | "wallet_load_more_tap"
  // MESITA-1697 — Home's modes, finally instrumented. The rail went seven
  // modes to five to four across two weeks and this table could not say which
  // mode a guest used, which produced a visit, or whether anyone opened Chat
  // at all — `nav_tab_tap` fires from BottomNav only, so every in-Home switch
  // was invisible. `home_card_open` joins to `ticket_created` through the
  // place, which turns the question of which mode converts into a query
  // instead of an argument.
  //
  // NO DOUBLE QUOTES ANYWHERE IN THIS BLOCK. The paired test extracts every
  // quoted string between `AnalyticsEvent =` and the semicolon, so a quoted
  // phrase in a comment here becomes a phantom event and fails the pairing —
  // which is exactly how this note got written
  | "home_mode_view"
  | "home_card_open"
  | "home_card_save"
  // MESITA-1694 — Search-tab coach mark dismiss. The localStorage flag never
  // reaches the server, so nav_tab_tap cannot split auto-timer vs a real
  // Search tap. Payload.reason is timer or tap. First close wins.
  | "search_coachmark_dismiss";

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
