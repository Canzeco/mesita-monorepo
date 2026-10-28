import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "@/lib/api/_invoke";

// The events the First Stage fires (MESITA-2087). Add here AND to
// consumer-web-track-event's allowlist before a call site ships a new one.
// Nothing enforces this pairing at compile time, so
// `analytics-events-paired.test.ts` reads both files, strips the `//`
// comments, and asserts that every quoted name in this union is one the EF
// accepts and one some call site fires.
export type AnalyticsEvent =
  // BottomNav, every tab tap.
  | "nav_tab_tap"
  // MESITA-1697 — Home's modes, now the rows of Home's column (MESITA-2409).
  // `nav_tab_tap` fires from BottomNav only, so every in-Home switch was
  // invisible until this. `home_card_open` came back
  // as the Places tile tap (MESITA-2384).
  | "home_mode_view"
  // Places tile taps and saves carry source, rank and final score
  // (MESITA-2384), so Premier's effect can be measured (MESITA-2925).
  | "home_card_open"
  | "home_card_save"
  // MESITA-2590 — Social's person card "Open Instagram", to measure leakage.
  | "social_open_instagram";

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
