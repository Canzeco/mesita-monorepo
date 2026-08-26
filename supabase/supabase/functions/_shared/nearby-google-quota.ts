// Per-IP Google Nearby fill quota (abuse guard for public list-places).
//
// consumer-web-list-places is verify_jwt = false. Web Search opt-in
// `{ google: true, lat, lng }` spends the server GMP_KEY on five parallel
// Nearby Search (New) calls. The 15s in-isolate cell cache and the 20/60s
// isolate fan-out cap in nearby-places.ts do not bind across isolates, so a
// unique-~1 km-cell spray is otherwise an independent billed budget per
// isolate.
//
// Model: rolling 60 s window over public.nearby_google_attempts, counted
// per ATTEMPT (recorded only when this isolate is about to fire the five
// Nearby calls — not on a cache hit, in-flight join, or isolate-budget skip).
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
// Caller: searchNearbyPlaces `beforeFanout`, cache-miss fan-out only.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Google-fill POSTs per hashed IP per rolling 60 s. Search pan-idle is ~1 s
// so a real explorer stays well under this; unique cells across isolates
// share the same ledger.
export const GOOGLE_NEARBY_IP_MAX = 45;
export const GOOGLE_NEARBY_GLOBAL_MAX = 600;
export const GOOGLE_NEARBY_IP_WINDOW_MS = 60_000;

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

  const since = new Date(Date.now() - GOOGLE_NEARBY_IP_WINDOW_MS).toISOString();
  const { count, error: cntErr } = await admin
    .from("nearby_google_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if (cntErr || count === null) {
    await admin.from("nearby_google_attempts").delete().eq("id", attempt.id);
    console.error("[nearby] google quota count failed", cntErr?.message);
    return { allow: false };
  }

  if (count > GOOGLE_NEARBY_IP_MAX) {
    await admin.from("nearby_google_attempts").delete().eq("id", attempt.id);
    return { allow: false };
  }

  const { count: globalCount, error: globalErr } = await admin
    .from("nearby_google_attempts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (globalErr || globalCount === null) {
    await admin.from("nearby_google_attempts").delete().eq("id", attempt.id);
    console.error("[nearby] google quota global count failed", globalErr?.message);
    return { allow: false };
  }
  if (globalCount > GOOGLE_NEARBY_GLOBAL_MAX) {
    await admin.from("nearby_google_attempts").delete().eq("id", attempt.id);
    return { allow: false };
  }

  return { allow: true };
}
