// Per-consumer place-create quota (abuse guard for the consumer create EFs).
//
// The concurrency guards in create-place.ts only dedupe the SAME
// google_place_id; nothing bounded how many DIFFERENT places one consumer
// account could create. Each create burns a Google Basics call up front and
// seeds a full Enricher run (real Apify/Firecrawl/Perplexity/OpenAI budget),
// so an unbounded loop is a direct cost-amplification + catalog-spam vector.
//
// Model: rolling 24 h window over public.place_creation_attempts, counted
// per ATTEMPT (recorded before any Google spend). Insert-then-count makes
// parallel bursts self-limiting — each request in an N-wide burst sees the
// whole burst, so a deliberate parallel flood cannot slip past a
// check-then-insert window. A rejected attempt deletes its own row so a
// locked-out user's retries don't extend their lockout.
//
// Fail-closed: this guard protects real money — a ledger error rejects the
// create (the same DB being down would fail savePlaceData moments later
// anyway).
//
// Callers: consumer-web-create-place (schedule-project-creation is a thin alias)
// (the compat alias — same privilege, must not be a bypass). Admin/business
// creates are intentionally NOT quota'd.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";

// Attempts per consumer per rolling 24 h come from Configurations › Creation
// (`enrichment_config.enrichConsumerCreatesPerDay`, MESITA-2376). Dedupe-409
// clicks count too.

export async function consumeConsumerCreateQuota(
  admin: SupabaseClient,
  consumerId: string,
  googlePlaceId: string,
  caller: string,
  perDay: number,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const reject = (status: number, body: Record<string, unknown>) => ({
    ok: false as const,
    response: json({ ok: false, ...body }, status),
  });

  // 1) Record the attempt (before counting — see burst rationale above).
  const { data: attempt, error: insErr } = await admin
    .from("place_creation_attempts")
    .insert({ consumer_id: consumerId, google_place_id: googlePlaceId, caller })
    .select("id")
    .single();
  if (insErr || !attempt) {
    return reject(500, { error: `create_quota: ${insErr?.message ?? "no row"}` });
  }

  // 2) Count the rolling window, own attempt included.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: cntErr } = await admin
    .from("place_creation_attempts")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", consumerId)
    .gte("created_at", since);
  if (cntErr || count === null) {
    await withdrawAttempt(admin, attempt.id);
    return reject(500, { error: `create_quota: ${cntErr?.message ?? "no count"}` });
  }

  if (count > perDay) {
    // Withdraw the rejected attempt so retries don't extend the lockout.
    await withdrawAttempt(admin, attempt.id);
    return reject(429, {
      code: "create_quota_exceeded",
      error: "You've reached the daily limit for adding new places. Try again tomorrow.",
    });
  }

  return { ok: true };
}

/** Delete our own attempt row. A failure is logged and swallowed: the caller
 *  is already rejecting, and a stranded row only lengthens the window. */
async function withdrawAttempt(admin: SupabaseClient, attemptId: string): Promise<void> {
  const { error } = await admin.from("place_creation_attempts").delete().eq("id", attemptId);
  if (error) console.error("[create_quota_rollback_failed]", attemptId, error.message);
}
