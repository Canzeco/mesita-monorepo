// Per-IP Google Nearby fill quota (abuse guard for public list-places).
//
// consumer-web-list-places is verify_jwt = false. Web Search opt-in
// `{ google: true, lat, lng }` spends the server GMP_KEY on ONE Nearby
// Search (New) call per Google source — 20 places, never widened
// (MESITA-2298). Nothing in an isolate limits or caches it: every isolate
// shuts down when its request ends (MESITA-2765), so this ledger is the only
// budget.
//
// Model: rolling 60 s window over public.nearby_google_attempts, counted
// per BILLED REQUEST (recorded only when this isolate is about to fire one
// Nearby call).
// PER REQUEST, NOT PER PULL (MESITA-1700): a pull-scoped charge let one row
// authorise three billed calls, which tripled both ceilings below without
// changing a number anybody could see.
// Insert-then-count makes parallel bursts self-limiting — each request in
// an N-wide burst sees the whole burst. A rejected attempt deletes its own
// row so a guest who hit the cap recovers as the window rolls instead of
// extending their lockout.
//
// Fail-closed on money, fail-open on Search: a ledger error, a missing IP,
// or an exceeded cap skips Google fill and still returns listed Mesita.
// Never 429 the catalog — blanking Search is worse than a listed-only rail.
//
// Identity is hashConnectingIp (CF-Connecting-IP / rightmost XFF), not the
// leftmost XFF hop. A global window cap is the backstop if a caller still
// mints unique hashes (spoofed CF-Connecting-IP on a direct origin hit).
//
// Caller: searchNearbyPlaces `beforeFanout`, once per billed call.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Google-fill POSTs per hashed IP per rolling 60 s, counted per billed Nearby
// request. A Map load bills one call per Google source and reloads at most
// once every `map.reloadIdleSec`, so a real explorer stays under this.
export const GOOGLE_NEARBY_IP_MAX = 20;
export const GOOGLE_NEARBY_GLOBAL_MAX = 120;
export const GOOGLE_NEARBY_IP_WINDOW_MS = 60_000;

// THE DAILY BUDGET (MESITA-2870). The minute caps alone let one IP spend
// ~29k Enterprise Nearby calls a day and the world ~170k; Google's own
// `SearchNearbyRequest per day` quota was the only ceiling, and it ran out
// on 2026-10-27. Rolling 24 h, same ledger, same fail-closed rule. The IP
// hash rotates at UTC midnight (salted with the date), so the per-IP day is
// at most a calendar day; the global day is the real money ceiling:
// 1,000 × $35/1k ≈ $35 a day at worst.
export const GOOGLE_NEARBY_IP_DAY_MAX = 200;
export const GOOGLE_NEARBY_GLOBAL_DAY_MAX = 1_000;
export const GOOGLE_NEARBY_DAY_WINDOW_MS = 24 * 60 * 60_000;

type Window = {
  since: string;
  max: number;
  ipHash: string | null;
  label: string;
};

export async function consumeNearbyGoogleQuota(
  admin: SupabaseClient,
  ipHash: string | null,
): Promise<{ allow: boolean }> {
  if (!ipHash) return { allow: false };

  const { data: attempt, error: insErr } = await admin
    .from("nearby_google_attempts")
    .insert({ ip_hash: ipHash })
    .select("id")
    .single();
  if (insErr || !attempt) {
    console.error("[nearby] google quota insert failed", insErr?.message);
    return { allow: false };
  }

  const now = Date.now();
  const minute = new Date(now - GOOGLE_NEARBY_IP_WINDOW_MS).toISOString();
  const day = new Date(now - GOOGLE_NEARBY_DAY_WINDOW_MS).toISOString();
  // Cheapest first: a burst is refused before the day counts run.
  const windows: Window[] = [
    { since: minute, max: GOOGLE_NEARBY_IP_MAX, ipHash, label: "ip minute" },
    {
      since: minute,
      max: GOOGLE_NEARBY_GLOBAL_MAX,
      ipHash: null,
      label: "global minute",
    },
    { since: day, max: GOOGLE_NEARBY_IP_DAY_MAX, ipHash, label: "ip day" },
    {
      since: day,
      max: GOOGLE_NEARBY_GLOBAL_DAY_MAX,
      ipHash: null,
      label: "global day",
    },
  ];

  for (const w of windows) {
    let q = admin
      .from("nearby_google_attempts")
      .select("id", { count: "exact", head: true });
    if (w.ipHash) q = q.eq("ip_hash", w.ipHash);
    const { count, error } = await q.gte("created_at", w.since);
    if (error || count === null) {
      await admin.from("nearby_google_attempts").delete().eq("id", attempt.id);
      console.error(
        `[nearby] google quota ${w.label} count failed`,
        error?.message,
      );
      return { allow: false };
    }
    if (count > w.max) {
      await admin.from("nearby_google_attempts").delete().eq("id", attempt.id);
      if (w.label.endsWith("day")) {
        console.warn(`[nearby] google ${w.label} budget spent (${w.max})`);
      }
      return { allow: false };
    }
  }

  return { allow: true };
}
